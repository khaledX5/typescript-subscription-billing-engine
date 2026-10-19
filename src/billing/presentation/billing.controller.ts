import { Controller, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { ListSubscriptionInvoicesUseCase } from '../application/list-subscription-invoices.use-case.js';
import { ProcessRenewalUseCase } from '../application/process-renewal.use-case.js';
import {
  toInvoiceResponse,
  toRenewalResponse,
  type InvoiceResponse,
  type RenewalResponse,
} from './invoice.response.js';

/**
 * Billing endpoints nested under the subscription resource. They live in the billing module
 * because renewal is a billing workflow; this keeps module dependencies one-directional
 * (billing -> subscriptions -> plans) with no circular imports.
 */
@Controller('subscriptions/:id')
export class BillingController {
  constructor(
    private readonly processRenewal: ProcessRenewalUseCase,
    private readonly listInvoices: ListSubscriptionInvoicesUseCase,
  ) {}

  /**
   * A declined payment is a business outcome, not a request error: it is answered with 200
   * and `outcome: "PAYMENT_FAILED"` because the attempt was processed and recorded.
   */
  @Post('renew')
  @HttpCode(HttpStatus.OK)
  async renew(@Param('id') id: string): Promise<RenewalResponse> {
    return toRenewalResponse(await this.processRenewal.execute(id));
  }

  @Get('invoices')
  async invoices(@Param('id') id: string): Promise<InvoiceResponse[]> {
    return (await this.listInvoices.execute(id)).map(toInvoiceResponse);
  }
}
