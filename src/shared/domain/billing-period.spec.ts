import {
  addBillingIntervals,
  BillingInterval,
  BillingPeriod,
  InvalidBillingPeriodError,
} from './billing-period.js';

const utc = (iso: string): Date => new Date(iso);
const iso = (date: Date): string => date.toISOString();

describe('addBillingIntervals', () => {
  describe('monthly', () => {
    it('adds one calendar month, preserving day and time of day', () => {
      expect(iso(addBillingIntervals(utc('2026-01-15T10:30:00.000Z'), 'MONTHLY', 1))).toBe(
        '2026-02-15T10:30:00.000Z',
      );
    });

    it('rolls over into the next year', () => {
      expect(iso(addBillingIntervals(utc('2026-12-10T00:00:00.000Z'), 'MONTHLY', 1))).toBe(
        '2027-01-10T00:00:00.000Z',
      );
    });

    it('clamps to the last day of a shorter month', () => {
      expect(iso(addBillingIntervals(utc('2026-01-31T08:00:00.000Z'), 'MONTHLY', 1))).toBe(
        '2026-02-28T08:00:00.000Z',
      );
      expect(iso(addBillingIntervals(utc('2026-03-31T08:00:00.000Z'), 'MONTHLY', 1))).toBe(
        '2026-04-30T08:00:00.000Z',
      );
    });

    it('clamps to Feb 29 in a leap year', () => {
      expect(iso(addBillingIntervals(utc('2028-01-31T00:00:00.000Z'), 'MONTHLY', 1))).toBe(
        '2028-02-29T00:00:00.000Z',
      );
    });

    it('does not drift: boundaries are computed from the anchor, not the previous boundary', () => {
      const anchor = utc('2026-01-31T00:00:00.000Z');
      const boundaries = [1, 2, 3, 4].map((n) => iso(addBillingIntervals(anchor, 'MONTHLY', n)));

      expect(boundaries).toEqual([
        '2026-02-28T00:00:00.000Z',
        '2026-03-31T00:00:00.000Z',
        '2026-04-30T00:00:00.000Z',
        '2026-05-31T00:00:00.000Z',
      ]);
    });

    it('returns the anchor itself for zero intervals', () => {
      expect(iso(addBillingIntervals(utc('2026-05-05T05:05:05.005Z'), 'MONTHLY', 0))).toBe(
        '2026-05-05T05:05:05.005Z',
      );
    });
  });

  describe('yearly', () => {
    it('adds one calendar year', () => {
      expect(iso(addBillingIntervals(utc('2026-06-01T12:00:00.000Z'), 'YEARLY', 1))).toBe(
        '2027-06-01T12:00:00.000Z',
      );
    });

    it('clamps Feb 29 to Feb 28 in non-leap years and restores it in the next leap year', () => {
      const anchor = utc('2028-02-29T00:00:00.000Z');

      expect(iso(addBillingIntervals(anchor, 'YEARLY', 1))).toBe('2029-02-28T00:00:00.000Z');
      expect(iso(addBillingIntervals(anchor, 'YEARLY', 3))).toBe('2031-02-28T00:00:00.000Z');
      expect(iso(addBillingIntervals(anchor, 'YEARLY', 4))).toBe('2032-02-29T00:00:00.000Z');
    });
  });

  describe('UTC handling', () => {
    it('uses the UTC calendar date, regardless of the offset the input was written in', () => {
      // 23:30 on Jan 31 at UTC-05:00 is already Feb 1 in UTC.
      const anchor = new Date('2026-01-31T23:30:00-05:00');

      expect(iso(anchor)).toBe('2026-02-01T04:30:00.000Z');
      expect(iso(addBillingIntervals(anchor, 'MONTHLY', 1))).toBe('2026-03-01T04:30:00.000Z');
    });

    it('treats the last UTC day of a month as the clamping reference', () => {
      // 20:00 on Jan 31 at UTC+05:00 is still Jan 31 in UTC.
      const anchor = new Date('2026-02-01T01:00:00+05:00');

      expect(iso(anchor)).toBe('2026-01-31T20:00:00.000Z');
      expect(iso(addBillingIntervals(anchor, 'MONTHLY', 1))).toBe('2026-02-28T20:00:00.000Z');
    });
  });

  it.each([-1, 1.5])('rejects an invalid interval count %p', (count) => {
    expect(() => addBillingIntervals(utc('2026-01-01T00:00:00.000Z'), 'MONTHLY', count)).toThrow(
      InvalidBillingPeriodError,
    );
  });
});

describe('BillingPeriod', () => {
  it('rejects an end that is not after the start', () => {
    const instant = utc('2026-01-01T00:00:00.000Z');

    expect(() => BillingPeriod.of(instant, instant)).toThrow(InvalidBillingPeriodError);
    expect(() => BillingPeriod.of(utc('2026-02-01T00:00:00.000Z'), instant)).toThrow(
      InvalidBillingPeriodError,
    );
  });

  it('rejects invalid dates', () => {
    expect(() => BillingPeriod.of(new Date('nope'), utc('2026-01-01T00:00:00.000Z'))).toThrow(
      InvalidBillingPeriodError,
    );
  });

  it('builds the n-th period of an anchored schedule', () => {
    const period = BillingPeriod.forCycle(
      utc('2026-01-31T00:00:00.000Z'),
      BillingInterval.MONTHLY,
      1,
    );

    expect(iso(period.start)).toBe('2026-02-28T00:00:00.000Z');
    expect(iso(period.end)).toBe('2026-03-31T00:00:00.000Z');
  });

  it('is half-open: it has ended exactly at its end instant', () => {
    const period = BillingPeriod.of(
      utc('2026-01-01T00:00:00.000Z'),
      utc('2026-02-01T00:00:00.000Z'),
    );

    expect(period.hasEndedAt(utc('2026-01-31T23:59:59.999Z'))).toBe(false);
    expect(period.hasEndedAt(utc('2026-02-01T00:00:00.000Z'))).toBe(true);
  });

  it('cannot be mutated through the dates it returns', () => {
    const period = BillingPeriod.of(
      utc('2026-01-01T00:00:00.000Z'),
      utc('2026-02-01T00:00:00.000Z'),
    );
    period.start.setUTCFullYear(1999);

    expect(iso(period.start)).toBe('2026-01-01T00:00:00.000Z');
  });

  it('compares by value', () => {
    const a = BillingPeriod.of(utc('2026-01-01T00:00:00Z'), utc('2026-02-01T00:00:00Z'));
    const b = BillingPeriod.of(utc('2026-01-01T00:00:00Z'), utc('2026-02-01T00:00:00Z'));
    const c = BillingPeriod.of(utc('2026-01-01T00:00:00Z'), utc('2026-03-01T00:00:00Z'));

    expect(a.equals(b)).toBe(true);
    expect(a.equals(c)).toBe(false);
  });
});
