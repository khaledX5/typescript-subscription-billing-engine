import {
  BillingPeriod,
  InvalidBillingPeriodError,
  type BillingInterval,
} from '../../shared/domain/billing-period.js';
import { Money } from '../../shared/domain/money.js';
import type { Plan } from '../../plans/domain/plan.js';
import { assertTransition, isRenewable, statusAfterFailedRenewal } from './subscription-policy.js';
import {
  InvalidCustomerIdError,
  InvalidSubscriptionTransitionError,
  RenewalNotDueError,
} from './subscription.errors.js';
import {
  SubscriptionStatus,
  type CancellationOutcome,
  type SubscriptionSnapshot,
} from './subscription.types.js';

export interface CreateSubscriptionProps {
  readonly id: string;
  readonly customerId: string;
  readonly plan: Plan;
  readonly now: Date;
}

/**
 * Aggregate root for a customer's subscription. State changes only happen through the
 * business operations below, each of which validates the transition first.
 *
 * Price, currency and billing interval are copied from the plan at creation time, so later
 * changes to the plan never alter what an existing subscriber is charged.
 */
export class Subscription {
  private constructor(
    readonly id: string,
    readonly customerId: string,
    readonly planId: string,
    readonly price: Money,
    readonly billingInterval: BillingInterval,
    private readonly billingAnchor: Date,
    private cycle: number,
    private currentStatus: SubscriptionStatus,
    private readonly createdAtValue: Date,
    private canceledAtValue: Date | null,
  ) {}

  static create(props: CreateSubscriptionProps): Subscription {
    const customerId = props.customerId.trim();
    if (customerId.length === 0) {
      throw new InvalidCustomerIdError();
    }
    const terms = props.plan.termsForNewSubscription();
    return new Subscription(
      props.id,
      customerId,
      terms.planId,
      terms.price,
      terms.billingInterval,
      new Date(props.now),
      0,
      SubscriptionStatus.ACTIVE,
      new Date(props.now),
      null,
    );
  }

  static restore(snapshot: SubscriptionSnapshot): Subscription {
    return new Subscription(
      snapshot.id,
      snapshot.customerId,
      snapshot.planId,
      Money.of(snapshot.priceMinor, snapshot.currency),
      snapshot.billingInterval,
      new Date(snapshot.billingAnchor),
      snapshot.cycle,
      snapshot.status,
      new Date(snapshot.createdAt),
      snapshot.canceledAt ? new Date(snapshot.canceledAt) : null,
    );
  }

  get status(): SubscriptionStatus {
    return this.currentStatus;
  }

  get createdAt(): Date {
    return new Date(this.createdAtValue);
  }

  get canceledAt(): Date | null {
    return this.canceledAtValue ? new Date(this.canceledAtValue) : null;
  }

  get currentPeriod(): BillingPeriod {
    return BillingPeriod.forCycle(this.billingAnchor, this.billingInterval, this.cycle);
  }

  /** The period a renewal would bill for: the one immediately after the current period. */
  get nextPeriod(): BillingPeriod {
    return BillingPeriod.forCycle(this.billingAnchor, this.billingInterval, this.cycle + 1);
  }

  /**
   * Cancels immediately. Repeating the call is a no-op that preserves the original
   * cancellation timestamp, so callers can tell whether anything changed.
   */
  cancel(now: Date): CancellationOutcome {
    if (this.currentStatus === SubscriptionStatus.CANCELED) {
      return 'ALREADY_CANCELED';
    }
    assertTransition(this.currentStatus, SubscriptionStatus.CANCELED, 'cancel');
    this.currentStatus = SubscriptionStatus.CANCELED;
    this.canceledAtValue = new Date(now);
    return 'CANCELED';
  }

  /**
   * A subscription can be renewed when it is ACTIVE or PAST_DUE and its current period has
   * ended. Canceled and expired subscriptions are never renewed (there is no reactivation flow).
   */
  ensureRenewable(now: Date): void {
    if (!isRenewable(this.currentStatus)) {
      throw new InvalidSubscriptionTransitionError(this.currentStatus, 'renew');
    }
    const period = this.currentPeriod;
    if (!period.hasEndedAt(now)) {
      throw new RenewalNotDueError(this.id, period.end);
    }
  }

  /** Advances to `paidPeriod` after its invoice was paid. Only the next period is accepted. */
  completeRenewal(paidPeriod: BillingPeriod): void {
    if (!isRenewable(this.currentStatus)) {
      throw new InvalidSubscriptionTransitionError(this.currentStatus, 'renew');
    }
    if (!paidPeriod.equals(this.nextPeriod)) {
      throw new InvalidBillingPeriodError(
        'only the period following the current one can be renewed',
      );
    }
    this.transitionTo(SubscriptionStatus.ACTIVE, 'renew');
    this.cycle += 1;
  }

  /**
   * Records a failed renewal payment. The billing period is deliberately left unchanged.
   * Returns the resulting status: PAST_DUE while retries remain, EXPIRED once exhausted.
   */
  recordFailedRenewal(failedAttemptsForPeriod: number): SubscriptionStatus {
    if (!isRenewable(this.currentStatus)) {
      throw new InvalidSubscriptionTransitionError(
        this.currentStatus,
        'record a failed renewal for',
      );
    }
    this.transitionTo(
      statusAfterFailedRenewal(failedAttemptsForPeriod),
      'record a failed renewal for',
    );
    return this.currentStatus;
  }

  toSnapshot(): SubscriptionSnapshot {
    return {
      id: this.id,
      customerId: this.customerId,
      planId: this.planId,
      priceMinor: this.price.amountMinor,
      currency: this.price.currency,
      billingInterval: this.billingInterval,
      billingAnchor: new Date(this.billingAnchor),
      cycle: this.cycle,
      status: this.currentStatus,
      createdAt: new Date(this.createdAtValue),
      canceledAt: this.canceledAtValue ? new Date(this.canceledAtValue) : null,
    };
  }

  private transitionTo(next: SubscriptionStatus, operation: string): void {
    if (next !== this.currentStatus) {
      assertTransition(this.currentStatus, next, operation);
      this.currentStatus = next;
    }
  }
}
