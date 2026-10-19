import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { CreatePlanUseCase } from '../application/create-plan.use-case.js';
import { DeactivatePlanUseCase } from '../application/deactivate-plan.use-case.js';
import { GetPlanUseCase } from '../application/get-plan.use-case.js';
import { ListPlansUseCase } from '../application/list-plans.use-case.js';
import { CreatePlanDto } from './dto/create-plan.dto.js';
import { toPlanResponse, type PlanResponse } from './plan.response.js';

@Controller('plans')
export class PlansController {
  constructor(
    private readonly createPlan: CreatePlanUseCase,
    private readonly getPlan: GetPlanUseCase,
    private readonly listPlans: ListPlansUseCase,
    private readonly deactivatePlan: DeactivatePlanUseCase,
  ) {}

  @Post()
  async create(@Body() dto: CreatePlanDto): Promise<PlanResponse> {
    return toPlanResponse(await this.createPlan.execute(dto));
  }

  @Get()
  async list(): Promise<PlanResponse[]> {
    return (await this.listPlans.execute()).map(toPlanResponse);
  }

  @Get(':id')
  async get(@Param('id') id: string): Promise<PlanResponse> {
    return toPlanResponse(await this.getPlan.execute(id));
  }

  @Post(':id/deactivate')
  @HttpCode(HttpStatus.OK)
  async deactivate(@Param('id') id: string): Promise<PlanResponse> {
    return toPlanResponse(await this.deactivatePlan.execute(id));
  }
}
