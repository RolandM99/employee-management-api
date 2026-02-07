import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

    const { message, details } = this.extractErrorDetails(exception, status);
    const errorResponse = {
      data: null,
      meta: {
        statusCode: status,
        timestamp: new Date().toISOString(),
        path: request.url,
        method: request.method,
      },
      errors: [
        {
          code: this.resolveErrorCode(status),
          message,
          ...(details !== undefined ? { details } : {}),
        },
      ],
    };

    if (status === HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `${request.method} ${request.url}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    response.status(status).json(errorResponse);
  }

  private extractErrorDetails(
    exception: unknown,
    status: number,
  ): { message: string; details?: unknown } {
    if (!(exception instanceof HttpException)) {
      return { message: 'Internal server error' };
    }

    const response = exception.getResponse();
    if (typeof response === 'string') {
      return { message: response };
    }

    if (this.isRecord(response)) {
      const rawMessage = response.message;

      if (Array.isArray(rawMessage)) {
        return {
          message: rawMessage[0] ?? this.resolveErrorCode(status),
          details: rawMessage,
        };
      }

      if (typeof rawMessage === 'string') {
        const details = this.cleanErrorDetails(response);
        return {
          message: rawMessage,
          ...(details !== undefined ? { details } : {}),
        };
      }

      return {
        message: this.resolveErrorCode(status),
        details: response,
      };
    }

    return { message: this.resolveErrorCode(status) };
  }

  private cleanErrorDetails(response: Record<string, unknown>): unknown {
    const details = { ...response };
    delete details.message;
    delete details.statusCode;
    delete details.error;

    return Object.keys(details).length > 0 ? details : undefined;
  }

  private resolveErrorCode(status: number): string {
    return HttpStatus[status] ?? 'INTERNAL_SERVER_ERROR';
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
  }
}
