import { Controller, Delete, Get, Param, Patch, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { NotificationsService } from './notifications.service';
import { IsOptional, IsString, MaxLength } from 'class-validator';

class ListNotificationsQuery {
  @IsOptional() @IsString() @MaxLength(100)
  companyId?: string;
  @IsOptional()
  page?: number;

  @IsOptional()
  limit?: number;

  @IsOptional()
  unreadOnly?: boolean;
}

@ApiTags('notifications')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get('me')
  async listMine(
    @CurrentUser('userId') userId: string,
    @Query() query: ListNotificationsQuery,
  ) {
    return this.notificationsService.listForUser(userId, query);
  }

  @Patch('me/read-all')
  async readAll(@CurrentUser('userId') userId: string, @Query() query: ListNotificationsQuery) {
    return this.notificationsService.markAllRead(userId, query.companyId);
  }

  @Patch('me/:id/read')
  async readOne(@CurrentUser('userId') userId: string, @Param('id') id: string) {
    await this.notificationsService.markRead(userId, id);
    return { success: true };
  }

  @Delete('me/:id')
  async remove(@CurrentUser('userId') userId: string, @Param('id') id: string) {
    await this.notificationsService.remove(userId, id);
    return { success: true };
  }
}
