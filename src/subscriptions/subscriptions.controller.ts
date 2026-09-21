import { Body, Controller, Get, Inject, Post, Query, RawBodyRequest, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { PlanType } from '@prisma/client';
import { Request } from 'express';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { SubscriptionsService } from './subscriptions.service';
import { CONFIG, type AppConfig } from '../config/configuration';

class ListPlansQuery {
  @IsOptional()
  @IsEnum(PlanType)
  type?: PlanType;
}

class CheckoutDto {
  @IsString()
  planId!: string;

  @IsEnum(PlanType)
  ownerType!: PlanType;

  @IsOptional()
  @IsString()
  companyId?: string;

  @IsOptional()
  @IsString()
  billingCountry?: string;
}

class CancelSubscriptionDto {
  @IsString()
  subscriptionId!: string;
}

@ApiTags('subscriptions')
@Controller()
export class SubscriptionsController {
  constructor(
    private readonly subscriptionsService: SubscriptionsService,
    @Inject(CONFIG) private readonly config: AppConfig,
  ) {}

  @Public()
  @Get('plans')
  async plans(@Query() query: ListPlansQuery) {
    return this.subscriptionsService.listPlans(query.type);
  }

  @Get('subscriptions/me')
  @ApiBearerAuth()
  async current(
    @CurrentUser('userId') userId: string,
    @Query('ownerType') ownerType: PlanType,
    @Query('companyId') companyId?: string,
  ) {
    return this.subscriptionsService.getCurrent(userId, ownerType, companyId);
  }

  @Get('subscriptions/payments/status')
  @ApiBearerAuth()
  async getPaymentStatus(
    @CurrentUser('userId') userId: string,
    @Query('ref') ref: string,
  ) {
    return this.subscriptionsService.getPaymentStatus(userId, ref);
  }

  @Post('subscriptions/checkout')
  @ApiBearerAuth()
  async checkout(@CurrentUser('userId') userId: string, @Body() dto: CheckoutDto) {
    return this.subscriptionsService.checkout(userId, dto);
  }

  @Get('subscriptions/quote')
  async quote(@Query('planId') planId: string, @Query('billingCountry') country?: string) {
    return this.subscriptionsService.quote(planId, country);
  }

  @Post('subscriptions/cancel')
  @ApiBearerAuth()
  async cancel(@CurrentUser('userId') userId: string, @Body() dto: CancelSubscriptionDto) {
    return this.subscriptionsService.cancel(userId, dto.subscriptionId);
  }

  /**
   * Stripe / Dev Webhook. Signature-verified; webhook events are authoritative.
   */
  @Public()
  @Post('subscriptions/webhook')
  async webhook(@Req() req: RawBodyRequest<Request>) {
    const signature = req.headers['stripe-signature'] ?? req.headers['x-webhook-secret'];
    const raw = (req.rawBody ?? Buffer.from(JSON.stringify(req.body ?? {}))) as Buffer;
    return this.subscriptionsService.handleWebhook(raw, (signature as string) ?? undefined);
  }

  /**
   * Konnect Webhook Endpoint for TND payments.
   */
  @Public()
  @Get('payments/webhook/konnect')
  async konnectCallback(@Query('payment_ref') reference: string) {
    return this.subscriptionsService.handleKonnectWebhook(Buffer.from(JSON.stringify({ payment_ref: reference })), undefined);
  }

  @Public()
  @Post('payments/webhook/konnect')
  async konnectWebhook(@Req() req: RawBodyRequest<Request>) {
    const signature = (req.headers['x-webhook-secret'] || req.headers['x-konnect-signature']) as string | undefined;
    const raw = (req.rawBody ?? Buffer.from(JSON.stringify(req.body ?? {}))) as Buffer;
    return this.subscriptionsService.handleKonnectWebhook(raw, signature);
  }
}
