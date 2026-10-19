import { jest } from '@jest/globals';
import { Logger } from '@nestjs/common';
import { aPlan, aSubscription } from '../../../test/support/builders.js';
import { FakeClock } from '../../../test/support/fake-clock.js';
import { ScriptedPaymentGateway } from '../../../test/support/scripted-payment-gateway.js';
import { SequentialIdGenerator } from '../../../test/support/sequential-id-generator.js';
import type { ChargeRequest, PaymentGateway } from '../../payments/domain/payment-gateway.js';
import type { PaymentResult } from '../../payments/domain/payment-result.js';
import { GetSubscriptionUseCase } from '../../subscriptions/application/get-subscription.use-case.js';
import { MAX_FAILED_RENEWAL_ATTEMPTS } from '../../subscriptions/domain/subscription-policy.js';
import {
  InvalidSubscriptionTransitionError,
  RenewalNotDueError,
  SubscriptionNotFoundError,
} from '../../subscriptions/domain/subscription.errors.js';
import { InMemorySubscriptionRepository } from '../../subscriptions/infrastructure/in-memory-subscription.repository.js';
import { DuplicateInvoiceError } from '../domain/invoice.errors.js';
import { Invoice } from '../domain/invoice.js';
import { InMemoryInvoiceRepository } from '../infrastructure/in-memory-invoice.repository.js';
import { ProcessRenewalUseCase } from './process-renewal.use-case.js';

const START = '2026-01-15T10:00:00.000Z';
const FIRST_PERIOD_END = '2026-02-15T10:00:00.000Z';

function setup(payments = ScriptedPaymentGateway.succeeding()) {
  const clock = new FakeClock(START);
  const subscriptions = new InMemorySubscriptionRepository();
  const invoices = new InMemoryInvoiceRepository();
  const useCase = new ProcessRenewalUseCase(
    new GetSubscriptionUseCase(subscriptions),
    subscriptions,
    invoices,
    payments,
    new SequentialIdGenerator(),
    clock,
  );
  return { clock, subscriptions, invoices, payments, useCase };
}

/** Lets every pending promise callback run before the test continues. */
const settle = (): Promise<void> => new Promise((resolve) => setImmediate(resolve));

/**
 * Simulates a slow provider: charges stay in flight until `completeAll()`. Like real providers,
 * a request that reuses an in-flight idempotency key joins the original charge.
 */
class InFlightPaymentGateway implements PaymentGateway {
  readonly requests: ChargeRequest[] = [];
  executedCharges = 0;
  private readonly inFlight = new Map<string, Promise<PaymentResult>>();
  private release: () => void = () => undefined;
  private readonly gate = new Promise<void>((resolve) => {
    this.release = resolve;
  });

  charge(request: ChargeRequest): Promise<PaymentResult> {
    this.requests.push(request);
    const existing = this.inFlight.get(request.idempotencyKey);
    if (existing) {
      return existing;
    }
    this.executedCharges += 1;
    const result = this.gate.then((): PaymentResult => ({
      status: 'SUCCEEDED',
      transactionId: 'txn_slow',
    }));
    this.inFlight.set(request.idempotencyKey, result);
    return result;
  }

  completeAll(): void {
    this.release();
  }
}

async function withDueSubscription(context: ReturnType<typeof setup>, priceMinor = 1999) {
  const subscription = aSubscription({ plan: aPlan({ priceMinor }), now: START });
  await context.subscriptions.save(subscription);
  context.clock.set(FIRST_PERIOD_END);
  return subscription;
}

describe('ProcessRenewalUseCase', () => {
  describe('successful payment', () => {
    it('issues a paid invoice for the next period and extends the subscription', async () => {
      const context = setup();
      await withDueSubscription(context);

      const result = await context.useCase.execute('sub_1');

      expect(result.outcome).toBe('RENEWED');
      expect(result.invoice.status).toBe('PAID');
      expect(result.invoice.period.start.toISOString()).toBe(FIRST_PERIOD_END);
      expect(result.invoice.period.end.toISOString()).toBe('2026-03-15T10:00:00.000Z');

      const stored = await context.subscriptions.findById('sub_1');
      expect(stored?.status).toBe('ACTIVE');
      expect(stored?.currentPeriod.start.toISOString()).toBe(FIRST_PERIOD_END);
      expect(context.payments.chargeCount).toBe(1);
    });

    it('charges the subscription price snapshot, not the current plan price', async () => {
      const context = setup();
      await withDueSubscription(context, 1000);

      const result = await context.useCase.execute('sub_1');

      expect(result.invoice.amountDue.amountMinor).toBe(1000);
      expect(context.payments.requests[0]).toMatchObject({
        customerId: 'cus_1',
        reference: result.invoice.id,
        amount: result.invoice.amountDue,
      });
    });

    it('logs the renewal attempt and the payment outcome', async () => {
      const log = jest.spyOn(Logger.prototype, 'log');
      const context = setup();
      await withDueSubscription(context);

      await context.useCase.execute('sub_1');

      expect(log.mock.calls.map(([message]) => message)).toEqual([
        expect.stringContaining('Renewal attempt: subscriptionId=sub_1'),
        expect.stringContaining('Payment succeeded'),
      ]);
      log.mockRestore();
    });
  });

  describe('failed payment', () => {
    it('marks the invoice failed and the subscription past due without extending the period', async () => {
      const context = setup(ScriptedPaymentGateway.declining());
      await withDueSubscription(context);

      const result = await context.useCase.execute('sub_1');

      expect(result.outcome).toBe('PAYMENT_FAILED');
      expect(result.invoice.status).toBe('FAILED');
      expect(result.invoice.isPaid).toBe(false);

      const stored = await context.subscriptions.findById('sub_1');
      expect(stored?.status).toBe('PAST_DUE');
      expect(stored?.currentPeriod.start.toISOString()).toBe(START);
      expect(stored?.currentPeriod.end.toISOString()).toBe(FIRST_PERIOD_END);
    });

    it('retries on the same invoice and recovers when a later attempt succeeds', async () => {
      const context = setup(ScriptedPaymentGateway.succeeding().failNext());
      await withDueSubscription(context);

      const first = await context.useCase.execute('sub_1');
      context.clock.advanceDays(1);
      const second = await context.useCase.execute('sub_1');

      expect(first.outcome).toBe('PAYMENT_FAILED');
      expect(second.outcome).toBe('RENEWED');
      expect(second.invoice.id).toBe(first.invoice.id);
      expect(second.invoice.paymentAttempts.map((a) => a.outcome)).toEqual(['FAILED', 'SUCCEEDED']);
      expect(await context.invoices.findBySubscriptionId('sub_1')).toHaveLength(1);
      expect((await context.subscriptions.findById('sub_1'))?.status).toBe('ACTIVE');
    });

    it('expires the subscription after the maximum number of failed attempts', async () => {
      const context = setup(ScriptedPaymentGateway.declining());
      await withDueSubscription(context);

      for (let attempt = 1; attempt < MAX_FAILED_RENEWAL_ATTEMPTS; attempt += 1) {
        await context.useCase.execute('sub_1');
      }
      const last = await context.useCase.execute('sub_1');

      expect(last.subscription.status).toBe('EXPIRED');
      expect(last.invoice.failedAttemptCount).toBe(MAX_FAILED_RENEWAL_ATTEMPTS);
      await expect(context.useCase.execute('sub_1')).rejects.toThrow(
        InvalidSubscriptionTransitionError,
      );
      expect(context.payments.chargeCount).toBe(MAX_FAILED_RENEWAL_ATTEMPTS);
    });
  });

  describe('eligibility', () => {
    it('rejects unknown subscriptions', async () => {
      await expect(setup().useCase.execute('sub_missing')).rejects.toThrow(
        SubscriptionNotFoundError,
      );
    });

    it('rejects renewal before the current period has ended, without side effects', async () => {
      const context = setup();
      await context.subscriptions.save(aSubscription({ now: START }));

      await expect(context.useCase.execute('sub_1')).rejects.toThrow(RenewalNotDueError);
      expect(await context.invoices.findBySubscriptionId('sub_1')).toEqual([]);
      expect(context.payments.chargeCount).toBe(0);
    });

    it('rejects renewal of a canceled subscription without issuing an invoice', async () => {
      const context = setup();
      const subscription = await withDueSubscription(context);
      subscription.cancel(context.clock.now());
      await context.subscriptions.save(subscription);

      await expect(context.useCase.execute('sub_1')).rejects.toThrow(
        InvalidSubscriptionTransitionError,
      );
      expect(await context.invoices.findBySubscriptionId('sub_1')).toEqual([]);
      expect(context.payments.chargeCount).toBe(0);
    });
  });

  describe('idempotency', () => {
    it('does not bill the same period twice when the renewal is repeated', async () => {
      const context = setup();
      await withDueSubscription(context);

      await context.useCase.execute('sub_1');
      await expect(context.useCase.execute('sub_1')).rejects.toThrow(RenewalNotDueError);

      expect(await context.invoices.findBySubscriptionId('sub_1')).toHaveLength(1);
      expect(context.payments.chargeCount).toBe(1);
    });

    it('completes the renewal without charging again when the period is already paid', async () => {
      const context = setup();
      const subscription = await withDueSubscription(context);
      // A previous run captured payment but crashed before saving the subscription.
      const paid = Invoice.issue({
        id: 'inv_existing',
        subscriptionId: subscription.id,
        period: subscription.nextPeriod,
        amountDue: subscription.price,
        now: context.clock.now(),
      });
      paid.recordPayment(
        { status: 'SUCCEEDED', transactionId: 'txn_earlier' },
        context.clock.now(),
      );
      await context.invoices.save(paid);

      const result = await context.useCase.execute('sub_1');

      expect(result.outcome).toBe('RENEWED');
      expect(result.invoice.id).toBe('inv_existing');
      expect(context.payments.chargeCount).toBe(0);
      expect(
        (await context.subscriptions.findById('sub_1'))?.currentPeriod.start.toISOString(),
      ).toBe(FIRST_PERIOD_END);
    });

    it('creates a single invoice and a single charge for concurrent renewals', async () => {
      const context = setup();
      await withDueSubscription(context);

      const results = await Promise.allSettled([
        context.useCase.execute('sub_1'),
        context.useCase.execute('sub_1'),
      ]);

      expect(results.filter((r) => r.status === 'fulfilled').length).toBeGreaterThanOrEqual(1);
      for (const rejected of results.filter((r) => r.status === 'rejected')) {
        expect(rejected.reason).toBeInstanceOf(DuplicateInvoiceError);
      }
      expect(await context.invoices.findBySubscriptionId('sub_1')).toHaveLength(1);
      expect(context.payments.chargeCount).toBe(1);
    });

    it('does not charge twice when a second renewal arrives while the first charge is in flight', async () => {
      const gateway = new InFlightPaymentGateway();
      const context = setup();
      const useCase = new ProcessRenewalUseCase(
        new GetSubscriptionUseCase(context.subscriptions),
        context.subscriptions,
        context.invoices,
        gateway,
        new SequentialIdGenerator(),
        context.clock,
      );
      await withDueSubscription(context);

      const first = useCase.execute('sub_1');
      await settle();
      expect(gateway.requests).toHaveLength(1); // first request is waiting on the provider
      const second = useCase.execute('sub_1');
      await settle();
      expect(gateway.requests).toHaveLength(2); // second reused the PENDING invoice and its key
      gateway.completeAll();

      const results = await Promise.all([first, second]);

      expect(results.map((r) => r.outcome)).toEqual(['RENEWED', 'RENEWED']);
      expect(gateway.requests[1]?.idempotencyKey).toBe(gateway.requests[0]?.idempotencyKey);
      expect(gateway.executedCharges).toBe(1);
      expect(await context.invoices.findBySubscriptionId('sub_1')).toHaveLength(1);
      const stored = await context.subscriptions.findById('sub_1');
      expect(stored?.currentPeriod.start.toISOString()).toBe(FIRST_PERIOD_END); // advanced once
    });
  });

  describe('repository failures', () => {
    it('does not charge when the invoice cannot be persisted', async () => {
      const context = setup();
      await withDueSubscription(context);
      jest.spyOn(context.invoices, 'save').mockRejectedValueOnce(new Error('database unavailable'));

      await expect(context.useCase.execute('sub_1')).rejects.toThrow('database unavailable');

      expect(context.payments.chargeCount).toBe(0);
      expect(
        (await context.subscriptions.findById('sub_1'))?.currentPeriod.start.toISOString(),
      ).toBe(START);
    });

    it('does not report success when the paid invoice cannot be saved, and never charges twice', async () => {
      const context = setup();
      await withDueSubscription(context);
      jest
        .spyOn(context.invoices, 'save')
        .mockImplementationOnce(InMemoryInvoiceRepository.prototype.save.bind(context.invoices))
        .mockRejectedValueOnce(new Error('database unavailable'));

      await expect(context.useCase.execute('sub_1')).rejects.toThrow('database unavailable');
      const [stored] = await context.invoices.findBySubscriptionId('sub_1');
      expect(stored?.status).toBe('PENDING');

      const retry = await context.useCase.execute('sub_1');

      expect(retry.outcome).toBe('RENEWED');
      expect(context.payments.requests).toHaveLength(2);
      expect(context.payments.requests[1]?.idempotencyKey).toBe(
        context.payments.requests[0]?.idempotencyKey,
      );
      expect(context.payments.chargeCount).toBe(1);
    });

    it('does not report success when the subscription cannot be saved, and recovers on retry', async () => {
      const context = setup();
      await withDueSubscription(context);
      jest
        .spyOn(context.subscriptions, 'save')
        .mockRejectedValueOnce(new Error('database unavailable'));

      await expect(context.useCase.execute('sub_1')).rejects.toThrow('database unavailable');
      expect(
        (await context.subscriptions.findById('sub_1'))?.currentPeriod.start.toISOString(),
      ).toBe(START);

      const retry = await context.useCase.execute('sub_1');

      expect(retry.outcome).toBe('RENEWED');
      expect(context.payments.chargeCount).toBe(1);
      expect(await context.invoices.findBySubscriptionId('sub_1')).toHaveLength(1);
    });
  });
});
