import type { BillingInterval, BillingPeriod } from '../../shared/domain/billing-period.js';
import type { Subscription } from '../domain/subscription.js';
import type { SubscriptionStatus } from '../domain/subscription.types.js';

export interface PeriodResponse {
  readonly start: string;
  readonly end: string;
}

export interface SubscriptionResponse {
  readonly id: string;
  readonly customerId: string;
  readonly planId: string;
  readonly status: SubscriptionStatus;
  readonly priceMinor: number;
  readonly currency: string;
  readonly billingInterval: BillingInterval;
  readonly currentPeriod: PeriodResponse;
  readonly createdAt: string;
  readonly canceledAt: string | null;
}

export function toPeriodResponse(period: BillingPeriod): PeriodResponse {
  return { start: period.start.toISOString(), end: period.end.toISOString() };
}

export function toSubscriptionResponse(subscription: Subscription): SubscriptionResponse {
  return {
    id: subscription.id,
    customerId: subscription.customerId,
    planId: subscription.planId,
    status: subscription.status,
    priceMinor: subscription.price.amountMinor,
    currency: subscription.price.currency,
    billingInterval: subscription.billingInterval,
    currentPeriod: toPeriodResponse(subscription.currentPeriod),
    createdAt: subscription.createdAt.toISOString(),
    canceledAt: subscription.canceledAt?.toISOString() ?? null,
  };
}
