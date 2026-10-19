import type { PaymentResult } from '../../payments/domain/payment-result.js';
import { BillingPeriod } from '../../shared/domain/billing-period.js';
import { Money } from '../../shared/domain/money.js';
import { InvoiceAlreadyPaidError } from './invoice.errors.js';
import { Invoice } from './invoice.js';
import { InvoiceStatus } from './invoice.types.js';

const at = (iso: string): Date => new Date(iso);
const succeeded: PaymentResult = { status: 'SUCCEEDED', transactionId: 'txn_1' };
const declined: PaymentResult = {
  status: 'FAILED',
  failureCode: 'CARD_DECLINED',
  failureMessage: 'Declined',
};

function anInvoice(): Invoice {
  return Invoice.issue({
    id: 'inv_1',
    subscriptionId: 'sub_1',
    period: BillingPeriod.of(at('2026-02-15T10:00:00.000Z'), at('2026-03-15T10:00:00.000Z')),
    amountDue: Money.of(1999, 'USD'),
    now: at('2026-02-15T10:00:00.000Z'),
  });
}

describe('Invoice', () => {
  it('is issued as pending with the price snapshot for its period', () => {
    const invoice = anInvoice();

    expect(invoice.status).toBe(InvoiceStatus.PENDING);
    expect(invoice.amountDue).toEqual(Money.of(1999, 'USD'));
    expect(invoice.period.start.toISOString()).toBe('2026-02-15T10:00:00.000Z');
    expect(invoice.period.end.toISOString()).toBe('2026-03-15T10:00:00.000Z');
    expect(invoice.createdAt.toISOString()).toBe('2026-02-15T10:00:00.000Z');
    expect(invoice.paidAt).toBeNull();
    expect(invoice.paymentAttempts).toEqual([]);
  });

  it('is marked paid after a successful payment', () => {
    const invoice = anInvoice();

    invoice.recordPayment(succeeded, at('2026-02-15T10:00:01.000Z'));

    expect(invoice.status).toBe(InvoiceStatus.PAID);
    expect(invoice.isPaid).toBe(true);
    expect(invoice.paidAt?.toISOString()).toBe('2026-02-15T10:00:01.000Z');
    expect(invoice.paymentAttempts).toEqual([
      {
        attemptNumber: 1,
        attemptedAt: at('2026-02-15T10:00:01.000Z'),
        outcome: 'SUCCEEDED',
        transactionId: 'txn_1',
      },
    ]);
  });

  it('is marked failed, not paid, after a failed payment', () => {
    const invoice = anInvoice();

    invoice.recordPayment(declined, at('2026-02-15T10:00:01.000Z'));

    expect(invoice.status).toBe(InvoiceStatus.FAILED);
    expect(invoice.isPaid).toBe(false);
    expect(invoice.paidAt).toBeNull();
    expect(invoice.failedAttemptCount).toBe(1);
    expect(invoice.paymentAttempts[0]).toMatchObject({
      outcome: 'FAILED',
      failureCode: 'CARD_DECLINED',
    });
  });

  it('can be paid by a retry after a failed attempt', () => {
    const invoice = anInvoice();
    invoice.recordPayment(declined, at('2026-02-15T10:00:00.000Z'));

    invoice.recordPayment(succeeded, at('2026-02-16T10:00:00.000Z'));

    expect(invoice.status).toBe(InvoiceStatus.PAID);
    expect(invoice.paymentAttempts.map((a) => a.attemptNumber)).toEqual([1, 2]);
    expect(invoice.failedAttemptCount).toBe(1);
  });

  it.each([
    ['paid', succeeded],
    ['failed', declined],
  ])('cannot record a %s payment once already paid', (_label, result) => {
    const invoice = anInvoice();
    invoice.recordPayment(succeeded, at('2026-02-15T10:00:00.000Z'));

    expect(() => invoice.recordPayment(result, at('2026-02-15T11:00:00.000Z'))).toThrow(
      InvoiceAlreadyPaidError,
    );
    expect(invoice.paymentAttempts).toHaveLength(1);
    expect(invoice.status).toBe(InvoiceStatus.PAID);
  });

  it('derives a new idempotency key only after an attempt is recorded', () => {
    const invoice = anInvoice();
    expect(invoice.nextPaymentIdempotencyKey).toBe('inv_1:attempt-1');
    expect(invoice.nextPaymentIdempotencyKey).toBe('inv_1:attempt-1');

    invoice.recordPayment(declined, at('2026-02-15T10:00:00.000Z'));

    expect(invoice.nextPaymentIdempotencyKey).toBe('inv_1:attempt-2');
  });

  it('does not expose its attempt history for mutation', () => {
    const invoice = anInvoice();
    invoice.recordPayment(declined, at('2026-02-15T10:00:00.000Z'));

    invoice.paymentAttempts[0]?.attemptedAt.setUTCFullYear(1999);

    expect(invoice.paymentAttempts[0]?.attemptedAt.toISOString()).toBe('2026-02-15T10:00:00.000Z');
  });

  it('round-trips through its snapshot', () => {
    const invoice = anInvoice();
    invoice.recordPayment(declined, at('2026-02-15T10:00:00.000Z'));
    invoice.recordPayment(succeeded, at('2026-02-16T10:00:00.000Z'));

    expect(Invoice.restore(invoice.toSnapshot()).toSnapshot()).toEqual(invoice.toSnapshot());
  });
});
