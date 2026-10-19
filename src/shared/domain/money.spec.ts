import { InvalidAmountError, InvalidCurrencyError, Money } from './money.js';

describe('Money', () => {
  it('stores an integer amount of minor units with its currency', () => {
    const money = Money.of(1999, 'USD');

    expect(money.amountMinor).toBe(1999);
    expect(money.currency).toBe('USD');
  });

  it('accepts zero (free plans)', () => {
    expect(Money.of(0, 'EUR').amountMinor).toBe(0);
  });

  it.each([-1, -1999])('rejects negative amount %p', (amount) => {
    expect(() => Money.of(amount, 'USD')).toThrow(InvalidAmountError);
  });

  it.each([19.99, 0.5, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1])(
    'rejects non-integer or unsafe amount %p',
    (amount) => {
      expect(() => Money.of(amount, 'USD')).toThrow(InvalidAmountError);
    },
  );

  it.each(['usd', 'US', 'USDT', 'U5D', '', ' USD'])('rejects invalid currency code %p', (code) => {
    expect(() => Money.of(100, code)).toThrow(InvalidCurrencyError);
  });

  it('compares by value', () => {
    expect(Money.of(100, 'USD').equals(Money.of(100, 'USD'))).toBe(true);
    expect(Money.of(100, 'USD').equals(Money.of(100, 'EUR'))).toBe(false);
    expect(Money.of(100, 'USD').equals(Money.of(101, 'USD'))).toBe(false);
  });
});
