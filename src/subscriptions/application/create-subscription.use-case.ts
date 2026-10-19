import { Inject, Injectable, Logger } from '@nestjs/common';
import { GetPlanUseCase } from '../../plans/application/get-plan.use-case.js';
import { CLOCK, type Clock } from '../../shared/clock.js';
import { ID_GENERATOR, type IdGenerator } from '../../shared/id-generator.js';
import { Subscription } from '../domain/subscription.js';
import {
  SUBSCRIPTION_REPOSITORY,
  type SubscriptionRepository,
} from '../domain/subscription.repository.js';

export interface CreateSubscriptionCommand {
  readonly customerId: string;
  readonly planId: string;
}

@Injectable()
export class CreateSubscriptionUseCase {
  private readonly logger = new Logger(CreateSubscriptionUseCase.name);

  constructor(
    private readonly getPlan: GetPlanUseCase,
    @Inject(SUBSCRIPTION_REPOSITORY) private readonly subscriptions: SubscriptionRepository,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute(command: CreateSubscriptionCommand): Promise<Subscription> {
    const plan = await this.getPlan.execute(command.planId);
    const subscription = Subscription.create({
      id: this.ids.generate('sub'),
      customerId: command.customerId,
      plan,
      now: this.clock.now(),
    });
    await this.subscriptions.save(subscription);
    this.logger.log(`Subscription created: subscriptionId=${subscription.id} planId=${plan.id}`);
    return subscription;
  }
}
