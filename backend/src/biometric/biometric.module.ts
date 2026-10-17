import { Module } from '@nestjs/common';
import { BiometricController } from './biometric.controller';
import { BiometricService } from './biometric.service';
import { FaceAuthController } from './face-auth.controller';
import { FaceClient } from './face-client';

@Module({
  controllers: [BiometricController, FaceAuthController],
  providers: [BiometricService, FaceClient],
  exports: [BiometricService],
})
export class BiometricModule {}
