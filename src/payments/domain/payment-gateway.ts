import type { Money } from '../../shared/domain/money.js';
import type { PaymentResult } from './payment-result.js';

export interface ChargeRequest {
  /**
   * Repeating a charge with the same key must not charge the customer again; the gateway
   * returns the outcome of the original attempt instead.
   */
  readonly idempotencyKey: string;
  readonly customerId: string;
  readonly amount: Money;
  /** Merchant-side reference, e.g. the invoice ID. */
  readonly reference: string;
}

/**
 * Port to an external payment provider.
 *
 * Contract every implementation must honor:
 * - declines are returned as a `FAILED` result, never thrown;
 * - exceptions are reserved for infrastructure faults (timeouts, outages);
 * - charges are idempotent per `idempotencyKey`.
 */
export interface PaymentGateway {
  charge(request: ChargeRequest): Promise<PaymentResult>;
}

export const PAYMENT_GATEWAY = Symbol('PaymentGateway');
