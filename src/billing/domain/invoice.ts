import { BillingPeriod } from '../../shared/domain/billing-period.js';
import { Money } from '../../shared/domain/money.js';
import type { PaymentResult } from '../../payments/domain/payment-result.js';
import { InvoiceAlreadyPaidError } from './invoice.errors.js';
import { InvoiceStatus, type InvoiceSnapshot, type PaymentAttempt } from './invoice.types.js';

export interface IssueInvoiceProps {
  readonly id: string;
  readonly subscriptionId: string;
  readonly period: BillingPeriod;
  /** The subscription's price snapshot; the invoice keeps its own copy. */
  readonly amountDue: Money;
  readonly now: Date;
}

/**
 * One invoice per subscription billing period.
 *
 * Status flow: PENDING -> PAID | FAILED, and FAILED -> PAID | FAILED on retry.
 * PAID is final: an invoice can never be paid (or failed) again.
 */
export class Invoice {
  private constructor(
    readonly id: string,
    readonly subscriptionId: string,
    readonly period: BillingPeriod,
    readonly amountDue: Money,
    private currentStatus: InvoiceStatus,
    private readonly createdAtValue: Date,
    private paidAtValue: Date | null,
    private readonly attempts: PaymentAttempt[],
  ) {}

  static issue(props: IssueInvoiceProps): Invoice {
    return new Invoice(
      props.id,
      props.subscriptionId,
      props.period,
      props.amountDue,
      InvoiceStatus.PENDING,
      new Date(props.now),
      null,
      [],
    );
  }

  static restore(snapshot: InvoiceSnapshot): Invoice {
    return new Invoice(
      snapshot.id,
      snapshot.subscriptionId,
      BillingPeriod.of(snapshot.periodStart, snapshot.periodEnd),
      Money.of(snapshot.amountDueMinor, snapshot.currency),
      snapshot.status,
      new Date(snapshot.createdAt),
      snapshot.paidAt ? new Date(snapshot.paidAt) : null,
      snapshot.paymentAttempts.map(cloneAttempt),
    );
  }

  get status(): InvoiceStatus {
    return this.currentStatus;
  }

  get isPaid(): boolean {
    return this.currentStatus === InvoiceStatus.PAID;
  }

  get createdAt(): Date {
    return new Date(this.createdAtValue);
  }

  get paidAt(): Date | null {
    return this.paidAtValue ? new Date(this.paidAtValue) : null;
  }

  get paymentAttempts(): readonly PaymentAttempt[] {
    return this.attempts.map(cloneAttempt);
  }

  get failedAttemptCount(): number {
    return this.attempts.filter((attempt) => attempt.outcome === 'FAILED').length;
  }

  /**
   * Key for the next charge attempt. It only changes once an attempt has been recorded, so a
   * charge that is retried because its outcome was never persisted reuses the same key and the
   * gateway will not charge twice.
   */
  get nextPaymentIdempotencyKey(): string {
    return `${this.id}:attempt-${this.attempts.length + 1}`;
  }

  /** Applies the gateway's outcome. Throws if the invoice is already paid. */
  recordPayment(result: PaymentResult, at: Date): void {
    if (this.isPaid) {
      throw new InvoiceAlreadyPaidError(this.id);
    }
    const attemptNumber = this.attempts.length + 1;
    const attemptedAt = new Date(at);

    if (result.status === 'SUCCEEDED') {
      this.attempts.push({
        attemptNumber,
        attemptedAt,
        outcome: 'SUCCEEDED',
        transactionId: result.transactionId,
      });
      this.currentStatus = InvoiceStatus.PAID;
      this.paidAtValue = new Date(at);
    } else {
      this.attempts.push({
        attemptNumber,
        attemptedAt,
        outcome: 'FAILED',
        failureCode: result.failureCode,
        failureMessage: result.failureMessage,
      });
      this.currentStatus = InvoiceStatus.FAILED;
    }
  }

  toSnapshot(): InvoiceSnapshot {
    return {
      id: this.id,
      subscriptionId: this.subscriptionId,
      periodStart: this.period.start,
      periodEnd: this.period.end,
      amountDueMinor: this.amountDue.amountMinor,
      currency: this.amountDue.currency,
      status: this.currentStatus,
      createdAt: new Date(this.createdAtValue),
      paidAt: this.paidAtValue ? new Date(this.paidAtValue) : null,
      paymentAttempts: this.attempts.map(cloneAttempt),
    };
  }
}

function cloneAttempt(attempt: PaymentAttempt): PaymentAttempt {
  return { ...attempt, attemptedAt: new Date(attempt.attemptedAt) };
}
