import { SequentialIdGenerator } from '../../../test/support/sequential-id-generator.js';
import { InvalidAmountError, InvalidCurrencyError } from '../../shared/domain/money.js';
import { PlanNotFoundError } from '../domain/plan.errors.js';
import { InMemoryPlanRepository } from '../infrastructure/in-memory-plan.repository.js';
import { CreatePlanUseCase } from './create-plan.use-case.js';
import { DeactivatePlanUseCase } from './deactivate-plan.use-case.js';
import { GetPlanUseCase } from './get-plan.use-case.js';
import { ListPlansUseCase } from './list-plans.use-case.js';

function setup() {
  const plans = new InMemoryPlanRepository();
  const getPlan = new GetPlanUseCase(plans);
  return {
    plans,
    getPlan,
    create: new CreatePlanUseCase(plans, new SequentialIdGenerator()),
    list: new ListPlansUseCase(plans),
    deactivate: new DeactivatePlanUseCase(getPlan, plans),
  };
}

const proMonthly = {
  name: 'Pro',
  priceMinor: 1999,
  currency: 'USD',
  billingInterval: 'MONTHLY',
} as const;

describe('plan use cases', () => {
  it('creates a plan with a generated ID and persists it', async () => {
    const context = setup();

    const plan = await context.create.execute(proMonthly);

    expect(plan.id).toBe('plan_1');
    expect((await context.getPlan.execute('plan_1')).toSnapshot()).toEqual({
      id: 'plan_1',
      ...proMonthly,
      active: true,
    });
  });

  it('does not persist a plan that violates a business rule', async () => {
    const context = setup();

    await expect(context.create.execute({ ...proMonthly, priceMinor: -1 })).rejects.toThrow(
      InvalidAmountError,
    );
    await expect(context.create.execute({ ...proMonthly, currency: 'usd' })).rejects.toThrow(
      InvalidCurrencyError,
    );
    expect(await context.list.execute()).toEqual([]);
  });

  it('lists all plans', async () => {
    const context = setup();
    await context.create.execute(proMonthly);
    await context.create.execute({ ...proMonthly, name: 'Team', billingInterval: 'YEARLY' });

    expect((await context.list.execute()).map((plan) => plan.name)).toEqual(['Pro', 'Team']);
  });

  it('throws for an unknown plan', async () => {
    await expect(setup().getPlan.execute('plan_missing')).rejects.toThrow(PlanNotFoundError);
  });

  it('deactivates a plan idempotently', async () => {
    const context = setup();
    await context.create.execute(proMonthly);

    await context.deactivate.execute('plan_1');
    const again = await context.deactivate.execute('plan_1');

    expect(again.isActive).toBe(false);
    expect((await context.getPlan.execute('plan_1')).isActive).toBe(false);
  });
});
