import { Inject, Injectable, Logger } from '@nestjs/common';
import { PAYMENT_GATEWAY, type PaymentGateway } from '../../payments/domain/payment-gateway.js';
import { CLOCK, type Clock } from '../../shared/clock.js';
import type { BillingPeriod } from '../../shared/domain/billing-period.js';
import { ID_GENERATOR, type IdGenerator } from '../../shared/id-generator.js';
import { GetSubscriptionUseCase } from '../../subscriptions/application/get-subscription.use-case.js';
import type { Subscription } from '../../subscriptions/domain/subscription.js';
import {
  SUBSCRIPTION_REPOSITORY,
  type SubscriptionRepository,
} from '../../subscriptions/domain/subscription.repository.js';
import { Invoice } from '../domain/invoice.js';
import { INVOICE_REPOSITORY, type InvoiceRepository } from '../domain/invoice.repository.js';

export type RenewalOutcome = 'RENEWED' | 'PAYMENT_FAILED';

export interface RenewalResult {
  readonly outcome: RenewalOutcome;
  readonly subscription: Subscription;
  readonly invoice: Invoice;
}

/**
 * Bills the next period of a subscription whose current period has ended.
 *
 * Idempotency and failure guarantees:
 * - exactly one invoice per (subscription, period): an existing invoice is reused, and the
 *   repository rejects a concurrent duplicate insert;
 * - the invoice is persisted *before* charging, so a failure to save it means no charge;
 * - charge attempts use a key derived from the invoice and attempt number, so retrying after a
 *   crash between "charged" and "saved" does not charge twice;
 * - if the invoice is already paid (a previous run failed after payment), the renewal is
 *   completed without charging again;
 * - a failed payment never extends the billing period;
 * - success is only reported after both the invoice and the subscription were saved.
 */
@Injectable()
export class ProcessRenewalUseCase {
  private readonly logger = new Logger(ProcessRenewalUseCase.name);

  constructor(
    private readonly getSubscription: GetSubscriptionUseCase,
    @Inject(SUBSCRIPTION_REPOSITORY) private readonly subscriptions: SubscriptionRepository,
    @Inject(INVOICE_REPOSITORY) private readonly invoices: InvoiceRepository,
    @Inject(PAYMENT_GATEWAY) private readonly payments: PaymentGateway,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute(subscriptionId: string): Promise<RenewalResult> {
    const subscription = await this.getSubscription.execute(subscriptionId);
    const now = this.clock.now();
    subscription.ensureRenewable(now);

    const period = subscription.nextPeriod;
    const invoice = await this.findOrIssueInvoice(subscription, period, now);

    if (invoice.isPaid) {
      subscription.completeRenewal(period);
      await this.subscriptions.save(subscription);
      this.logger.warn(
        `Renewal completed from an already-paid invoice without charging again: subscriptionId=${subscription.id} invoiceId=${invoice.id}`,
      );
      return { outcome: 'RENEWED', subscription, invoice };
    }

    this.logger.log(
      `Renewal attempt: subscriptionId=${subscription.id} invoiceId=${invoice.id} periodStart=${period.start.toISOString()}`,
    );
    const payment = await this.payments.charge({
      idempotencyKey: invoice.nextPaymentIdempotencyKey,
      customerId: subscription.customerId,
      amount: invoice.amountDue,
      reference: invoice.id,
    });
    invoice.recordPayment(payment, now);
    await this.invoices.save(invoice);

    if (payment.status === 'SUCCEEDED') {
      subscription.completeRenewal(period);
      await this.subscriptions.save(subscription);
      this.logger.log(
        `Payment succeeded, subscription renewed: subscriptionId=${subscription.id} invoiceId=${invoice.id}`,
      );
      return { outcome: 'RENEWED', subscription, invoice };
    }

    const status = subscription.recordFailedRenewal(invoice.failedAttemptCount);
    await this.subscriptions.save(subscription);
    this.logger.warn(
      `Payment failed: subscriptionId=${subscription.id} invoiceId=${invoice.id} failureCode=${payment.failureCode} attempts=${invoice.failedAttemptCount} status=${status}`,
    );
    return { outcome: 'PAYMENT_FAILED', subscription, invoice };
  }

  private async findOrIssueInvoice(
    subscription: Subscription,
    period: BillingPeriod,
    now: Date,
  ): Promise<Invoice> {
    const existing = await this.invoices.findBySubscriptionAndPeriod(subscription.id, period);
    if (existing) {
      return existing;
    }
    const invoice = Invoice.issue({
      id: this.ids.generate('inv'),
      subscriptionId: subscription.id,
      period,
      amountDue: subscription.price,
      now,
    });
    await this.invoices.save(invoice);
    return invoice;
  }
}
