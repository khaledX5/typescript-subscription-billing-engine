import { DECLINED_CUSTOMER_PREFIX } from '../../src/payments/infrastructure/fake-payment-gateway.js';
import { MAX_FAILED_RENEWAL_ATTEMPTS } from '../../src/subscriptions/domain/subscription-policy.js';
import {
  createPlan,
  createSubscription,
  createTestApp,
  type TestApp,
} from '../support/test-app.js';

const FIRST_PERIOD_END = '2026-02-15T10:00:00.000Z';

describe('Billing API', () => {
  let testApp: TestApp;
  let subscriptionId: string;

  beforeEach(async () => {
    testApp = await createTestApp();
    subscriptionId = await createSubscription(testApp, await createPlan(testApp));
  });

  afterEach(async () => {
    await testApp.close();
  });

  const renew = () => testApp.http().post(`/subscriptions/${subscriptionId}/renew`);
  const invoices = () => testApp.http().get(`/subscriptions/${subscriptionId}/invoices`);

  it('renews a due subscription when the payment succeeds', async () => {
    testApp.clock.set(FIRST_PERIOD_END);

    const response = await renew().expect(200);

    expect(response.body).toEqual({
      outcome: 'RENEWED',
      subscription: expect.objectContaining({
        status: 'ACTIVE',
        currentPeriod: { start: FIRST_PERIOD_END, end: '2026-03-15T10:00:00.000Z' },
      }),
      invoice: {
        id: 'inv_1',
        subscriptionId,
        status: 'PAID',
        amountDueMinor: 1999,
        currency: 'USD',
        period: { start: FIRST_PERIOD_END, end: '2026-03-15T10:00:00.000Z' },
        createdAt: FIRST_PERIOD_END,
        paidAt: FIRST_PERIOD_END,
        paymentAttempts: [
          {
            attemptNumber: 1,
            attemptedAt: FIRST_PERIOD_END,
            outcome: 'SUCCEEDED',
            transactionId: 'txn_1',
          },
        ],
      },
    });
  });

  it('records a failed payment without extending the billing period', async () => {
    testApp.payments.alwaysFail();
    testApp.clock.set(FIRST_PERIOD_END);

    const response = await renew().expect(200);

    expect(response.body.outcome).toBe('PAYMENT_FAILED');
    expect(response.body.invoice).toMatchObject({ status: 'FAILED', paidAt: null });
    expect(response.body.invoice.paymentAttempts[0]).toMatchObject({
      outcome: 'FAILED',
      failureCode: 'INSUFFICIENT_FUNDS',
    });

    const subscription = await testApp.http().get(`/subscriptions/${subscriptionId}`).expect(200);
    expect(subscription.body).toMatchObject({
      status: 'PAST_DUE',
      currentPeriod: { start: '2026-01-15T10:00:00.000Z', end: FIRST_PERIOD_END },
    });
  });

  it('retries a failed renewal on the same invoice', async () => {
    testApp.payments.failNext();
    testApp.clock.set(FIRST_PERIOD_END);
    await renew().expect(200);
    testApp.clock.advanceDays(2);

    const retry = await renew().expect(200);

    expect(retry.body.outcome).toBe('RENEWED');
    expect(retry.body.invoice.id).toBe('inv_1');
    expect(retry.body.invoice.paymentAttempts).toHaveLength(2);
    const list = await invoices().expect(200);
    expect(list.body).toHaveLength(1);
  });

  it('expires the subscription once retries are exhausted', async () => {
    testApp.payments.alwaysFail();
    testApp.clock.set(FIRST_PERIOD_END);
    for (let attempt = 0; attempt < MAX_FAILED_RENEWAL_ATTEMPTS; attempt += 1) {
      await renew().expect(200);
    }

    const response = await renew().expect(409);

    expect(response.body.code).toBe('INVALID_SUBSCRIPTION_TRANSITION');
    const subscription = await testApp.http().get(`/subscriptions/${subscriptionId}`).expect(200);
    expect(subscription.body.status).toBe('EXPIRED');
  });

  it('does not create duplicate invoices for repeated renewal requests', async () => {
    testApp.clock.set(FIRST_PERIOD_END);

    await renew().expect(200);
    const repeated = await renew().expect(409);

    expect(repeated.body.code).toBe('RENEWAL_NOT_DUE');
    expect((await invoices().expect(200)).body).toHaveLength(1);
    expect(testApp.payments.chargeCount).toBe(1);
  });

  it('creates one invoice and one charge for concurrent renewal requests', async () => {
    testApp.clock.set(FIRST_PERIOD_END);

    const responses = await Promise.all([renew(), renew(), renew()]);

    const statuses = responses.map((r) => r.status);
    expect(statuses).toContain(200);
    expect(statuses.every((status) => status === 200 || status === 409)).toBe(true);
    expect((await invoices().expect(200)).body).toHaveLength(1);
    expect(testApp.payments.chargeCount).toBe(1);
    const subscription = await testApp.http().get(`/subscriptions/${subscriptionId}`).expect(200);
    expect(subscription.body.currentPeriod.start).toBe(FIRST_PERIOD_END);
  });

  it('creates one invoice per period across consecutive renewals', async () => {
    testApp.clock.set(FIRST_PERIOD_END);
    await renew().expect(200);
    testApp.clock.set('2026-03-15T10:00:00.000Z');
    await renew().expect(200);

    const list = await invoices().expect(200);

    expect(
      (list.body as { period: { start: string } }[]).map((invoice) => invoice.period.start),
    ).toEqual([FIRST_PERIOD_END, '2026-03-15T10:00:00.000Z']);
  });

  it('rejects renewal before the current period ends', async () => {
    const response = await renew().expect(409);

    expect(response.body).toMatchObject({
      code: 'RENEWAL_NOT_DUE',
      message: `Subscription ${subscriptionId} is not due for renewal until ${FIRST_PERIOD_END}`,
    });
    expect((await invoices().expect(200)).body).toEqual([]);
  });

  it('rejects renewal of a canceled subscription', async () => {
    await testApp.http().post(`/subscriptions/${subscriptionId}/cancel`).expect(200);
    testApp.clock.set(FIRST_PERIOD_END);

    const response = await renew().expect(409);

    expect(response.body.code).toBe('INVALID_SUBSCRIPTION_TRANSITION');
    expect(testApp.payments.chargeCount).toBe(0);
  });

  it('returns an empty invoice list for a new subscription', async () => {
    await invoices().expect(200, []);
  });
});

describe('Billing API month-end renewals', () => {
  let testApp: TestApp;

  beforeEach(async () => {
    testApp = await createTestApp();
  });

  afterEach(async () => {
    await testApp.close();
  });

  it('renews a Jan 31 subscription on the last day of shorter months without drifting', async () => {
    testApp.clock.set('2026-01-31T09:00:00.000Z');
    const subscriptionId = await createSubscription(testApp, await createPlan(testApp));
    const renew = () => testApp.http().post(`/subscriptions/${subscriptionId}/renew`);

    const created = await testApp.http().get(`/subscriptions/${subscriptionId}`).expect(200);
    expect(created.body.currentPeriod).toEqual({
      start: '2026-01-31T09:00:00.000Z',
      end: '2026-02-28T09:00:00.000Z',
    });

    testApp.clock.set('2026-02-28T09:00:00.000Z');
    const february = await renew().expect(200);
    testApp.clock.set('2026-03-31T09:00:00.000Z');
    const march = await renew().expect(200);

    expect(february.body.invoice.period).toEqual({
      start: '2026-02-28T09:00:00.000Z',
      end: '2026-03-31T09:00:00.000Z',
    });
    expect(march.body.invoice.period).toEqual({
      start: '2026-03-31T09:00:00.000Z',
      end: '2026-04-30T09:00:00.000Z',
    });
  });

  it('does not renew a Jan 31 subscription before Feb 28 (not 30 days later)', async () => {
    testApp.clock.set('2026-01-31T09:00:00.000Z');
    const subscriptionId = await createSubscription(testApp, await createPlan(testApp));
    // A naive "+30 days" rule would make the period end on Mar 2.
    testApp.clock.set('2026-02-28T08:59:59.999Z');

    const early = await testApp.http().post(`/subscriptions/${subscriptionId}/renew`).expect(409);

    expect(early.body.code).toBe('RENEWAL_NOT_DUE');
  });

  it('renews a yearly Feb 29 subscription on Feb 28 of the next year', async () => {
    testApp.clock.set('2028-02-29T00:00:00.000Z');
    const planId = await createPlan(testApp, {
      name: 'Pro Yearly',
      priceMinor: 19900,
      currency: 'USD',
      billingInterval: 'YEARLY',
    });
    const subscriptionId = await createSubscription(testApp, planId);
    testApp.clock.set('2029-02-28T00:00:00.000Z');

    const response = await testApp
      .http()
      .post(`/subscriptions/${subscriptionId}/renew`)
      .expect(200);

    expect(response.body.invoice.period).toEqual({
      start: '2029-02-28T00:00:00.000Z',
      end: '2030-02-28T00:00:00.000Z',
    });
  });
});

describe('Billing API with the default fake payment gateway', () => {
  let testApp: TestApp;

  beforeEach(async () => {
    testApp = await createTestApp({ useDefaultPaymentGateway: true });
  });

  afterEach(async () => {
    await testApp.close();
  });

  it.each([
    ['cus_regular', 'RENEWED', 'ACTIVE'],
    [`${DECLINED_CUSTOMER_PREFIX}_1`, 'PAYMENT_FAILED', 'PAST_DUE'],
  ])('renews customer %s with outcome %s', async (customerId, outcome, status) => {
    const subscriptionId = await createSubscription(testApp, await createPlan(testApp), customerId);
    testApp.clock.set(FIRST_PERIOD_END);

    const response = await testApp
      .http()
      .post(`/subscriptions/${subscriptionId}/renew`)
      .expect(200);

    expect(response.body.outcome).toBe(outcome);
    expect(response.body.subscription.status).toBe(status);
  });
});
