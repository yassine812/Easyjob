import type { Request } from 'express';
import { Public } from '../common/decorators/public.decorator';
import { Headers, Req, RawBodyRequest, Body, Controller, Get, Param, Post, Query, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ArrayMaxSize, IsArray, IsBoolean, IsIn, IsInt, IsString, MaxLength, Min } from 'class-validator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { MeetingService } from './meeting.service';
class ConsentDto { @IsBoolean() accepted!: boolean; }
class NotesDto {
  @IsString() @MaxLength(15000) notes!: string;
  @IsArray() @ArrayMaxSize(12) @IsInt({ each: true }) @Min(0, { each: true }) covered!: number[];
  @IsIn(['en','fr','ar']) locale!: string;
}
@Controller()
export class MeetingController {
  constructor(private readonly meetings: MeetingService) {}
  @Get('companies/:companyId/meeting-capabilities') capabilities(@CurrentUser('userId') u: string, @Param('companyId') c: string) { return this.meetings.capabilities(u,c); }
  @Get('meetings/:id') details(@CurrentUser('userId') u: string, @Param('id') id: string, @Query('locale') locale?: string) { return this.meetings.details(u,id, ['en','fr','ar'].includes(locale ?? '') ? locale : 'fr'); }
  @Post('meetings/:id/started') started(@CurrentUser('userId') u: string, @Param('id') id: string) { return this.meetings.started(u,id); }
  @Public()
  @Post('meetings/events') webhook(@Req() req: RawBodyRequest<Request>, @Headers('authorization') authorization: string) { return this.meetings.webhook(req.rawBody?.toString() ?? '', authorization); }
  @Post('meetings/:id/join') join(@CurrentUser('userId') u: string, @Param('id') id: string) { return this.meetings.join(u,id); }
  @Post('meetings/:id/consent') consent(@CurrentUser('userId') u: string, @Param('id') id: string, @Body() d: ConsentDto) { return this.meetings.consent(u,id,d.accepted); }
  @Get('meetings/:id/calendar') calendar(@CurrentUser('userId') u: string, @Param('id') id: string) { return this.meetings.calendar(u,id); }
  @Post('meetings/:id/notes') notes(@CurrentUser('userId') u: string, @Param('id') id: string, @Body() d: NotesDto) { return this.meetings.notes(u,id,d.notes,d.covered,d.locale); }
  @Post('meetings/:id/audio')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }))
  audio(@CurrentUser('userId') u: string, @Param('id') id: string, @UploadedFile() file: Express.Multer.File, @Query('locale') locale?: string) { return this.meetings.transcribe(u,id,file, ['fr','en','ar'].includes(locale ?? '') ? locale : undefined); }
}
