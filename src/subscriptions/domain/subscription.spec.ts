import { aPlan, aSubscription } from '../../../test/support/builders.js';
import { InactivePlanError } from '../../plans/domain/plan.errors.js';
import { Plan } from '../../plans/domain/plan.js';
import { BillingPeriod, InvalidBillingPeriodError } from '../../shared/domain/billing-period.js';
import { Money } from '../../shared/domain/money.js';
import { MAX_FAILED_RENEWAL_ATTEMPTS } from './subscription-policy.js';
import {
  InvalidCustomerIdError,
  InvalidSubscriptionTransitionError,
  RenewalNotDueError,
} from './subscription.errors.js';
import { Subscription } from './subscription.js';
import { SubscriptionStatus } from './subscription.types.js';

const at = (iso: string): Date => new Date(iso);

function periodOf(subscription: Subscription): { start: string; end: string } {
  const { start, end } = subscription.currentPeriod;
  return { start: start.toISOString(), end: end.toISOString() };
}

function pastDueSubscription(): Subscription {
  const subscription = aSubscription({ now: '2026-01-15T10:00:00.000Z' });
  subscription.recordFailedRenewal(1);
  return subscription;
}

function expiredSubscription(): Subscription {
  const subscription = pastDueSubscription();
  subscription.recordFailedRenewal(MAX_FAILED_RENEWAL_ATTEMPTS);
  return subscription;
}

describe('Subscription', () => {
  describe('create', () => {
    it('snapshots the plan price, currency and interval and starts the first period', () => {
      const plan = aPlan({ id: 'plan_7', priceMinor: 4900, currency: 'EUR', interval: 'MONTHLY' });
      const subscription = Subscription.create({
        id: 'sub_1',
        customerId: 'cus_42',
        plan,
        now: at('2026-01-15T10:00:00.000Z'),
      });

      expect(subscription.status).toBe(SubscriptionStatus.ACTIVE);
      expect(subscription.planId).toBe('plan_7');
      expect(subscription.price).toEqual(Money.of(4900, 'EUR'));
      expect(subscription.billingInterval).toBe('MONTHLY');
      expect(subscription.createdAt.toISOString()).toBe('2026-01-15T10:00:00.000Z');
      expect(subscription.canceledAt).toBeNull();
      expect(periodOf(subscription)).toEqual({
        start: '2026-01-15T10:00:00.000Z',
        end: '2026-02-15T10:00:00.000Z',
      });
    });

    it('keeps the agreed price when the plan changes later', () => {
      const plan = aPlan({ priceMinor: 1000 });
      const subscription = aSubscription({ plan });

      const repriced = Plan.restore({ ...plan.toSnapshot(), priceMinor: 2500, active: false });

      expect(repriced.price.amountMinor).toBe(2500);
      expect(subscription.price.amountMinor).toBe(1000);
    });

    it('rejects an inactive plan', () => {
      const plan = aPlan();
      plan.deactivate();

      expect(() => aSubscription({ plan })).toThrow(InactivePlanError);
    });

    it('rejects a blank customer ID', () => {
      expect(() => aSubscription({ customerId: '   ' })).toThrow(InvalidCustomerIdError);
    });

    it('starts a yearly period for yearly plans', () => {
      const subscription = aSubscription({
        plan: aPlan({ interval: 'YEARLY' }),
        now: '2028-02-29T00:00:00.000Z',
      });

      expect(periodOf(subscription)).toEqual({
        start: '2028-02-29T00:00:00.000Z',
        end: '2029-02-28T00:00:00.000Z',
      });
    });
  });

  describe('cancel', () => {
    it('cancels an active subscription and records when', () => {
      const subscription = aSubscription();

      const outcome = subscription.cancel(at('2026-01-20T00:00:00.000Z'));

      expect(outcome).toBe('CANCELED');
      expect(subscription.status).toBe(SubscriptionStatus.CANCELED);
      expect(subscription.canceledAt?.toISOString()).toBe('2026-01-20T00:00:00.000Z');
    });

    it('is idempotent and keeps the original cancellation timestamp', () => {
      const subscription = aSubscription();
      subscription.cancel(at('2026-01-20T00:00:00.000Z'));

      const outcome = subscription.cancel(at('2026-01-25T00:00:00.000Z'));

      expect(outcome).toBe('ALREADY_CANCELED');
      expect(subscription.canceledAt?.toISOString()).toBe('2026-01-20T00:00:00.000Z');
    });

    it('can cancel a past-due subscription', () => {
      const subscription = pastDueSubscription();

      expect(subscription.cancel(at('2026-02-16T00:00:00.000Z'))).toBe('CANCELED');
    });

    it('rejects cancelling an expired subscription', () => {
      const subscription = expiredSubscription();

      expect(() => subscription.cancel(at('2026-03-01T00:00:00.000Z'))).toThrow(
        InvalidSubscriptionTransitionError,
      );
      expect(subscription.status).toBe(SubscriptionStatus.EXPIRED);
    });
  });

  describe('renewal eligibility', () => {
    it('is renewable once the current period has ended', () => {
      const subscription = aSubscription({ now: '2026-01-15T10:00:00.000Z' });

      expect(() => subscription.ensureRenewable(at('2026-02-15T10:00:00.000Z'))).not.toThrow();
    });

    it('is not renewable before the current period ends', () => {
      const subscription = aSubscription({ now: '2026-01-15T10:00:00.000Z' });

      expect(() => subscription.ensureRenewable(at('2026-02-15T09:59:59.999Z'))).toThrow(
        RenewalNotDueError,
      );
    });

    it('rejects renewal of a canceled subscription', () => {
      const subscription = aSubscription();
      subscription.cancel(at('2026-01-20T00:00:00.000Z'));

      expect(() => subscription.ensureRenewable(at('2026-03-01T00:00:00.000Z'))).toThrow(
        InvalidSubscriptionTransitionError,
      );
      expect(() => subscription.completeRenewal(subscription.nextPeriod)).toThrow(
        InvalidSubscriptionTransitionError,
      );
    });

    it('rejects renewal of an expired subscription instead of silently reactivating it', () => {
      const subscription = expiredSubscription();

      expect(() => subscription.ensureRenewable(at('2026-03-01T00:00:00.000Z'))).toThrow(
        InvalidSubscriptionTransitionError,
      );
      expect(() => subscription.completeRenewal(subscription.nextPeriod)).toThrow(
        InvalidSubscriptionTransitionError,
      );
      expect(subscription.status).toBe(SubscriptionStatus.EXPIRED);
    });
  });

  describe('successful renewal', () => {
    it('extends the billing period by one month', () => {
      const subscription = aSubscription({ now: '2026-01-15T10:00:00.000Z' });

      subscription.completeRenewal(subscription.nextPeriod);

      expect(periodOf(subscription)).toEqual({
        start: '2026-02-15T10:00:00.000Z',
        end: '2026-03-15T10:00:00.000Z',
      });
      expect(subscription.status).toBe(SubscriptionStatus.ACTIVE);
    });

    it('extends the billing period by one year for yearly plans', () => {
      const subscription = aSubscription({
        plan: aPlan({ interval: 'YEARLY' }),
        now: '2026-06-01T00:00:00.000Z',
      });

      subscription.completeRenewal(subscription.nextPeriod);

      expect(periodOf(subscription)).toEqual({
        start: '2027-06-01T00:00:00.000Z',
        end: '2028-06-01T00:00:00.000Z',
      });
    });

    it('keeps month-end anchoring across renewals', () => {
      const subscription = aSubscription({ now: '2026-01-31T00:00:00.000Z' });
      const ends: string[] = [];
      for (let i = 0; i < 3; i += 1) {
        subscription.completeRenewal(subscription.nextPeriod);
        ends.push(subscription.currentPeriod.end.toISOString());
      }

      expect(ends).toEqual([
        '2026-03-31T00:00:00.000Z',
        '2026-04-30T00:00:00.000Z',
        '2026-05-31T00:00:00.000Z',
      ]);
    });

    it('reactivates a past-due subscription', () => {
      const subscription = pastDueSubscription();

      subscription.completeRenewal(subscription.nextPeriod);

      expect(subscription.status).toBe(SubscriptionStatus.ACTIVE);
    });

    it('only accepts the period immediately after the current one', () => {
      const subscription = aSubscription({ now: '2026-01-15T10:00:00.000Z' });
      const wrongPeriod = BillingPeriod.of(
        at('2026-03-15T10:00:00.000Z'),
        at('2026-04-15T10:00:00.000Z'),
      );

      expect(() => subscription.completeRenewal(wrongPeriod)).toThrow(InvalidBillingPeriodError);
      expect(periodOf(subscription).start).toBe('2026-01-15T10:00:00.000Z');
    });
  });

  describe('failed renewal', () => {
    it('marks the subscription past due without extending the billing period', () => {
      const subscription = aSubscription({ now: '2026-01-15T10:00:00.000Z' });
      const before = periodOf(subscription);

      const status = subscription.recordFailedRenewal(1);

      expect(status).toBe(SubscriptionStatus.PAST_DUE);
      expect(periodOf(subscription)).toEqual(before);
    });

    it('stays past due while retries remain', () => {
      const subscription = pastDueSubscription();

      expect(subscription.recordFailedRenewal(MAX_FAILED_RENEWAL_ATTEMPTS - 1)).toBe(
        SubscriptionStatus.PAST_DUE,
      );
    });

    it('expires once the maximum number of failed attempts is reached', () => {
      const subscription = pastDueSubscription();

      expect(subscription.recordFailedRenewal(MAX_FAILED_RENEWAL_ATTEMPTS)).toBe(
        SubscriptionStatus.EXPIRED,
      );
    });

    it.each([
      [
        'canceled',
        (): Subscription => {
          const s = aSubscription();
          s.cancel(at('2026-01-20T00:00:00.000Z'));
          return s;
        },
      ],
      ['expired', expiredSubscription],
    ])('cannot record a failed renewal for a %s subscription', (_label, build) => {
      expect(() => build().recordFailedRenewal(1)).toThrow(InvalidSubscriptionTransitionError);
    });
  });

  it('round-trips through its snapshot', () => {
    const subscription = aSubscription();
    subscription.completeRenewal(subscription.nextPeriod);
    subscription.cancel(at('2026-03-01T00:00:00.000Z'));

    const restored = Subscription.restore(subscription.toSnapshot());

    expect(restored.toSnapshot()).toEqual(subscription.toSnapshot());
    expect(periodOf(restored)).toEqual(periodOf(subscription));
  });
});
