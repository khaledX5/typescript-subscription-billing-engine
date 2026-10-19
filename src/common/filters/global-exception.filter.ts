import {
  Catch,
  HttpException,
  HttpStatus,
  Inject,
  Logger,
  type ArgumentsHost,
  type ExceptionFilter,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { CLOCK, type Clock } from '../../shared/clock.js';
import { DomainError, type DomainErrorCategory } from '../../shared/domain/domain-error.js';
import { RequestValidationError, type FieldViolation } from '../errors/request-validation.error.js';

export interface ErrorResponseBody {
  readonly statusCode: number;
  readonly code: string;
  readonly message: string;
  readonly path: string;
  readonly timestamp: string;
  readonly details?: readonly FieldViolation[];
}

type ErrorDescription = Pick<ErrorResponseBody, 'statusCode' | 'code' | 'message' | 'details'>;

/** The single place where domain error categories are translated into HTTP semantics. */
const STATUS_BY_CATEGORY: Record<DomainErrorCategory, HttpStatus> = {
  INVALID: HttpStatus.BAD_REQUEST,
  NOT_FOUND: HttpStatus.NOT_FOUND,
  CONFLICT: HttpStatus.CONFLICT,
};

const INTERNAL_ERROR: ErrorDescription = {
  statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
  code: 'INTERNAL_ERROR',
  message: 'An unexpected error occurred',
};

/**
 * Converts every exception into one consistent JSON shape. Expected errors are mapped to 4xx;
 * anything else becomes an opaque 500 whose details are logged server-side only.
 */
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  constructor(@Inject(CLOCK) private readonly clock: Clock) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();
    const description = this.describe(exception);

    if (description.statusCode >= 500) {
      this.logger.error(
        `Unhandled error on ${request.method} ${request.path}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    const body: ErrorResponseBody = {
      ...description,
      path: request.path,
      timestamp: this.clock.now().toISOString(),
    };
    response.status(description.statusCode).json(body);
  }

  private describe(exception: unknown): ErrorDescription {
    if (exception instanceof DomainError) {
      return {
        statusCode: STATUS_BY_CATEGORY[exception.category],
        code: exception.code,
        message: exception.message,
      };
    }
    if (exception instanceof RequestValidationError) {
      return {
        statusCode: HttpStatus.BAD_REQUEST,
        code: 'VALIDATION_FAILED',
        message: exception.message,
        details: exception.violations,
      };
    }
    // Framework-level errors: unknown routes, malformed JSON bodies, etc.
    if (exception instanceof HttpException && exception.getStatus() < 500) {
      const statusCode = exception.getStatus();
      return {
        statusCode,
        code: HttpStatus[statusCode] ?? 'HTTP_ERROR',
        message: exception.message,
      };
    }
    return INTERNAL_ERROR;
  }
}
