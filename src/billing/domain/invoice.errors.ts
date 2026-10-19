import { DomainError } from '../../shared/domain/domain-error.js';

export class InvoiceAlreadyPaidError extends DomainError {
  readonly code = 'INVOICE_ALREADY_PAID';
  readonly category = 'CONFLICT';

  constructor(invoiceId: string) {
    super(`Invoice ${invoiceId} has already been paid`);
  }
}

export class DuplicateInvoiceError extends DomainError {
  readonly code = 'DUPLICATE_INVOICE';
  readonly category = 'CONFLICT';

  constructor(subscriptionId: string, periodStart: Date) {
    super(
      `An invoice already exists for subscription ${subscriptionId} and the billing period starting ${periodStart.toISOString()}`,
    );
  }
}
