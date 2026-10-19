import { DomainError } from '../../shared/domain/domain-error.js';

export class PlanNotFoundError extends DomainError {
  readonly code = 'PLAN_NOT_FOUND';
  readonly category = 'NOT_FOUND';

  constructor(planId: string) {
    super(`Plan ${planId} was not found`);
  }
}

export class InactivePlanError extends DomainError {
  readonly code = 'PLAN_INACTIVE';
  readonly category = 'INVALID';

  constructor(planId: string) {
    super(`Plan ${planId} is inactive and cannot be used for new subscriptions`);
  }
}

export class InvalidPlanNameError extends DomainError {
  readonly code = 'INVALID_PLAN_NAME';
  readonly category = 'INVALID';

  constructor(maxLength: number) {
    super(`Plan name must contain between 1 and ${maxLength} non-blank characters`);
  }
}
