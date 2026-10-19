import {
  toPeriodResponse,
  toSubscriptionResponse,
  type PeriodResponse,
  type SubscriptionResponse,
} from '../../subscriptions/presentation/subscription.response.js';
import type { RenewalOutcome, RenewalResult } from '../application/process-renewal.use-case.js';
import type { Invoice } from '../domain/invoice.js';
import type { InvoiceStatus, PaymentAttempt } from '../domain/invoice.types.js';

/** Omit applied to each union member, so outcome-specific fields are preserved. */
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

export type PaymentAttemptResponse = DistributiveOmit<PaymentAttempt, 'attemptedAt'> & {
  readonly attemptedAt: string;
};

export interface InvoiceResponse {
  readonly id: string;
  readonly subscriptionId: string;
  readonly status: InvoiceStatus;
  readonly amountDueMinor: number;
  readonly currency: string;
  readonly period: PeriodResponse;
  readonly createdAt: string;
  readonly paidAt: string | null;
  readonly paymentAttempts: readonly PaymentAttemptResponse[];
}

export interface RenewalResponse {
  readonly outcome: RenewalOutcome;
  readonly subscription: SubscriptionResponse;
  readonly invoice: InvoiceResponse;
}

export function toInvoiceResponse(invoice: Invoice): InvoiceResponse {
  return {
    id: invoice.id,
    subscriptionId: invoice.subscriptionId,
    status: invoice.status,
    amountDueMinor: invoice.amountDue.amountMinor,
    currency: invoice.amountDue.currency,
    period: toPeriodResponse(invoice.period),
    createdAt: invoice.createdAt.toISOString(),
    paidAt: invoice.paidAt?.toISOString() ?? null,
    paymentAttempts: invoice.paymentAttempts.map((attempt) => ({
      ...attempt,
      attemptedAt: attempt.attemptedAt.toISOString(),
    })),
  };
}

export function toRenewalResponse(result: RenewalResult): RenewalResponse {
  return {
    outcome: result.outcome,
    subscription: toSubscriptionResponse(result.subscription),
    invoice: toInvoiceResponse(result.invoice),
  };
}
