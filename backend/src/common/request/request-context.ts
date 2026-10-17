import { AsyncLocalStorage } from 'async_hooks';
import { randomUUID } from 'crypto';
import { NextFunction, Request, Response } from 'express';

export interface RequestContextValue {
  requestId: string;
}

export const requestContext = new AsyncLocalStorage<RequestContextValue>();

export function getRequestId(): string | undefined {
  return requestContext.getStore()?.requestId;
}

export function requestContextMiddleware(req: Request, res: Response, next: NextFunction): void {
  const requestId = (req.headers['x-request-id'] as string) || randomUUID();
  res.setHeader('X-Request-Id', requestId);
  requestContext.run({ requestId }, next);
}
