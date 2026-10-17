import {
  ArgumentsHost,
  Catch,
  ConflictException,
  HttpException,
  HttpStatus,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import { Prisma } from '@prisma/client';
import type { Request, Response } from 'express';
import { getRequestId } from '../request/request-context';

@Catch()
export class AllExceptionsFilter extends BaseExceptionFilter {
  private readonly logger = new Logger('Exception');

  override catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const requestId = getRequestId() ?? (request.headers['x-request-id'] as string) ?? '-';
    const path = request.originalUrl ?? request.url;

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let error = 'Internal Server Error';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === 'string') {
        message = body;
        error = exception.name;
      } else if (typeof body === 'object' && body !== null) {
        const b = body as { message?: string | string[]; error?: string };
        message = Array.isArray(b.message) ? b.message.join(', ') : (b.message ?? exception.message);
        error = b.error ?? exception.name;
      }
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      const mapped = this.mapPrismaError(exception);
      status = mapped.status;
      message = mapped.message;
      error = mapped.error;
    } else if (exception instanceof Prisma.PrismaClientValidationError) {
      status = HttpStatus.BAD_REQUEST;
      message = 'Invalid query';
      error = 'Bad Request';
    } else if (exception instanceof Error) {
      message = exception.message;
      error = exception.name;
    }

    if (status >= 500) {
      this.logger.error(
        JSON.stringify({
          requestId,
          path,
          status,
          error,
          message,
          stack: exception instanceof Error ? exception.stack : undefined,
        }),
      );
    } else {
      this.logger.warn(JSON.stringify({ requestId, path, status, error, message }));
    }

    if (!response.headersSent) {
      response.status(status).json({
        statusCode: status,
        message,
        error,
        requestId,
        path,
        timestamp: new Date().toISOString(),
      });
    }
  }

  private mapPrismaError(err: Prisma.PrismaClientKnownRequestError): {
    status: number;
    message: string;
    error: string;
  } {
    switch (err.code) {
      case 'P2002':
        return {
          status: HttpStatus.CONFLICT,
          message: 'A record with the same unique value already exists',
          error: 'Conflict',
        };
      case 'P2025':
        return {
          status: HttpStatus.NOT_FOUND,
          message: 'Record not found',
          error: 'Not Found',
        };
      case 'P2003':
        return {
          status: HttpStatus.CONFLICT,
          message: 'Referenced record does not exist',
          error: 'Conflict',
        };
      case 'P2014':
      case 'P2016':
        return {
          status: HttpStatus.BAD_REQUEST,
          message: 'Invalid relation reference',
          error: 'Bad Request',
        };
      case 'P2000':
        return {
          status: HttpStatus.BAD_REQUEST,
          message: 'Value too long for column',
          error: 'Bad Request',
        };
      default:
        return { status: HttpStatus.BAD_REQUEST, message: 'Database error', error: 'Bad Request' };
    }
  }
}

// Re-export for convenience in service code
export const notFound = (entity: string): HttpException =>
  new NotFoundException(`${entity} not found`);

export const conflict = (message: string): HttpException => new ConflictException(message);
