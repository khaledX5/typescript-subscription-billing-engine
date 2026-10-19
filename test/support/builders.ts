import { Plan } from '../../src/plans/domain/plan.js';
import { BillingInterval } from '../../src/shared/domain/billing-period.js';
import { Money } from '../../src/shared/domain/money.js';
import { Subscription } from '../../src/subscriptions/domain/subscription.js';

export function aPlan(
  overrides: Partial<{
    id: string;
    priceMinor: number;
    currency: string;
    interval: BillingInterval;
  }> = {},
): Plan {
  return Plan.create({
    id: overrides.id ?? 'plan_1',
    name: 'Pro',
    price: Money.of(overrides.priceMinor ?? 1999, overrides.currency ?? 'USD'),
    billingInterval: overrides.interval ?? BillingInterval.MONTHLY,
  });
}

export function aSubscription(
  overrides: Partial<{ id: string; plan: Plan; now: string; customerId: string }> = {},
): Subscription {
  return Subscription.create({
    id: overrides.id ?? 'sub_1',
    customerId: overrides.customerId ?? 'cus_1',
    plan: overrides.plan ?? aPlan(),
    now: new Date(overrides.now ?? '2026-01-15T10:00:00.000Z'),
  });
}
