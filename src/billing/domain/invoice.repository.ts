import type { BillingPeriod } from '../../shared/domain/billing-period.js';
import type { Invoice } from './invoice.js';

export interface InvoiceRepository {
  findBySubscriptionAndPeriod(
    subscriptionId: string,
    period: BillingPeriod,
  ): Promise<Invoice | undefined>;
  /** Ordered by billing period start, oldest first. */
  findBySubscriptionId(subscriptionId: string): Promise<Invoice[]>;
  /**
   * Inserts or updates by invoice ID. Implementations must reject a *new* invoice whose
   * (subscriptionId, period start) is already taken with `DuplicateInvoiceError`; this is the
   * uniqueness guarantee renewal idempotency relies on (a unique index in a real database).
   */
  save(invoice: Invoice): Promise<void>;
}

export const INVOICE_REPOSITORY = Symbol('InvoiceRepository');
