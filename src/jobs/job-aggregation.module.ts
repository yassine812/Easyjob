import { Module } from '@nestjs/common';
import { JobAggregationService } from './job-aggregation.service';
import { JoobleAdapter } from './sources/jooble.adapter';

@Module({ providers: [JobAggregationService, JoobleAdapter], exports: [JobAggregationService] })
export class JobAggregationModule {}
