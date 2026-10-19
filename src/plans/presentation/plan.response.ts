import type { BillingInterval } from '../../shared/domain/billing-period.js';
import type { Plan } from '../domain/plan.js';

export interface PlanResponse {
  readonly id: string;
  readonly name: string;
  readonly priceMinor: number;
  readonly currency: string;
  readonly billingInterval: BillingInterval;
  readonly active: boolean;
}

export function toPlanResponse(plan: Plan): PlanResponse {
  return {
    id: plan.id,
    name: plan.name,
    priceMinor: plan.price.amountMinor,
    currency: plan.price.currency,
    billingInterval: plan.billingInterval,
    active: plan.isActive,
  };
}
