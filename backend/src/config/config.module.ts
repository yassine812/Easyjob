import { Global, Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import { CONFIG, loadConfig } from './configuration';

@Global()
@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true,
      load: [loadConfig],
      cache: true,
    }),
  ],
  providers: [
    {
      provide: CONFIG,
      useFactory: loadConfig,
    },
  ],
  exports: [CONFIG],
})
export class ConfigModule {}
