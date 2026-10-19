import type { PaymentFailureCode } from '../../payments/domain/payment-result.js';

export const InvoiceStatus = {
  PENDING: 'PENDING',
  PAID: 'PAID',
  FAILED: 'FAILED',
} as const;
export type InvoiceStatus = (typeof InvoiceStatus)[keyof typeof InvoiceStatus];

interface PaymentAttemptBase {
  readonly attemptNumber: number;
  readonly attemptedAt: Date;
}

export interface SucceededPaymentAttempt extends PaymentAttemptBase {
  readonly outcome: 'SUCCEEDED';
  readonly transactionId: string;
}

export interface FailedPaymentAttempt extends PaymentAttemptBase {
  readonly outcome: 'FAILED';
  readonly failureCode: PaymentFailureCode;
  readonly failureMessage: string;
}

/** Metadata about one charge attempt. Contains no card or bank details. */
export type PaymentAttempt = SucceededPaymentAttempt | FailedPaymentAttempt;

/** Plain, serializable representation used for persistence and rehydration. */
export interface InvoiceSnapshot {
  readonly id: string;
  readonly subscriptionId: string;
  readonly periodStart: Date;
  readonly periodEnd: Date;
  readonly amountDueMinor: number;
  readonly currency: string;
  readonly status: InvoiceStatus;
  readonly createdAt: Date;
  readonly paidAt: Date | null;
  readonly paymentAttempts: readonly PaymentAttempt[];
}
