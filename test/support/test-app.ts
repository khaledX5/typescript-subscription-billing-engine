import type { INestApplication } from '@nestjs/common';
import { Test, type TestingModuleBuilder } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from '../../src/app.module.js';
import { PAYMENT_GATEWAY } from '../../src/payments/domain/payment-gateway.js';
import { CLOCK } from '../../src/shared/clock.js';
import { ID_GENERATOR } from '../../src/shared/id-generator.js';
import { FakeClock } from './fake-clock.js';
import { ScriptedPaymentGateway } from './scripted-payment-gateway.js';
import { SequentialIdGenerator } from './sequential-id-generator.js';

export interface TestApp {
  readonly app: INestApplication<App>;
  readonly clock: FakeClock;
  readonly payments: ScriptedPaymentGateway;
  readonly http: () => ReturnType<typeof request>;
  close(): Promise<void>;
}

export interface TestAppOptions {
  /** Keep the production FakePaymentGateway instead of the scripted test double. */
  readonly useDefaultPaymentGateway?: boolean;
  readonly customize?: (builder: TestingModuleBuilder) => TestingModuleBuilder;
}

/**
 * Boots the real AppModule (routing, validation, DI, filters, in-memory repositories) with
 * deterministic time, IDs and payments. Every call returns a fully isolated instance.
 */
export async function createTestApp(options: TestAppOptions = {}): Promise<TestApp> {
  const clock = new FakeClock('2026-01-15T10:00:00.000Z');
  const payments = ScriptedPaymentGateway.succeeding();

  let builder = Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(CLOCK)
    .useValue(clock)
    .overrideProvider(ID_GENERATOR)
    .useValue(new SequentialIdGenerator());
  if (!options.useDefaultPaymentGateway) {
    builder = builder.overrideProvider(PAYMENT_GATEWAY).useValue(payments);
  }
  builder = options.customize ? options.customize(builder) : builder;

  const moduleRef = await builder.compile();
  const app = moduleRef.createNestApplication<INestApplication<App>>({ logger: false });
  await app.init();

  return {
    app,
    clock,
    payments,
    http: () => request(app.getHttpServer()),
    close: () => app.close(),
  };
}

export const PRO_MONTHLY = {
  name: 'Pro',
  priceMinor: 1999,
  currency: 'USD',
  billingInterval: 'MONTHLY',
} as const;

export async function createPlan(
  testApp: TestApp,
  body: Record<string, unknown> = PRO_MONTHLY,
): Promise<string> {
  const response = await testApp.http().post('/plans').send(body).expect(201);
  return (response.body as { id: string }).id;
}

export async function createSubscription(
  testApp: TestApp,
  planId: string,
  customerId = 'cus_1',
): Promise<string> {
  const response = await testApp
    .http()
    .post('/subscriptions')
    .send({ customerId, planId })
    .expect(201);
  return (response.body as { id: string }).id;
}
