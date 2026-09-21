import { Global, Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { QUEUES } from '../../common/constants/queues';
import { EmailService } from './email.service';
import { EmailProvider, ConsoleEmailProvider, SmtpEmailProvider } from './email.provider';
import { EmailProcessor } from './email.processor';
import { RUN_WORKERS } from '../../common/utils/env';
import { CompanyAccessWorker } from './company-access.worker';

@Global()
@Module({
  imports: [BullModule.registerQueue({ name: QUEUES.EMAIL })],
  providers: [
    EmailService,
    {
      provide: EmailProvider,
      useFactory: () =>
        (process.env.EMAIL_PROVIDER ?? 'console') === 'smtp'
          ? new SmtpEmailProvider()
          : new ConsoleEmailProvider(),
    },
    ...(RUN_WORKERS ? [EmailProcessor, CompanyAccessWorker] : []),
  ],
  exports: [EmailService, BullModule],
})
export class EmailModule {}
