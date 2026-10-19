import { DomainError } from './domain-error.js';

/** ISO 4217 shape: exactly three uppercase ASCII letters (e.g. USD, EUR, JPY). */
const CURRENCY_CODE_PATTERN = /^[A-Z]{3}$/;

export class InvalidAmountError extends DomainError {
  readonly code = 'INVALID_AMOUNT';
  readonly category = 'INVALID';

  constructor(amountMinor: number) {
    super(`Amount must be a non-negative integer number of minor units, received ${amountMinor}`);
  }
}

export class InvalidCurrencyError extends DomainError {
  readonly code = 'INVALID_CURRENCY';
  readonly category = 'INVALID';

  constructor(currency: string) {
    super(`Currency must be a three-letter uppercase ISO 4217 code, received "${currency}"`);
  }
}

/**
 * Immutable monetary amount stored in minor currency units (cents for USD, yen for JPY)
 * so that arithmetic is exact and totals are deterministic.
 */
export class Money {
  private constructor(
    readonly amountMinor: number,
    readonly currency: string,
  ) {}

  static of(amountMinor: number, currency: string): Money {
    if (!Number.isSafeInteger(amountMinor) || amountMinor < 0) {
      throw new InvalidAmountError(amountMinor);
    }
    if (!CURRENCY_CODE_PATTERN.test(currency)) {
      throw new InvalidCurrencyError(currency);
    }
    return new Money(amountMinor, currency);
  }

  equals(other: Money): boolean {
    return this.amountMinor === other.amountMinor && this.currency === other.currency;
  }
}
