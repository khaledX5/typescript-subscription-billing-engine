import { Module } from '@nestjs/common';
import { CreatePlanUseCase } from './application/create-plan.use-case.js';
import { DeactivatePlanUseCase } from './application/deactivate-plan.use-case.js';
import { GetPlanUseCase } from './application/get-plan.use-case.js';
import { ListPlansUseCase } from './application/list-plans.use-case.js';
import { PLAN_REPOSITORY } from './domain/plan.repository.js';
import { InMemoryPlanRepository } from './infrastructure/in-memory-plan.repository.js';
import { PlansController } from './presentation/plans.controller.js';

@Module({
  controllers: [PlansController],
  providers: [
    CreatePlanUseCase,
    GetPlanUseCase,
    ListPlansUseCase,
    DeactivatePlanUseCase,
    { provide: PLAN_REPOSITORY, useClass: InMemoryPlanRepository },
  ],
  exports: [GetPlanUseCase],
})
export class PlansModule {}
