import { InvalidSubscriptionTransitionError } from './subscription.errors.js';
import { SubscriptionStatus } from './subscription.types.js';

/**
 * The complete subscription state machine. Any transition not listed here is rejected.
 *
 *   ACTIVE   -> PAST_DUE  (renewal payment failed)
 *   ACTIVE   -> CANCELED  (customer cancels)
 *   PAST_DUE -> ACTIVE    (retried renewal payment succeeded)
 *   PAST_DUE -> CANCELED  (customer cancels)
 *   PAST_DUE -> EXPIRED   (retries exhausted)
 *   CANCELED, EXPIRED     terminal
 */
const ALLOWED_TRANSITIONS: Record<SubscriptionStatus, readonly SubscriptionStatus[]> = {
  ACTIVE: [SubscriptionStatus.PAST_DUE, SubscriptionStatus.CANCELED],
  PAST_DUE: [SubscriptionStatus.ACTIVE, SubscriptionStatus.CANCELED, SubscriptionStatus.EXPIRED],
  CANCELED: [],
  EXPIRED: [],
};

/** Statuses from which a renewal (or a renewal retry) may be attempted. */
const RENEWABLE_STATUSES: readonly SubscriptionStatus[] = [
  SubscriptionStatus.ACTIVE,
  SubscriptionStatus.PAST_DUE,
];

/**
 * Number of failed payment attempts for a single renewal period after which the
 * subscription expires instead of staying PAST_DUE.
 */
export const MAX_FAILED_RENEWAL_ATTEMPTS = 3;

export function assertTransition(
  from: SubscriptionStatus,
  to: SubscriptionStatus,
  operation: string,
): void {
  if (!ALLOWED_TRANSITIONS[from].includes(to)) {
    throw new InvalidSubscriptionTransitionError(from, operation);
  }
}

export function isRenewable(status: SubscriptionStatus): boolean {
  return RENEWABLE_STATUSES.includes(status);
}

export function statusAfterFailedRenewal(failedAttemptsForPeriod: number): SubscriptionStatus {
  return failedAttemptsForPeriod >= MAX_FAILED_RENEWAL_ATTEMPTS
    ? SubscriptionStatus.EXPIRED
    : SubscriptionStatus.PAST_DUE;
}
