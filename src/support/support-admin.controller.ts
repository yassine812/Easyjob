import { Body, Controller, Get, Param, Patch, Post, Query, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../common/decorators/roles.decorator';
import { PLATFORM_ADMIN_ROLES } from '../common/constants/roles';
import { Permissions } from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CreateSupportMessageDto, SupportTicketQueryDto, UpdateSupportTicketDto } from './support.dto';
import { SupportService } from './support.service';

@ApiTags('admin-support')
@ApiBearerAuth()
@Roles(...PLATFORM_ADMIN_ROLES)
@Permissions('admin.support')
@Controller(['admin/support', 'platform-admin/support'])
export class SupportAdminController {
  constructor(private readonly support: SupportService) {}

  @Get('tickets')
  list(@Query() query: SupportTicketQueryDto) { return this.support.adminList(query); }

  @Get('tickets/:reference')
  get(@Param('reference') reference: string) { return this.support.adminGet(reference); }

  @Get('tickets/:reference/attachment')
  attachment(@Param('reference') reference: string, @Query('messageId') messageId?: string) { return this.support.adminAttachmentUrl(reference, messageId); }

  @Patch('tickets/:reference')
  @Permissions('admin.support_manage')
  update(@CurrentUser('userId') adminId: string, @Param('reference') reference: string, @Body() dto: UpdateSupportTicketDto) { return this.support.adminUpdate(adminId, reference, dto); }

  @Post('tickets/:reference/messages')
  @Permissions('admin.support_manage')
  @UseInterceptors(FileInterceptor('attachment', { limits: { fileSize: 10 * 1024 * 1024, files: 1 } }))
  message(@CurrentUser('userId') adminId: string, @Param('reference') reference: string, @Body() dto: CreateSupportMessageDto, @UploadedFile() file?: Express.Multer.File) { return this.support.adminReply(adminId, reference, dto, file); }
}
