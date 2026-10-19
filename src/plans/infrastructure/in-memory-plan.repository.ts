import { Injectable } from '@nestjs/common';
import { Plan } from '../domain/plan.js';
import type { PlanRepository } from '../domain/plan.repository.js';
import type { PlanSnapshot } from '../domain/plan.types.js';

/**
 * Stores snapshots rather than live entities, so callers can never mutate persisted state
 * without calling `save` - the same semantics a database-backed repository would have.
 */
@Injectable()
export class InMemoryPlanRepository implements PlanRepository {
  private readonly rows = new Map<string, PlanSnapshot>();

  findById(id: string): Promise<Plan | undefined> {
    const row = this.rows.get(id);
    return Promise.resolve(row ? Plan.restore(row) : undefined);
  }

  findAll(): Promise<Plan[]> {
    return Promise.resolve([...this.rows.values()].map((row) => Plan.restore(row)));
  }

  save(plan: Plan): Promise<void> {
    this.rows.set(plan.id, plan.toSnapshot());
    return Promise.resolve();
  }
}
