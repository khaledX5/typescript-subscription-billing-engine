import type { ChargeRequest, PaymentGateway } from '../../src/payments/domain/payment-gateway.js';
import {
  PaymentFailureCode,
  type PaymentResult,
} from '../../src/payments/domain/payment-result.js';

type Outcome = 'succeed' | 'fail';

/**
 * Test double whose outcomes are scripted per test. It honors the full PaymentGateway contract,
 * including idempotency keys, so it can stand in for any real implementation.
 */
export class ScriptedPaymentGateway implements PaymentGateway {
  /** Every request received, including idempotent replays. */
  readonly requests: ChargeRequest[] = [];
  private readonly queue: Outcome[] = [];
  private readonly resultsByKey = new Map<string, PaymentResult>();
  private executedCharges = 0;

  private constructor(private defaultOutcome: Outcome) {}

  static succeeding(): ScriptedPaymentGateway {
    return new ScriptedPaymentGateway('succeed');
  }

  static declining(): ScriptedPaymentGateway {
    return new ScriptedPaymentGateway('fail');
  }

  /** Number of charges actually executed (idempotent replays excluded). */
  get chargeCount(): number {
    return this.executedCharges;
  }

  failNext(times = 1): this {
    this.queue.push(...Array<Outcome>(times).fill('fail'));
    return this;
  }

  succeedNext(times = 1): this {
    this.queue.push(...Array<Outcome>(times).fill('succeed'));
    return this;
  }

  alwaysFail(): this {
    this.defaultOutcome = 'fail';
    return this;
  }

  charge(request: ChargeRequest): Promise<PaymentResult> {
    this.requests.push(request);
    const previous = this.resultsByKey.get(request.idempotencyKey);
    if (previous) {
      return Promise.resolve(previous);
    }

    this.executedCharges += 1;
    const outcome = this.queue.shift() ?? this.defaultOutcome;
    const result: PaymentResult =
      outcome === 'succeed'
        ? { status: 'SUCCEEDED', transactionId: `txn_${this.executedCharges}` }
        : {
            status: 'FAILED',
            failureCode: PaymentFailureCode.INSUFFICIENT_FUNDS,
            failureMessage: 'Insufficient funds',
          };
    this.resultsByKey.set(request.idempotencyKey, result);
    return Promise.resolve(result);
  }
}
