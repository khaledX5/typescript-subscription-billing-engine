import { Inject, Injectable } from '@nestjs/common';
import type { Subscription } from '../domain/subscription.js';
import { SubscriptionNotFoundError } from '../domain/subscription.errors.js';
import {
  SUBSCRIPTION_REPOSITORY,
  type SubscriptionRepository,
} from '../domain/subscription.repository.js';

@Injectable()
export class GetSubscriptionUseCase {
  constructor(
    @Inject(SUBSCRIPTION_REPOSITORY) private readonly subscriptions: SubscriptionRepository,
  ) {}

  async execute(subscriptionId: string): Promise<Subscription> {
    const subscription = await this.subscriptions.findById(subscriptionId);
    if (!subscription) {
      throw new SubscriptionNotFoundError(subscriptionId);
    }
    return subscription;
  }
}
