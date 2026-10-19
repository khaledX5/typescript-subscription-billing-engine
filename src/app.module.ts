import { Module } from '@nestjs/common';
import { APP_FILTER, APP_PIPE } from '@nestjs/core';
import { BillingModule } from './billing/billing.module.js';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter.js';
import { createValidationPipe } from './common/validation/create-validation-pipe.js';
import { PlansModule } from './plans/plans.module.js';
import { SharedModule } from './shared/shared.module.js';
import { SubscriptionsModule } from './subscriptions/subscriptions.module.js';

/**
 * The global pipe and filter are registered as providers (not in main.ts) so that every
 * application instance built from this module - including test instances - behaves the same.
 */
@Module({
  imports: [SharedModule, PlansModule, SubscriptionsModule, BillingModule],
  providers: [
    { provide: APP_PIPE, useFactory: createValidationPipe },
    { provide: APP_FILTER, useClass: GlobalExceptionFilter },
  ],
})
export class AppModule {}
