import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ApiException } from '../errors/api-exception';

const STATUS_CODE: Record<number, string> = {
  400: 'VALIDATION',
  401: 'INVALID_TOKEN',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  429: 'TOO_MANY_REQUESTS',
};

/**
 * Serialises every thrown error into the shared envelope:
 *   { statusCode, error, message, details?, path, timestamp }
 * so the frontend can branch on a stable `error` code.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exception');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'INTERNAL';
    let message = 'Internal server error';
    let details: unknown;

    if (exception instanceof ApiException) {
      status = exception.getStatus();
      code = exception.code;
      message = (exception.getResponse() as any)?.message ?? exception.message;
      details = exception.details;
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      const resp = exception.getResponse();
      if (typeof resp === 'string') {
        message = resp;
      } else {
        const r = resp as any;
        // class-validator via ValidationPipe returns { message: string[] }
        if (Array.isArray(r.message)) {
          code = 'VALIDATION';
          message = 'Validation failed';
          details = r.message;
        } else {
          message = r.message ?? exception.message;
        }
      }
      if (code === 'INTERNAL') code = STATUS_CODE[status] ?? 'ERROR';
    } else if (exception instanceof Error) {
      message = exception.message;
    }

    if (status >= 500) {
      this.logger.error(
        `${req.method} ${req.url} -> ${status}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    res.status(status).json({
      statusCode: status,
      error: code,
      message,
      ...(details !== undefined ? { details } : {}),
      path: req.url,
      timestamp: new Date().toISOString(),
    });
  }
}
