import { Module } from '@nestjs/common';
import { SubscriptionsController } from './subscriptions.controller';
import { SubscriptionsService } from './subscriptions.service';
import { CurrencyConversionService } from '../payments/currency-conversion.service';
import { CompanyBillingService } from './company-billing.service';
import { SubscriptionNotificationService } from './subscription-notification.service';
import { InvoiceService } from './invoice.service';

@Module({
  controllers: [SubscriptionsController],
  providers: [SubscriptionsService, CurrencyConversionService, CompanyBillingService, SubscriptionNotificationService, InvoiceService],
  exports: [SubscriptionsService],
})
export class SubscriptionsModule {}
