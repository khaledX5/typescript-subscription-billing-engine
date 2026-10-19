import type { BillingInterval } from '../../shared/domain/billing-period.js';

/** Plain, serializable representation used for persistence and rehydration. */
export interface PlanSnapshot {
  readonly id: string;
  readonly name: string;
  readonly priceMinor: number;
  readonly currency: string;
  readonly billingInterval: BillingInterval;
  readonly active: boolean;
}
