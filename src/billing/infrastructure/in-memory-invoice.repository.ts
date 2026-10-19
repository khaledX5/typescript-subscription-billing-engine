import { Injectable } from '@nestjs/common';
import type { BillingPeriod } from '../../shared/domain/billing-period.js';
import { DuplicateInvoiceError } from '../domain/invoice.errors.js';
import { Invoice } from '../domain/invoice.js';
import type { InvoiceRepository } from '../domain/invoice.repository.js';
import type { InvoiceSnapshot } from '../domain/invoice.types.js';

function periodKey(subscriptionId: string, periodStart: Date): string {
  return `${subscriptionId}|${periodStart.toISOString()}`;
}

/**
 * Stores snapshots rather than live entities and enforces the
 * (subscriptionId, periodStart) uniqueness constraint. Each method runs synchronously
 * up to its returned promise, so the check-and-insert in `save` is atomic within this process.
 */
@Injectable()
export class InMemoryInvoiceRepository implements InvoiceRepository {
  private readonly rows = new Map<string, InvoiceSnapshot>();
  private readonly idsByPeriod = new Map<string, string>();

  findBySubscriptionAndPeriod(
    subscriptionId: string,
    period: BillingPeriod,
  ): Promise<Invoice | undefined> {
    const id = this.idsByPeriod.get(periodKey(subscriptionId, period.start));
    const row = id === undefined ? undefined : this.rows.get(id);
    return Promise.resolve(row ? Invoice.restore(row) : undefined);
  }

  findBySubscriptionId(subscriptionId: string): Promise<Invoice[]> {
    const invoices = [...this.rows.values()]
      .filter((row) => row.subscriptionId === subscriptionId)
      .sort((a, b) => a.periodStart.getTime() - b.periodStart.getTime())
      .map((row) => Invoice.restore(row));
    return Promise.resolve(invoices);
  }

  save(invoice: Invoice): Promise<void> {
    const key = periodKey(invoice.subscriptionId, invoice.period.start);
    const existingId = this.idsByPeriod.get(key);
    if (existingId !== undefined && existingId !== invoice.id) {
      return Promise.reject(
        new DuplicateInvoiceError(invoice.subscriptionId, invoice.period.start),
      );
    }
    this.idsByPeriod.set(key, invoice.id);
    this.rows.set(invoice.id, invoice.toSnapshot());
    return Promise.resolve();
  }
}
