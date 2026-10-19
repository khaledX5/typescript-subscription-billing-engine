import { DomainError } from '../../shared/domain/domain-error.js';
import type { SubscriptionStatus } from './subscription.types.js';

export class SubscriptionNotFoundError extends DomainError {
  readonly code = 'SUBSCRIPTION_NOT_FOUND';
  readonly category = 'NOT_FOUND';

  constructor(subscriptionId: string) {
    super(`Subscription ${subscriptionId} was not found`);
  }
}

export class InvalidSubscriptionTransitionError extends DomainError {
  readonly code = 'INVALID_SUBSCRIPTION_TRANSITION';
  readonly category = 'CONFLICT';

  constructor(
    readonly from: SubscriptionStatus,
    readonly operation: string,
  ) {
    super(`Cannot ${operation} a subscription in status ${from}`);
  }
}

export class RenewalNotDueError extends DomainError {
  readonly code = 'RENEWAL_NOT_DUE';
  readonly category = 'CONFLICT';

  constructor(subscriptionId: string, periodEnd: Date) {
    super(`Subscription ${subscriptionId} is not due for renewal until ${periodEnd.toISOString()}`);
  }
}

export class InvalidCustomerIdError extends DomainError {
  readonly code = 'INVALID_CUSTOMER_ID';
  readonly category = 'INVALID';

  constructor() {
    super('Customer ID must be a non-blank string');
  }
}
