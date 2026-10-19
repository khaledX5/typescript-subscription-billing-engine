import {
  createPlan,
  createSubscription,
  createTestApp,
  type TestApp,
} from '../support/test-app.js';

describe('Subscriptions API', () => {
  let testApp: TestApp;

  beforeEach(async () => {
    testApp = await createTestApp();
  });

  afterEach(async () => {
    await testApp.close();
  });

  it('creates a subscription on an active plan with a price snapshot', async () => {
    const planId = await createPlan(testApp);

    const response = await testApp
      .http()
      .post('/subscriptions')
      .send({ customerId: 'cus_1', planId })
      .expect(201);

    expect(response.body).toEqual({
      id: 'sub_1',
      customerId: 'cus_1',
      planId,
      status: 'ACTIVE',
      priceMinor: 1999,
      currency: 'USD',
      billingInterval: 'MONTHLY',
      currentPeriod: { start: '2026-01-15T10:00:00.000Z', end: '2026-02-15T10:00:00.000Z' },
      createdAt: '2026-01-15T10:00:00.000Z',
      canceledAt: null,
    });
  });

  it('retrieves a subscription', async () => {
    const subscriptionId = await createSubscription(testApp, await createPlan(testApp));

    const response = await testApp.http().get(`/subscriptions/${subscriptionId}`).expect(200);

    expect(response.body).toMatchObject({ id: subscriptionId, status: 'ACTIVE' });
  });

  it('rejects a subscription to an inactive plan', async () => {
    const planId = await createPlan(testApp);
    await testApp.http().post(`/plans/${planId}/deactivate`).expect(200);

    const response = await testApp
      .http()
      .post('/subscriptions')
      .send({ customerId: 'cus_1', planId })
      .expect(400);

    expect(response.body).toMatchObject({ code: 'PLAN_INACTIVE' });
    await testApp.http().get('/subscriptions/sub_1').expect(404);
  });

  it('keeps existing subscriptions working after their plan is deactivated', async () => {
    const planId = await createPlan(testApp);
    const subscriptionId = await createSubscription(testApp, planId);
    await testApp.http().post(`/plans/${planId}/deactivate`).expect(200);
    testApp.clock.set('2026-02-15T10:00:00.000Z');

    const response = await testApp
      .http()
      .post(`/subscriptions/${subscriptionId}/renew`)
      .expect(200);

    expect(response.body.outcome).toBe('RENEWED');
  });

  it('rejects a subscription to an unknown plan', async () => {
    const response = await testApp
      .http()
      .post('/subscriptions')
      .send({ customerId: 'cus_1', planId: 'plan_missing' })
      .expect(404);

    expect(response.body.code).toBe('PLAN_NOT_FOUND');
  });

  it('rejects an invalid payload', async () => {
    const response = await testApp
      .http()
      .post('/subscriptions')
      .send({ customerId: 123 })
      .expect(400);

    expect(response.body.code).toBe('VALIDATION_FAILED');
  });

  it('cancels a subscription idempotently', async () => {
    const subscriptionId = await createSubscription(testApp, await createPlan(testApp));
    testApp.clock.set('2026-01-20T00:00:00.000Z');

    const first = await testApp.http().post(`/subscriptions/${subscriptionId}/cancel`).expect(200);
    testApp.clock.set('2026-01-25T00:00:00.000Z');
    const second = await testApp.http().post(`/subscriptions/${subscriptionId}/cancel`).expect(200);

    expect(first.body).toMatchObject({
      status: 'CANCELED',
      canceledAt: '2026-01-20T00:00:00.000Z',
    });
    expect(second.body).toEqual(first.body);

    const fetched = await testApp.http().get(`/subscriptions/${subscriptionId}`).expect(200);
    expect(fetched.body.status).toBe('CANCELED');
  });

  it('returns 404 for unknown subscriptions on every route', async () => {
    await testApp.http().get('/subscriptions/sub_missing').expect(404);
    await testApp.http().post('/subscriptions/sub_missing/cancel').expect(404);
    await testApp.http().post('/subscriptions/sub_missing/renew').expect(404);
    const response = await testApp.http().get('/subscriptions/sub_missing/invoices').expect(404);

    expect(response.body.code).toBe('SUBSCRIPTION_NOT_FOUND');
  });
});
