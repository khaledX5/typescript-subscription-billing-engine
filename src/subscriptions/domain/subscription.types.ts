import type { BillingInterval } from '../../shared/domain/billing-period.js';

export const SubscriptionStatus = {
  ACTIVE: 'ACTIVE',
  PAST_DUE: 'PAST_DUE',
  CANCELED: 'CANCELED',
  EXPIRED: 'EXPIRED',
} as const;
export type SubscriptionStatus = (typeof SubscriptionStatus)[keyof typeof SubscriptionStatus];

export type CancellationOutcome = 'CANCELED' | 'ALREADY_CANCELED';

/** Plain, serializable representation used for persistence and rehydration. */
export interface SubscriptionSnapshot {
  readonly id: string;
  readonly customerId: string;
  readonly planId: string;
  readonly priceMinor: number;
  readonly currency: string;
  readonly billingInterval: BillingInterval;
  /** Start of the very first period; every later boundary is derived from it. */
  readonly billingAnchor: Date;
  /** 0-based index of the current billing period. */
  readonly cycle: number;
  readonly status: SubscriptionStatus;
  readonly createdAt: Date;
  readonly canceledAt: Date | null;
}
