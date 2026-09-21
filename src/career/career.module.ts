import { Module } from '@nestjs/common';
import { ApplicationsModule } from '../applications/applications.module';
import { RUN_WORKERS } from '../common/utils/env';
import { CareerController } from './career.controller';
import { CareerService } from './career.service';
import { CareerScheduler } from './career.scheduler';

@Module({ imports: [ApplicationsModule], controllers: [CareerController], providers: [CareerService, ...(RUN_WORKERS ? [CareerScheduler] : [])] })
export class CareerModule {}
