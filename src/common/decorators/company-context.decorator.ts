import { createParamDecorator, ExecutionContext, BadRequestException } from '@nestjs/common';
import type { CompanyContext } from '../types/auth';

export const CompanyContextParam = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): CompanyContext => {
    const request = ctx.switchToHttp().getRequest<{ companyContext?: CompanyContext }>();
    if (!request.companyContext) {
      throw new BadRequestException('Company context not resolved for this request');
    }
    return request.companyContext;
  },
);
