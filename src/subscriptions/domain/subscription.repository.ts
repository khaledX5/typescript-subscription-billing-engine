import type { Subscription } from './subscription.js';

export interface SubscriptionRepository {
  findById(id: string): Promise<Subscription | undefined>;
  save(subscription: Subscription): Promise<void>;
}

export const SUBSCRIPTION_REPOSITORY = Symbol('SubscriptionRepository');
