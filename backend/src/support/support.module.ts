import { Module } from '@nestjs/common';
import { FilesModule } from '../files/files.module';
import { SupportController } from './support.controller';
import { SupportAdminController } from './support-admin.controller';
import { SupportService } from './support.service';

@Module({
  imports: [FilesModule],
  controllers: [SupportController, SupportAdminController],
  providers: [SupportService],
})
export class SupportModule {}
