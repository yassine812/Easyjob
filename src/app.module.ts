import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';
import { ConfigModule } from './config/config.module';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { CommonModule } from './common/common.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { RolesModule } from './roles/roles.module';
import { CompaniesModule } from './companies/companies.module';
import { CompanyMembersModule } from './company-members/company-members.module';
import { CompanyInvitationsModule } from './company-invitations/company-invitations.module';
import { CompanyVerificationModule } from './company-verification/company-verification.module';
import { CandidatesModule } from './candidates/candidates.module';
import { FilesModule } from './files/files.module';
import { JobsModule } from './jobs/jobs.module';
import { SearchModule } from './search/search.module';
import { ApplicationsModule } from './applications/applications.module';
import { ApplicationEventsModule } from './application-events/application-events.module';
import { InterviewsModule } from './interviews/interviews.module';
import { NotificationsModule } from './notifications/notifications.module';
import { EmailModule } from './queues/email/email.module';
import { RealtimeModule } from './realtime/realtime.module';
import { AdminModule } from './admin/admin.module';
import { AuditModule } from './audit/audit.module';
import { SubscriptionsModule } from './subscriptions/subscriptions.module';
import { PaymentsModule } from './payments/payments.module';
import { EntitlementsModule } from './entitlements/entitlements.module';
import { AutomationModule } from './automation/automation.module';
import { BiometricModule } from './biometric/biometric.module';
import { AssessmentsModule } from './assessments/assessments.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { AiModule } from './ai/ai.module';
import { HealthModule } from './health/health.module';
import { loadConfig } from './config/configuration';
import { CareerModule } from './career/career.module';

const config = loadConfig();

@Module({
  imports: [
    // Cross-cutting infra
    ConfigModule,
    PrismaModule,
    RedisModule,
    CommonModule,
    EventEmitterModule.forRoot({ wildcard: false, delimiter: '.', maxListeners: 50 }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRootAsync({
      useFactory: () => ({
        throttlers: [
          {
            ttl: config.throttle.ttlMs,
            limit: config.throttle.enabled ? config.throttle.limit : 1_000_000,
          },
        ],
      }),
    }),
    BullModule.forRoot({
      connection: { url: config.redis.url },
      defaultJobOptions: {
        attempts: 3,
        removeOnComplete: { age: 60 * 60 * 24 },
        removeOnFail: { age: 60 * 60 * 24 * 7 },
      },
    }),

    // Feature modules
    AuthModule,
    UsersModule,
    RolesModule,
    CompaniesModule,
    CompanyMembersModule,
    CompanyInvitationsModule,
    CompanyVerificationModule,
    CandidatesModule,
    FilesModule,
    JobsModule,
    SearchModule,
    ApplicationsModule,
    ApplicationEventsModule,
    InterviewsModule,
    NotificationsModule,
    EmailModule,
    RealtimeModule,
    AdminModule,
    AuditModule,
    SubscriptionsModule,
    PaymentsModule,
    EntitlementsModule,
    AutomationModule,
    BiometricModule,
    AssessmentsModule,
    AnalyticsModule,
    AiModule,
    HealthModule,
    CareerModule,
  ],
})
export class AppModule {}
