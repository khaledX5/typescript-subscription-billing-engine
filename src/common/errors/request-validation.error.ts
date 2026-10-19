export interface FieldViolation {
  readonly field: string;
  readonly messages: readonly string[];
}

/** Raised by the global ValidationPipe when a request payload fails DTO validation. */
export class RequestValidationError extends Error {
  constructor(readonly violations: readonly FieldViolation[]) {
    super('Request validation failed');
    this.name = 'RequestValidationError';
  }
}
