import { jest } from '@jest/globals';
import { Logger } from '@nestjs/common';
import type { Subscription } from '../../src/subscriptions/domain/subscription.js';
import {
  SUBSCRIPTION_REPOSITORY,
  type SubscriptionRepository,
} from '../../src/subscriptions/domain/subscription.repository.js';
import { createPlan, createTestApp, type TestApp } from '../support/test-app.js';

const ERROR_BODY_KEYS = ['code', 'message', 'path', 'statusCode', 'timestamp'];

class BrokenSubscriptionRepository implements SubscriptionRepository {
  findById(): Promise<Subscription | undefined> {
    return Promise.reject(new Error('connection refused: db.internal:5432'));
  }

  save(): Promise<void> {
    return Promise.reject(new Error('connection refused: db.internal:5432'));
  }
}

describe('Error responses', () => {
  let testApp: TestApp;

  afterEach(async () => {
    await testApp.close();
  });

  it('uses the same body shape for domain, validation, routing and parsing errors', async () => {
    testApp = await createTestApp();

    const responses = await Promise.all([
      testApp.http().get('/plans/plan_missing'),
      testApp.http().post('/plans').send({}),
      testApp.http().get('/does-not-exist'),
      testApp.http().post('/plans').set('Content-Type', 'application/json').send('{"name":'),
    ]);

    expect(responses.map((r) => r.status)).toEqual([404, 400, 404, 400]);
    expect(responses.map((r) => r.body.code)).toEqual([
      'PLAN_NOT_FOUND',
      'VALIDATION_FAILED',
      'NOT_FOUND',
      'BAD_REQUEST',
    ]);
    for (const response of responses) {
      const keys = Object.keys(response.body).filter((key) => key !== 'details');
      expect(keys.sort()).toEqual(ERROR_BODY_KEYS);
    }
  });

  it('maps unexpected failures to an opaque 500 and logs the details server-side', async () => {
    const logError = jest.spyOn(Logger.prototype, 'error');
    testApp = await createTestApp({
      customize: (builder) =>
        builder
          .overrideProvider(SUBSCRIPTION_REPOSITORY)
          .useValue(new BrokenSubscriptionRepository()),
    });
    const planId = await createPlan(testApp);

    const response = await testApp
      .http()
      .post('/subscriptions')
      .send({ customerId: 'cus_1', planId })
      .expect(500);

    expect(response.body).toEqual({
      statusCode: 500,
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
      path: '/subscriptions',
      timestamp: '2026-01-15T10:00:00.000Z',
    });
    expect(JSON.stringify(response.body)).not.toContain('db.internal');
    expect(logError).toHaveBeenCalledWith(
      'Unhandled error on POST /subscriptions',
      expect.stringContaining('connection refused'),
    );
    logError.mockRestore();
  });
});
