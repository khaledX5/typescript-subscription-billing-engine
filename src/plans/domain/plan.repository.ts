import type { Plan } from './plan.js';

export interface PlanRepository {
  findById(id: string): Promise<Plan | undefined>;
  findAll(): Promise<Plan[]>;
  save(plan: Plan): Promise<void>;
}

export const PLAN_REPOSITORY = Symbol('PlanRepository');
