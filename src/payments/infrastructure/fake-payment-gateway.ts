import { Inject, Injectable } from '@nestjs/common';
import { ID_GENERATOR, type IdGenerator } from '../../shared/id-generator.js';
import type { ChargeRequest, PaymentGateway } from '../domain/payment-gateway.js';
import { PaymentFailureCode, type PaymentResult } from '../domain/payment-result.js';

/** Customers whose ID starts with this prefix are always declined, mirroring a provider's test cards. */
export const DECLINED_CUSTOMER_PREFIX = 'cus_declined';

/**
 * In-process payment simulator for local development. No money moves and no network call is
 * made. Behavior is deterministic: every charge succeeds unless the customer ID starts with
 * {@link DECLINED_CUSTOMER_PREFIX}.
 */
@Injectable()
export class FakePaymentGateway implements PaymentGateway {
  private readonly processed = new Map<string, PaymentResult>();

  constructor(@Inject(ID_GENERATOR) private readonly ids: IdGenerator) {}

  charge(request: ChargeRequest): Promise<PaymentResult> {
    const previous = this.processed.get(request.idempotencyKey);
    if (previous) {
      return Promise.resolve(previous);
    }

    const result: PaymentResult = request.customerId.startsWith(DECLINED_CUSTOMER_PREFIX)
      ? {
          status: 'FAILED',
          failureCode: PaymentFailureCode.CARD_DECLINED,
          failureMessage: 'The simulated card was declined',
        }
      : { status: 'SUCCEEDED', transactionId: this.ids.generate('txn') };

    this.processed.set(request.idempotencyKey, result);
    return Promise.resolve(result);
  }
}
