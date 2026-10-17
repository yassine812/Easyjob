import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import type { Request, Response } from 'express';
import { getRequestId } from '../request/request-context';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const req = http.getRequest<Request>();
    const res = http.getResponse<Response>();
    const start = Date.now();
    const requestId = getRequestId() ?? (req.headers['x-request-id'] as string) ?? '-';

    const method = req.method;
    const url = req.originalUrl ?? req.url;
    const userId = (req as unknown as { user?: { userId?: string } }).user?.userId ?? null;

    return next.handle().pipe(
      tap({
        next: () => {
          const durationMs = Date.now() - start;
          const status = res.statusCode;
          this.logger.log(
            JSON.stringify({
              requestId,
              method,
              url,
              status,
              durationMs,
              userId,
            }),
          );
        },
        error: (err: Error & { status?: number }) => {
          const durationMs = Date.now() - start;
          const status = err?.status ?? 500;
          this.logger.warn(
            JSON.stringify({
              requestId,
              method,
              url,
              status,
              durationMs,
              userId,
              error: err?.message ?? 'unknown error',
            }),
          );
        },
      }),
    );
  }
}
