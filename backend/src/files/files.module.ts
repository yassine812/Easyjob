import { Global, Module } from '@nestjs/common';
import { StorageService, S3StorageService, LocalStorageService } from './storage.service';
import { FileValidationService } from './file-validation.service';
import { FilesController } from './files.controller';
import { CONFIG, type AppConfig } from '../config/configuration';

@Global()
@Module({
  controllers: [FilesController],
  providers: [
    {
      provide: StorageService,
      useFactory: (config: AppConfig) =>
        config.storage.provider === 's3' ? new S3StorageService(config) : new LocalStorageService(config),
      inject: [CONFIG],
    },
    FileValidationService,
  ],
  exports: [StorageService, FileValidationService],
})
export class FilesModule {}
