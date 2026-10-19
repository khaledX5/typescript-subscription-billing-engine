import { SequentialIdGenerator } from '../../../test/support/sequential-id-generator.js';
import { Money } from '../../shared/domain/money.js';
import type { ChargeRequest } from '../domain/payment-gateway.js';
import { DECLINED_CUSTOMER_PREFIX, FakePaymentGateway } from './fake-payment-gateway.js';

function request(overrides: Partial<ChargeRequest> = {}): ChargeRequest {
  return {
    idempotencyKey: 'inv_1:attempt-1',
    customerId: 'cus_1',
    amount: Money.of(1999, 'USD'),
    reference: 'inv_1',
    ...overrides,
  };
}

describe('FakePaymentGateway', () => {
  it('approves charges for regular customers', async () => {
    const gateway = new FakePaymentGateway(new SequentialIdGenerator());

    await expect(gateway.charge(request())).resolves.toEqual({
      status: 'SUCCEEDED',
      transactionId: 'txn_1',
    });
  });

  it('declines charges for the reserved test customer prefix', async () => {
    const gateway = new FakePaymentGateway(new SequentialIdGenerator());

    await expect(
      gateway.charge(request({ customerId: `${DECLINED_CUSTOMER_PREFIX}_42` })),
    ).resolves.toMatchObject({ status: 'FAILED', failureCode: 'CARD_DECLINED' });
  });

  it('returns the original outcome for a repeated idempotency key', async () => {
    const gateway = new FakePaymentGateway(new SequentialIdGenerator());

    const first = await gateway.charge(request());
    const replay = await gateway.charge(request());
    const next = await gateway.charge(request({ idempotencyKey: 'inv_1:attempt-2' }));

    expect(replay).toEqual(first);
    expect(next).toEqual({ status: 'SUCCEEDED', transactionId: 'txn_2' });
  });
});
