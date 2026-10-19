import { BillingPeriod } from '../../shared/domain/billing-period.js';
import { Money } from '../../shared/domain/money.js';
import { DuplicateInvoiceError } from '../domain/invoice.errors.js';
import { Invoice } from '../domain/invoice.js';
import { InMemoryInvoiceRepository } from './in-memory-invoice.repository.js';

const january = BillingPeriod.of(
  new Date('2026-01-01T00:00:00Z'),
  new Date('2026-02-01T00:00:00Z'),
);
const february = BillingPeriod.of(
  new Date('2026-02-01T00:00:00Z'),
  new Date('2026-03-01T00:00:00Z'),
);

function invoice(id: string, period: BillingPeriod, subscriptionId = 'sub_1'): Invoice {
  return Invoice.issue({
    id,
    subscriptionId,
    period,
    amountDue: Money.of(1000, 'USD'),
    now: period.start,
  });
}

describe('InMemoryInvoiceRepository', () => {
  it('rejects a second invoice for the same subscription and billing period', async () => {
    const repository = new InMemoryInvoiceRepository();
    await repository.save(invoice('inv_1', january));

    await expect(repository.save(invoice('inv_2', january))).rejects.toThrow(DuplicateInvoiceError);
    expect(await repository.findBySubscriptionId('sub_1')).toHaveLength(1);
  });

  it('allows the same period for different subscriptions', async () => {
    const repository = new InMemoryInvoiceRepository();
    await repository.save(invoice('inv_1', january, 'sub_1'));

    await expect(repository.save(invoice('inv_2', january, 'sub_2'))).resolves.toBeUndefined();
  });

  it('updates an existing invoice in place', async () => {
    const repository = new InMemoryInvoiceRepository();
    const original = invoice('inv_1', january);
    await repository.save(original);
    original.recordPayment({ status: 'SUCCEEDED', transactionId: 'txn_1' }, january.start);

    await repository.save(original);

    expect((await repository.findBySubscriptionAndPeriod('sub_1', january))?.status).toBe('PAID');
  });

  it('returns invoices ordered by period and isolated from later in-memory changes', async () => {
    const repository = new InMemoryInvoiceRepository();
    const feb = invoice('inv_2', february);
    await repository.save(feb);
    await repository.save(invoice('inv_1', january));
    feb.recordPayment({ status: 'SUCCEEDED', transactionId: 'txn_1' }, february.start);

    const stored = await repository.findBySubscriptionId('sub_1');

    expect(stored.map((i) => i.id)).toEqual(['inv_1', 'inv_2']);
    expect(stored[1]?.status).toBe('PENDING');
  });

  it('returns undefined when no invoice exists for a period', async () => {
    expect(
      await new InMemoryInvoiceRepository().findBySubscriptionAndPeriod('sub_1', january),
    ).toBeUndefined();
  });
});
