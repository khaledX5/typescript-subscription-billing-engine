import { Module } from '@nestjs/common';
import { PaymentsModule } from '../payments/payments.module.js';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module.js';
import { ListSubscriptionInvoicesUseCase } from './application/list-subscription-invoices.use-case.js';
import { ProcessRenewalUseCase } from './application/process-renewal.use-case.js';
import { INVOICE_REPOSITORY } from './domain/invoice.repository.js';
import { InMemoryInvoiceRepository } from './infrastructure/in-memory-invoice.repository.js';
import { BillingController } from './presentation/billing.controller.js';

@Module({
  imports: [SubscriptionsModule, PaymentsModule],
  controllers: [BillingController],
  providers: [
    ProcessRenewalUseCase,
    ListSubscriptionInvoicesUseCase,
    { provide: INVOICE_REPOSITORY, useClass: InMemoryInvoiceRepository },
  ],
})
export class BillingModule {}
