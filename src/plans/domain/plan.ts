import type { BillingInterval } from '../../shared/domain/billing-period.js';
import { Money } from '../../shared/domain/money.js';
import { InactivePlanError, InvalidPlanNameError } from './plan.errors.js';
import type { PlanSnapshot } from './plan.types.js';

const MAX_NAME_LENGTH = 100;

export interface CreatePlanProps {
  readonly id: string;
  readonly name: string;
  readonly price: Money;
  readonly billingInterval: BillingInterval;
}

/** What a subscription agrees to pay, frozen at the moment it subscribes. */
export interface PlanTerms {
  readonly planId: string;
  readonly price: Money;
  readonly billingInterval: BillingInterval;
}

export class Plan {
  private constructor(
    readonly id: string,
    readonly name: string,
    readonly price: Money,
    readonly billingInterval: BillingInterval,
    private active: boolean,
  ) {}

  static create(props: CreatePlanProps): Plan {
    const name = props.name.trim();
    if (name.length === 0 || name.length > MAX_NAME_LENGTH) {
      throw new InvalidPlanNameError(MAX_NAME_LENGTH);
    }
    return new Plan(props.id, name, props.price, props.billingInterval, true);
  }

  static restore(snapshot: PlanSnapshot): Plan {
    return new Plan(
      snapshot.id,
      snapshot.name,
      Money.of(snapshot.priceMinor, snapshot.currency),
      snapshot.billingInterval,
      snapshot.active,
    );
  }

  get isActive(): boolean {
    return this.active;
  }

  /** Retires the plan for new sign-ups. Existing subscriptions keep their own terms. Idempotent. */
  deactivate(): void {
    this.active = false;
  }

  /** Returns the terms a new subscription locks in; only active plans can be subscribed to. */
  termsForNewSubscription(): PlanTerms {
    if (!this.active) {
      throw new InactivePlanError(this.id);
    }
    return { planId: this.id, price: this.price, billingInterval: this.billingInterval };
  }

  toSnapshot(): PlanSnapshot {
    return {
      id: this.id,
      name: this.name,
      priceMinor: this.price.amountMinor,
      currency: this.price.currency,
      billingInterval: this.billingInterval,
      active: this.active,
    };
  }
}
