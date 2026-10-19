import { jest } from '@jest/globals';
import { aPlan, aSubscription } from '../../../test/support/builders.js';
import { FakeClock } from '../../../test/support/fake-clock.js';
import { SequentialIdGenerator } from '../../../test/support/sequential-id-generator.js';
import { GetPlanUseCase } from '../../plans/application/get-plan.use-case.js';
import { InactivePlanError, PlanNotFoundError } from '../../plans/domain/plan.errors.js';
import { Plan } from '../../plans/domain/plan.js';
import { InMemoryPlanRepository } from '../../plans/infrastructure/in-memory-plan.repository.js';
import { SubscriptionNotFoundError } from '../domain/subscription.errors.js';
import { InMemorySubscriptionRepository } from '../infrastructure/in-memory-subscription.repository.js';
import { CancelSubscriptionUseCase } from './cancel-subscription.use-case.js';
import { CreateSubscriptionUseCase } from './create-subscription.use-case.js';
import { GetSubscriptionUseCase } from './get-subscription.use-case.js';

function setup() {
  const clock = new FakeClock('2026-01-15T10:00:00.000Z');
  const plans = new InMemoryPlanRepository();
  const subscriptions = new InMemorySubscriptionRepository();
  const getSubscription = new GetSubscriptionUseCase(subscriptions);
  return {
    clock,
    plans,
    subscriptions,
    getSubscription,
    create: new CreateSubscriptionUseCase(
      new GetPlanUseCase(plans),
      subscriptions,
      new SequentialIdGenerator(),
      clock,
    ),
    cancel: new CancelSubscriptionUseCase(getSubscription, subscriptions, clock),
  };
}

describe('CreateSubscriptionUseCase', () => {
  it('creates and persists a subscription with the plan price snapshot', async () => {
    const context = setup();
    await context.plans.save(aPlan({ id: 'plan_1', priceMinor: 2900, currency: 'GBP' }));

    const created = await context.create.execute({ customerId: 'cus_1', planId: 'plan_1' });

    expect(created.id).toBe('sub_1');
    const stored = await context.subscriptions.findById('sub_1');
    expect(stored?.toSnapshot()).toMatchObject({
      customerId: 'cus_1',
      planId: 'plan_1',
      priceMinor: 2900,
      currency: 'GBP',
      status: 'ACTIVE',
      createdAt: new Date('2026-01-15T10:00:00.000Z'),
    });
  });

  it('keeps the agreed price after the stored plan is repriced', async () => {
    const context = setup();
    const plan = aPlan({ id: 'plan_1', priceMinor: 1000 });
    await context.plans.save(plan);
    await context.create.execute({ customerId: 'cus_1', planId: 'plan_1' });

    await context.plans.save(Plan.restore({ ...plan.toSnapshot(), priceMinor: 5000 }));

    expect((await context.subscriptions.findById('sub_1'))?.price.amountMinor).toBe(1000);
  });

  it('rejects an inactive plan without persisting anything', async () => {
    const context = setup();
    const plan = aPlan({ id: 'plan_1' });
    plan.deactivate();
    await context.plans.save(plan);

    await expect(context.create.execute({ customerId: 'cus_1', planId: 'plan_1' })).rejects.toThrow(
      InactivePlanError,
    );
    expect(await context.subscriptions.findById('sub_1')).toBeUndefined();
  });

  it('rejects an unknown plan', async () => {
    await expect(
      setup().create.execute({ customerId: 'cus_1', planId: 'plan_missing' }),
    ).rejects.toThrow(PlanNotFoundError);
  });
});

describe('GetSubscriptionUseCase', () => {
  it('returns a stored subscription', async () => {
    const context = setup();
    await context.subscriptions.save(aSubscription({ id: 'sub_9' }));

    expect((await context.getSubscription.execute('sub_9')).id).toBe('sub_9');
  });

  it('throws for an unknown subscription', async () => {
    await expect(setup().getSubscription.execute('sub_missing')).rejects.toThrow(
      SubscriptionNotFoundError,
    );
  });
});

describe('CancelSubscriptionUseCase', () => {
  it('cancels and persists the subscription', async () => {
    const context = setup();
    await context.subscriptions.save(aSubscription());
    context.clock.set('2026-01-20T00:00:00.000Z');

    const canceled = await context.cancel.execute('sub_1');

    expect(canceled.status).toBe('CANCELED');
    const stored = await context.subscriptions.findById('sub_1');
    expect(stored?.canceledAt?.toISOString()).toBe('2026-01-20T00:00:00.000Z');
  });

  it('has no further side effects when repeated', async () => {
    const context = setup();
    await context.subscriptions.save(aSubscription());
    await context.cancel.execute('sub_1');
    const save = jest.spyOn(context.subscriptions, 'save');
    context.clock.advanceDays(3);

    const again = await context.cancel.execute('sub_1');

    expect(again.canceledAt?.toISOString()).toBe('2026-01-15T10:00:00.000Z');
    expect(save).not.toHaveBeenCalled();
  });

  it('throws for an unknown subscription', async () => {
    await expect(setup().cancel.execute('sub_missing')).rejects.toThrow(SubscriptionNotFoundError);
  });
});
