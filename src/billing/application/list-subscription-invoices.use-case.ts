import { Inject, Injectable } from '@nestjs/common';
import { GetSubscriptionUseCase } from '../../subscriptions/application/get-subscription.use-case.js';
import type { Invoice } from '../domain/invoice.js';
import { INVOICE_REPOSITORY, type InvoiceRepository } from '../domain/invoice.repository.js';

@Injectable()
export class ListSubscriptionInvoicesUseCase {
  constructor(
    private readonly getSubscription: GetSubscriptionUseCase,
    @Inject(INVOICE_REPOSITORY) private readonly invoices: InvoiceRepository,
  ) {}

  /** Throws SubscriptionNotFoundError for unknown subscriptions instead of returning []. */
  async execute(subscriptionId: string): Promise<Invoice[]> {
    const subscription = await this.getSubscription.execute(subscriptionId);
    return this.invoices.findBySubscriptionId(subscription.id);
  }
}
