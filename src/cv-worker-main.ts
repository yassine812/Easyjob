import './common/utils/env';
import { Logger, Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule } from './config/config.module';
import { CONFIG, loadConfig, type AppConfig } from './config/configuration';
import { PrismaModule } from './prisma/prisma.module';
import { QUEUES } from './common/constants/queues';
import { StorageService, LocalStorageService, S3StorageService } from './files/storage.service';
import { AiClient } from './ai/ai-client';
import { CvProcessor } from './ai/cv-processor';

// A local CV consumer can run without activating email or application queues.
@Module({
  imports: [ConfigModule, PrismaModule,
    BullModule.forRoot({ connection: { url: loadConfig().redis.url } }),
    BullModule.registerQueue({ name: QUEUES.CV_PROCESSING })],
  providers: [AiClient, CvProcessor, {
    provide: StorageService,
    inject: [CONFIG],
    useFactory: (config: AppConfig) => config.storage.provider === 's3'
      ? new S3StorageService(config) : new LocalStorageService(config),
  }],
})
class CvWorkerModule {}

async function main() {
  const app = await NestFactory.createApplicationContext(CvWorkerModule);
  app.enableShutdownHooks();
  Logger.log('CV processing worker ready', 'CvWorker');
}
void main();
