import { Inject, Injectable } from '@nestjs/common';
import type { Plan } from '../domain/plan.js';
import { PlanNotFoundError } from '../domain/plan.errors.js';
import { PLAN_REPOSITORY, type PlanRepository } from '../domain/plan.repository.js';

@Injectable()
export class GetPlanUseCase {
  constructor(@Inject(PLAN_REPOSITORY) private readonly plans: PlanRepository) {}

  async execute(planId: string): Promise<Plan> {
    const plan = await this.plans.findById(planId);
    if (!plan) {
      throw new PlanNotFoundError(planId);
    }
    return plan;
  }
}
