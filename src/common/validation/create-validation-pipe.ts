import { ValidationPipe, type ValidationError } from '@nestjs/common';
import { RequestValidationError, type FieldViolation } from '../errors/request-validation.error.js';

function toViolations(errors: ValidationError[]): FieldViolation[] {
  return errors.map((error) => ({
    field: error.property,
    messages: Object.values(error.constraints ?? {}),
  }));
}

/**
 * DTO validation checks payload *shape* only (types, required fields, unknown fields).
 * Business rules such as "price must be non-negative" live in the domain, so they are
 * enforced identically no matter how a use case is invoked.
 */
export function createValidationPipe(): ValidationPipe {
  return new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    exceptionFactory: (errors) => new RequestValidationError(toViolations(errors)),
  });
}
