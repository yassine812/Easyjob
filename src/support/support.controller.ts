import { BadRequestException, Body, Controller, Get, Param, Patch, Post, Query, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CreateSupportMessageDto, CreateSupportTicketDto, SupportTicketQueryDto, UpdateSupportTicketDto } from './support.dto';
import { SupportService } from './support.service';

@ApiTags('support')
@ApiBearerAuth()
@Controller('support')
export class SupportController {
  constructor(private readonly support: SupportService) {}

  @Post('tickets')
  @UseInterceptors(FileInterceptor('attachment', { limits: { fileSize: 10 * 1024 * 1024, files: 1 } }))
  create(@CurrentUser('userId') userId: string, @Body() dto: CreateSupportTicketDto, @UploadedFile() file?: Express.Multer.File) { return this.support.create(userId, dto, file); }

  @Get('tickets')
  list(@CurrentUser('userId') userId: string, @Query() query: SupportTicketQueryDto) { return this.support.list(userId, query); }

  @Get('unread-count')
  unreadCount(@CurrentUser('userId') userId: string) { return this.support.unreadCount(userId); }

  @Get('tickets/:reference')
  get(@CurrentUser('userId') userId: string, @Param('reference') reference: string) { return this.support.get(userId, reference); }

  @Post('tickets/:reference/messages')
  @UseInterceptors(FileInterceptor('attachment', { limits: { fileSize: 10 * 1024 * 1024, files: 1 } }))
  message(@CurrentUser('userId') userId: string, @Param('reference') reference: string, @Body() dto: CreateSupportMessageDto, @UploadedFile() file?: Express.Multer.File) { return this.support.addUserMessage(userId, reference, dto, file); }

  @Get('tickets/:reference/messages')
  messages(@CurrentUser('userId') userId: string, @Param('reference') reference: string) { return this.support.get(userId, reference); }

  @Get('tickets/:reference/attachment')
  attachment(@CurrentUser('userId') userId: string, @Param('reference') reference: string, @Query('messageId') messageId?: string) { return this.support.attachmentUrl(userId, reference, messageId); }

  @Patch('tickets/:reference')
  close(@CurrentUser('userId') userId: string, @Param('reference') reference: string, @Body() dto: UpdateSupportTicketDto) {
    if (dto.status && dto.status !== 'CLOSED') throw new BadRequestException('Users can only close their own ticket');
    return this.support.closeUserTicket(userId, reference);
  }
}
