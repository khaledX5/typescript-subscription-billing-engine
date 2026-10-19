import { Injectable } from '@nestjs/common';

/**
 * Source of the current time. Application services ask the clock for "now" and pass it to
 * the domain explicitly, so business rules never read the system time themselves and tests
 * can control time precisely.
 */
export interface Clock {
  now(): Date;
}

export const CLOCK = Symbol('Clock');

@Injectable()
export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }
}
