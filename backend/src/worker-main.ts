/**
 * Dedicated worker process. Runs the same AppModule as the API but with
 * RUN_WORKERS=true so BullMQ consumers (email, notifications, AI, CV
 * processing, analytics, automation) are registered. No HTTP listener is
 * started.
 *
 * Note: AppModule is required AFTER setting RUN_WORKERS because the module
 * decorators evaluate processor registration at import time.
 */
import { config as loadDotenv } from 'dotenv';
import { Logger } from '@nestjs/common';

loadDotenv();
process.env.RUN_WORKERS = 'true';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { AppModule } = require('./app.module');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { NestFactory } = require('@nestjs/core');

async function bootstrapWorker(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, { abortOnError: false });
  app.enableShutdownHooks();
  Logger.log('Startup Starter worker started (BullMQ consumers active)', 'Worker');
}

void bootstrapWorker();
