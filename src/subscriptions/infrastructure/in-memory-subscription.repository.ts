import { Injectable } from '@nestjs/common';
import { Subscription } from '../domain/subscription.js';
import type { SubscriptionRepository } from '../domain/subscription.repository.js';
import type { SubscriptionSnapshot } from '../domain/subscription.types.js';

/** Stores snapshots rather than live entities; see InMemoryPlanRepository. */
@Injectable()
export class InMemorySubscriptionRepository implements SubscriptionRepository {
  private readonly rows = new Map<string, SubscriptionSnapshot>();

  findById(id: string): Promise<Subscription | undefined> {
    const row = this.rows.get(id);
    return Promise.resolve(row ? Subscription.restore(row) : undefined);
  }

  save(subscription: Subscription): Promise<void> {
    this.rows.set(subscription.id, subscription.toSnapshot());
    return Promise.resolve();
  }
}
