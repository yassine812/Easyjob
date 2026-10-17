import { config as loadDotenv } from 'dotenv';
import { Logger } from '@nestjs/common';

loadDotenv();
process.env.RUN_WORKERS = 'true';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { ExternalResearchWorkerModule } = require('./external-research/external-research-worker.module');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { NestFactory } = require('@nestjs/core');

async function bootstrap(): Promise<void> {
  const app = await NestFactory.createApplicationContext(ExternalResearchWorkerModule, { abortOnError: false });
  app.enableShutdownHooks();
  Logger.log('EasyJob external research worker started', 'ExternalResearchWorker');
}

void bootstrap();
