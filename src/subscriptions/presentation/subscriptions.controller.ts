import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { CancelSubscriptionUseCase } from '../application/cancel-subscription.use-case.js';
import { CreateSubscriptionUseCase } from '../application/create-subscription.use-case.js';
import { GetSubscriptionUseCase } from '../application/get-subscription.use-case.js';
import { CreateSubscriptionDto } from './dto/create-subscription.dto.js';
import { toSubscriptionResponse, type SubscriptionResponse } from './subscription.response.js';

@Controller('subscriptions')
export class SubscriptionsController {
  constructor(
    private readonly createSubscription: CreateSubscriptionUseCase,
    private readonly getSubscription: GetSubscriptionUseCase,
    private readonly cancelSubscription: CancelSubscriptionUseCase,
  ) {}

  @Post()
  async create(@Body() dto: CreateSubscriptionDto): Promise<SubscriptionResponse> {
    return toSubscriptionResponse(await this.createSubscription.execute(dto));
  }

  @Get(':id')
  async get(@Param('id') id: string): Promise<SubscriptionResponse> {
    return toSubscriptionResponse(await this.getSubscription.execute(id));
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  async cancel(@Param('id') id: string): Promise<SubscriptionResponse> {
    return toSubscriptionResponse(await this.cancelSubscription.execute(id));
  }
}
