import type { Clock } from '../../src/shared/clock.js';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Manually controlled clock for deterministic tests. */
export class FakeClock implements Clock {
  private current: Date;

  constructor(initial: Date | string = '2026-01-15T10:00:00.000Z') {
    this.current = new Date(initial);
  }

  now(): Date {
    return new Date(this.current);
  }

  set(instant: Date | string): void {
    this.current = new Date(instant);
  }

  advanceDays(days: number): void {
    this.current = new Date(this.current.getTime() + days * DAY_MS);
  }
}
