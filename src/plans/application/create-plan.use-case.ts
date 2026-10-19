import { Inject, Injectable, Logger } from '@nestjs/common';
import type { BillingInterval } from '../../shared/domain/billing-period.js';
import { Money } from '../../shared/domain/money.js';
import { ID_GENERATOR, type IdGenerator } from '../../shared/id-generator.js';
import { Plan } from '../domain/plan.js';
import { PLAN_REPOSITORY, type PlanRepository } from '../domain/plan.repository.js';

export interface CreatePlanCommand {
  readonly name: string;
  readonly priceMinor: number;
  readonly currency: string;
  readonly billingInterval: BillingInterval;
}

@Injectable()
export class CreatePlanUseCase {
  private readonly logger = new Logger(CreatePlanUseCase.name);

  constructor(
    @Inject(PLAN_REPOSITORY) private readonly plans: PlanRepository,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
  ) {}

  async execute(command: CreatePlanCommand): Promise<Plan> {
    const plan = Plan.create({
      id: this.ids.generate('plan'),
      name: command.name,
      price: Money.of(command.priceMinor, command.currency),
      billingInterval: command.billingInterval,
    });
    await this.plans.save(plan);
    this.logger.log(`Plan created: planId=${plan.id}`);
    return plan;
  }
}
