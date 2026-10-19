import { Inject, Injectable } from '@nestjs/common';
import type { Plan } from '../domain/plan.js';
import { PLAN_REPOSITORY, type PlanRepository } from '../domain/plan.repository.js';

@Injectable()
export class ListPlansUseCase {
  constructor(@Inject(PLAN_REPOSITORY) private readonly plans: PlanRepository) {}

  execute(): Promise<Plan[]> {
    return this.plans.findAll();
  }
}
