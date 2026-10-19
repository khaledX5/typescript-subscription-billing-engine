import { createPlan, createTestApp, PRO_MONTHLY, type TestApp } from '../support/test-app.js';

describe('Plans API', () => {
  let testApp: TestApp;

  beforeEach(async () => {
    testApp = await createTestApp();
  });

  afterEach(async () => {
    await testApp.close();
  });

  it('creates and retrieves a plan', async () => {
    const created = await testApp.http().post('/plans').send(PRO_MONTHLY).expect(201);

    expect(created.body).toEqual({ id: 'plan_1', ...PRO_MONTHLY, active: true });

    const fetched = await testApp.http().get('/plans/plan_1').expect(200);
    expect(fetched.body).toEqual(created.body);
  });

  it('lists plans', async () => {
    await createPlan(testApp);
    await createPlan(testApp, { ...PRO_MONTHLY, name: 'Team', billingInterval: 'YEARLY' });

    const response = await testApp.http().get('/plans').expect(200);

    expect(response.body).toHaveLength(2);
  });

  it('deactivates a plan idempotently', async () => {
    const planId = await createPlan(testApp);

    await testApp.http().post(`/plans/${planId}/deactivate`).expect(200);
    const response = await testApp.http().post(`/plans/${planId}/deactivate`).expect(200);

    expect(response.body).toMatchObject({ id: planId, active: false });
  });

  it('rejects payloads with missing, mistyped or unknown fields', async () => {
    const response = await testApp
      .http()
      .post('/plans')
      .send({ name: 42, priceMinor: '1999', billingInterval: 'WEEKLY', discount: 10 })
      .expect(400);

    expect(response.body).toMatchObject({ statusCode: 400, code: 'VALIDATION_FAILED' });
    const fields = (response.body.details as { field: string }[]).map((d) => d.field).sort();
    expect(fields).toEqual(['billingInterval', 'currency', 'discount', 'name', 'priceMinor']);
  });

  it.each([
    [{ priceMinor: -1 }, 'INVALID_AMOUNT'],
    [{ priceMinor: 19.99 }, 'INVALID_AMOUNT'],
    [{ currency: 'usd' }, 'INVALID_CURRENCY'],
    [{ name: '   ' }, 'INVALID_PLAN_NAME'],
  ])('rejects business-rule violations %p with %s', async (override, code) => {
    const response = await testApp
      .http()
      .post('/plans')
      .send({ ...PRO_MONTHLY, ...override })
      .expect(400);

    expect(response.body.code).toBe(code);
    await testApp.http().get('/plans').expect(200, []);
  });

  it('returns 404 for an unknown plan', async () => {
    const response = await testApp.http().get('/plans/plan_missing').expect(404);

    expect(response.body).toEqual({
      statusCode: 404,
      code: 'PLAN_NOT_FOUND',
      message: 'Plan plan_missing was not found',
      path: '/plans/plan_missing',
      timestamp: '2026-01-15T10:00:00.000Z',
    });
  });
});
