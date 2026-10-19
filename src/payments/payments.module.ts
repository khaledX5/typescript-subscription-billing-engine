import { Module } from '@nestjs/common';
import { PAYMENT_GATEWAY } from './domain/payment-gateway.js';
import { FakePaymentGateway } from './infrastructure/fake-payment-gateway.js';

/** Swap `useClass` for a real provider adapter without touching any billing code. */
@Module({
  providers: [{ provide: PAYMENT_GATEWAY, useClass: FakePaymentGateway }],
  exports: [PAYMENT_GATEWAY],
})
export class PaymentsModule {}
