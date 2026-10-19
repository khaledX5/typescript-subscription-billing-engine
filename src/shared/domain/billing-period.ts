import { DomainError } from './domain-error.js';

export const BillingInterval = {
  MONTHLY: 'MONTHLY',
  YEARLY: 'YEARLY',
} as const;
export type BillingInterval = (typeof BillingInterval)[keyof typeof BillingInterval];

export const BILLING_INTERVALS: readonly BillingInterval[] = Object.values(BillingInterval);

const MONTHS_PER_INTERVAL: Record<BillingInterval, number> = {
  MONTHLY: 1,
  YEARLY: 12,
};

export class InvalidBillingPeriodError extends DomainError {
  readonly code = 'INVALID_BILLING_PERIOD';
  readonly category = 'INVALID';

  constructor(reason: string) {
    super(`Invalid billing period: ${reason}`);
  }
}

function daysInUtcMonth(year: number, monthIndex: number): number {
  // Day 0 of the following month is the last day of `monthIndex`.
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

/**
 * Calendar-based date arithmetic, always in UTC.
 *
 * Adds `count` billing intervals to `anchor`. If the anchor's day-of-month does not exist in
 * the target month, the result is clamped to that month's last day (Jan 31 + 1 month = Feb 28,
 * or Feb 29 in a leap year). The time of day is preserved.
 *
 * Every period boundary is computed from the original anchor rather than from the previous
 * boundary, so clamping never accumulates drift: an anchor of Jan 31 yields Feb 28, Mar 31,
 * Apr 30, ... instead of Feb 28, Mar 28, Apr 28, ...
 */
export function addBillingIntervals(anchor: Date, interval: BillingInterval, count: number): Date {
  if (!Number.isSafeInteger(count) || count < 0) {
    throw new InvalidBillingPeriodError(`interval count must be a non-negative integer`);
  }
  const totalMonths = anchor.getUTCMonth() + MONTHS_PER_INTERVAL[interval] * count;
  const year = anchor.getUTCFullYear() + Math.floor(totalMonths / 12);
  const monthIndex = totalMonths % 12;
  const day = Math.min(anchor.getUTCDate(), daysInUtcMonth(year, monthIndex));

  return new Date(
    Date.UTC(
      year,
      monthIndex,
      day,
      anchor.getUTCHours(),
      anchor.getUTCMinutes(),
      anchor.getUTCSeconds(),
      anchor.getUTCMilliseconds(),
    ),
  );
}

/** Immutable half-open time range [start, end). */
export class BillingPeriod {
  private constructor(
    private readonly startMs: number,
    private readonly endMs: number,
  ) {}

  static of(start: Date, end: Date): BillingPeriod {
    const startMs = start.getTime();
    const endMs = end.getTime();
    if (Number.isNaN(startMs) || Number.isNaN(endMs)) {
      throw new InvalidBillingPeriodError('start and end must be valid dates');
    }
    if (endMs <= startMs) {
      throw new InvalidBillingPeriodError('end must be after start');
    }
    return new BillingPeriod(startMs, endMs);
  }

  /** The `cycle`-th period (0-based) of a schedule anchored at `anchor`. */
  static forCycle(anchor: Date, interval: BillingInterval, cycle: number): BillingPeriod {
    return BillingPeriod.of(
      addBillingIntervals(anchor, interval, cycle),
      addBillingIntervals(anchor, interval, cycle + 1),
    );
  }

  /** Returned as fresh Date instances so callers cannot mutate the period. */
  get start(): Date {
    return new Date(this.startMs);
  }

  get end(): Date {
    return new Date(this.endMs);
  }

  hasEndedAt(instant: Date): boolean {
    return instant.getTime() >= this.endMs;
  }

  equals(other: BillingPeriod): boolean {
    return this.startMs === other.startMs && this.endMs === other.endMs;
  }
}
