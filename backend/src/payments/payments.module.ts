import { Global, Module } from '@nestjs/common';
import { PaymentProvider, DevPaymentProvider, StripePaymentProvider } from './payment.provider';
import { KonnectPaymentProvider } from './konnect.provider';
import { CONFIG, type AppConfig } from '../config/configuration';

@Global()
@Module({
  providers: [
    DevPaymentProvider,
    StripePaymentProvider,
    KonnectPaymentProvider,
    {
      provide: PaymentProvider,
      useFactory: (
        config: AppConfig,
        dev: DevPaymentProvider,
        stripe: StripePaymentProvider,
        konnect: KonnectPaymentProvider,
      ) => {
        if (config.payment.provider === 'stripe') return stripe;
        if (config.payment.provider === 'konnect') return konnect;
        return dev;
      },
      inject: [CONFIG, DevPaymentProvider, StripePaymentProvider, KonnectPaymentProvider],
    },
  ],
  exports: [PaymentProvider, DevPaymentProvider, StripePaymentProvider, KonnectPaymentProvider],
})
export class PaymentsModule {}
