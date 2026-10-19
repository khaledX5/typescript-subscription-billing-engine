import { aPlan } from '../../../test/support/builders.js';
import { BillingInterval } from '../../shared/domain/billing-period.js';
import { InvalidAmountError, InvalidCurrencyError, Money } from '../../shared/domain/money.js';
import { InactivePlanError, InvalidPlanNameError } from './plan.errors.js';
import { Plan } from './plan.js';

describe('Plan', () => {
  it('creates an active plan with a valid price', () => {
    const plan = Plan.create({
      id: 'plan_1',
      name: '  Pro  ',
      price: Money.of(1999, 'USD'),
      billingInterval: BillingInterval.YEARLY,
    });

    expect(plan.toSnapshot()).toEqual({
      id: 'plan_1',
      name: 'Pro',
      priceMinor: 1999,
      currency: 'USD',
      billingInterval: 'YEARLY',
      active: true,
    });
  });

  it('rejects negative prices', () => {
    expect(() => aPlan({ priceMinor: -100 })).toThrow(InvalidAmountError);
  });

  it('rejects non-integer prices', () => {
    expect(() => aPlan({ priceMinor: 19.99 })).toThrow(InvalidAmountError);
  });

  it('rejects invalid currency codes', () => {
    expect(() => aPlan({ currency: 'dollars' })).toThrow(InvalidCurrencyError);
  });

  it.each(['', '   ', 'x'.repeat(101)])('rejects invalid name %p', (name) => {
    expect(() =>
      Plan.create({
        id: 'plan_1',
        name,
        price: Money.of(100, 'USD'),
        billingInterval: 'MONTHLY',
      }),
    ).toThrow(InvalidPlanNameError);
  });

  it('exposes its terms for new subscriptions while active', () => {
    const plan = aPlan({ id: 'plan_9', priceMinor: 500, currency: 'EUR', interval: 'YEARLY' });

    expect(plan.termsForNewSubscription()).toEqual({
      planId: 'plan_9',
      price: Money.of(500, 'EUR'),
      billingInterval: 'YEARLY',
    });
  });

  it('cannot be used for new subscriptions once deactivated', () => {
    const plan = aPlan();
    plan.deactivate();

    expect(plan.isActive).toBe(false);
    expect(() => plan.termsForNewSubscription()).toThrow(InactivePlanError);
  });

  it('treats repeated deactivation as a no-op', () => {
    const plan = aPlan();
    plan.deactivate();
    plan.deactivate();

    expect(plan.isActive).toBe(false);
  });

  it('round-trips through its snapshot', () => {
    const plan = aPlan();
    plan.deactivate();

    expect(Plan.restore(plan.toSnapshot()).toSnapshot()).toEqual(plan.toSnapshot());
  });
});
