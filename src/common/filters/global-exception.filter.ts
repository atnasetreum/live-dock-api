import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';

import { Request, Response } from 'express';
import { QueryFailedError } from 'typeorm';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const normalized = this.normalizeException(exception);

    this.logger.error(
      `${request.method} ${request.url}`,
      exception instanceof Error ? exception.stack : JSON.stringify(exception),
    );

    response.status(normalized.status).json({
      statusCode: normalized.status,
      error: normalized.error,
      message: normalized.message,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }

  private normalizeException(exception: unknown) {
    if (exception instanceof HttpException) {
      const body = exception.getResponse();
      const message =
        typeof body === 'string'
          ? body
          : ((body as Record<string, unknown>).message ?? exception.message);
      const error =
        typeof body === 'string'
          ? exception.name
          : ((body as Record<string, unknown>).error ?? exception.name);

      return {
        status: exception.getStatus(),
        error,
        message,
      };
    }

    if (exception instanceof QueryFailedError) {
      return this.handleQueryFailedError(exception);
    }

    if (exception instanceof Error) {
      return {
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        error: exception.name ?? 'Error',
        message: exception.message,
      };
    }

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      error: 'Internal Server Error',
      message: 'An unexpected error occurred',
    };
  }

  private handleQueryFailedError(error: QueryFailedError) {
    const driverError = error.driverError as { code?: string; detail?: string };

    switch (driverError?.code) {
      case '23505':
        return {
          status: HttpStatus.CONFLICT,
          error: 'Duplicate entry',
          message:
            driverError.detail ??
            'Duplicate key value violates unique constraint',
        };
      case '23503':
        return {
          status: HttpStatus.BAD_REQUEST,
          error: 'Foreign key violation',
          message: driverError.detail ?? 'Foreign key constraint violated',
        };
      default:
        return {
          status: HttpStatus.BAD_REQUEST,
          error: 'Database error',
          message: driverError?.detail ?? error.message,
        };
    }
  }
}
