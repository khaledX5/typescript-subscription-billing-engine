import { IsIn, IsNumber, IsString } from 'class-validator';
import { BILLING_INTERVALS, type BillingInterval } from '../../../shared/domain/billing-period.js';

/** Shape validation only; value rules (non-negative integer price, ISO currency) live in the domain. */
export class CreatePlanDto {
  @IsString()
  name!: string;

  /** Price in minor currency units, e.g. 1999 = $19.99. */
  @IsNumber()
  priceMinor!: number;

  @IsString()
  currency!: string;

  @IsIn(BILLING_INTERVALS)
  billingInterval!: BillingInterval;
}
