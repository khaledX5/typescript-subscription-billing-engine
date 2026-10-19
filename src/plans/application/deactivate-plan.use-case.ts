import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Plan } from '../domain/plan.js';
import { PLAN_REPOSITORY, type PlanRepository } from '../domain/plan.repository.js';
import { GetPlanUseCase } from './get-plan.use-case.js';

@Injectable()
export class DeactivatePlanUseCase {
  private readonly logger = new Logger(DeactivatePlanUseCase.name);

  constructor(
    private readonly getPlan: GetPlanUseCase,
    @Inject(PLAN_REPOSITORY) private readonly plans: PlanRepository,
  ) {}

  async execute(planId: string): Promise<Plan> {
    const plan = await this.getPlan.execute(planId);
    if (plan.isActive) {
      plan.deactivate();
      await this.plans.save(plan);
      this.logger.log(`Plan deactivated: planId=${plan.id}`);
    }
    return plan;
  }
}
