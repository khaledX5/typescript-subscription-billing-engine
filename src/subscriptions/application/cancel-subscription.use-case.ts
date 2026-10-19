import { Inject, Injectable, Logger } from '@nestjs/common';
import { CLOCK, type Clock } from '../../shared/clock.js';
import type { Subscription } from '../domain/subscription.js';
import {
  SUBSCRIPTION_REPOSITORY,
  type SubscriptionRepository,
} from '../domain/subscription.repository.js';
import { GetSubscriptionUseCase } from './get-subscription.use-case.js';

@Injectable()
export class CancelSubscriptionUseCase {
  private readonly logger = new Logger(CancelSubscriptionUseCase.name);

  constructor(
    private readonly getSubscription: GetSubscriptionUseCase,
    @Inject(SUBSCRIPTION_REPOSITORY) private readonly subscriptions: SubscriptionRepository,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  /** Idempotent: cancelling an already-canceled subscription returns it unchanged. */
  async execute(subscriptionId: string): Promise<Subscription> {
    const subscription = await this.getSubscription.execute(subscriptionId);
    const outcome = subscription.cancel(this.clock.now());

    if (outcome === 'CANCELED') {
      await this.subscriptions.save(subscription);
      this.logger.log(`Subscription canceled: subscriptionId=${subscription.id}`);
    }
    return subscription;
  }
}
