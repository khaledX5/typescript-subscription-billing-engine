import {
  assertTransition,
  isRenewable,
  MAX_FAILED_RENEWAL_ATTEMPTS,
  statusAfterFailedRenewal,
} from './subscription-policy.js';
import { InvalidSubscriptionTransitionError } from './subscription.errors.js';
import type { SubscriptionStatus } from './subscription.types.js';

describe('subscription policy', () => {
  it.each<[SubscriptionStatus, SubscriptionStatus]>([
    ['ACTIVE', 'PAST_DUE'],
    ['ACTIVE', 'CANCELED'],
    ['PAST_DUE', 'ACTIVE'],
    ['PAST_DUE', 'CANCELED'],
    ['PAST_DUE', 'EXPIRED'],
  ])('allows %s -> %s', (from, to) => {
    expect(() => assertTransition(from, to, 'test')).not.toThrow();
  });

  it.each<[SubscriptionStatus, SubscriptionStatus]>([
    ['ACTIVE', 'EXPIRED'],
    ['CANCELED', 'ACTIVE'],
    ['CANCELED', 'PAST_DUE'],
    ['EXPIRED', 'ACTIVE'],
    ['EXPIRED', 'CANCELED'],
  ])('rejects %s -> %s', (from, to) => {
    expect(() => assertTransition(from, to, 'test')).toThrow(InvalidSubscriptionTransitionError);
  });

  it('only allows renewing active and past-due subscriptions', () => {
    expect(isRenewable('ACTIVE')).toBe(true);
    expect(isRenewable('PAST_DUE')).toBe(true);
    expect(isRenewable('CANCELED')).toBe(false);
    expect(isRenewable('EXPIRED')).toBe(false);
  });

  it('expires after the maximum number of failed attempts', () => {
    expect(statusAfterFailedRenewal(1)).toBe('PAST_DUE');
    expect(statusAfterFailedRenewal(MAX_FAILED_RENEWAL_ATTEMPTS - 1)).toBe('PAST_DUE');
    expect(statusAfterFailedRenewal(MAX_FAILED_RENEWAL_ATTEMPTS)).toBe('EXPIRED');
  });
});
