import { Module } from '@nestjs/common';
import { PlansModule } from '../plans/plans.module.js';
import { CancelSubscriptionUseCase } from './application/cancel-subscription.use-case.js';
import { CreateSubscriptionUseCase } from './application/create-subscription.use-case.js';
import { GetSubscriptionUseCase } from './application/get-subscription.use-case.js';
import { SUBSCRIPTION_REPOSITORY } from './domain/subscription.repository.js';
import { InMemorySubscriptionRepository } from './infrastructure/in-memory-subscription.repository.js';
import { SubscriptionsController } from './presentation/subscriptions.controller.js';

@Module({
  imports: [PlansModule],
  controllers: [SubscriptionsController],
  providers: [
    CreateSubscriptionUseCase,
    GetSubscriptionUseCase,
    CancelSubscriptionUseCase,
    { provide: SUBSCRIPTION_REPOSITORY, useClass: InMemorySubscriptionRepository },
  ],
  exports: [GetSubscriptionUseCase, SUBSCRIPTION_REPOSITORY],
})
export class SubscriptionsModule {}
