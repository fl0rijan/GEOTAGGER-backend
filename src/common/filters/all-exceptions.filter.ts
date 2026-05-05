import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { Request } from 'express';
import { Prisma } from '../../../generated/prisma/client';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  constructor(private readonly httpAdapterHost: HttpAdapterHost) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const { httpAdapter } = this.httpAdapterHost;
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request>();

    let httpStatus: number = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Internal server error';
    let errorTitle = 'Internal Server Error';

    if (exception instanceof HttpException) {
      httpStatus = exception.getStatus();
      const response = exception.getResponse();

      if (typeof response === 'object' && response !== null) {
        const resObj = response as Record<string, unknown>;
        message = (resObj.message as string | string[]) || exception.message;
        errorTitle = (resObj.error as string) || 'Error';
      } else {
        message = String(response);
      }
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      switch (exception.code) {
        case 'P2002':
          httpStatus = HttpStatus.CONFLICT;
          message = 'A record with this unique value already exists.';
          break;
        case 'P2025':
          httpStatus = HttpStatus.NOT_FOUND;
          message = 'The requested record was not found.';
          break;
        case 'P2007':
          httpStatus = HttpStatus.NOT_FOUND;
          message = 'The requested record was not found.';
          break;
        default:
          httpStatus = HttpStatus.BAD_REQUEST;
          message = `Database Error: ${exception.code}`;
      }
    } else if (exception instanceof Error) {
      message = exception.message;
    }

    const sanitizedMessage = Array.isArray(message)
      ? String(message[0])
      : String(message);

    const sanitizedError = String(errorTitle);
    const sanitizedPath = String(httpAdapter.getRequestUrl(request));

    if (httpStatus >= 500) {
      const stack = exception instanceof Error ? exception.stack : '';
      this.logger.error(
        `Status: ${httpStatus} | Error: ${sanitizedMessage} \nStack: ${stack}`,
      );
    } else {
      this.logger.warn(`Status: ${httpStatus} | Message: ${sanitizedMessage}`);
    }

    const responseBody = {
      statusCode: httpStatus,
      timestamp: new Date().toISOString(),
      path: sanitizedPath,
      message: sanitizedMessage,
      error: sanitizedError,
    };

    httpAdapter.reply(ctx.getResponse(), responseBody, httpStatus);
  }
}
