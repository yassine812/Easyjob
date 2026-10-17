import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CvStudioService } from './cv-studio.service';
import { CreateCvVariantDto, InterviewAnswerDto, RestoreCvDto, StartCvDto, StudioSaveDto, StudioSuggestDto } from './cv-studio.dto';

@ApiTags('cv-studio')
@ApiBearerAuth()
@Controller('career/cv-studio')
export class CvStudioController {
  constructor(private readonly studio: CvStudioService) {}
  @Get() list(@CurrentUser('userId') uid: string) { return this.studio.list(uid); }
  @Post() start(@CurrentUser('userId') uid: string, @Body() dto: StartCvDto) { return this.studio.start(uid, dto); }
  @Get(':id') get(@CurrentUser('userId') uid: string, @Param('id') id: string) { return this.studio.get(uid, id); }
  @Patch(':id') save(@CurrentUser('userId') uid: string, @Param('id') id: string, @Body() dto: StudioSaveDto) { return this.studio.save(uid, id, dto); }
  @Post(':id/suggest') suggest(@CurrentUser('userId') uid: string, @Param('id') id: string, @Body() dto: StudioSuggestDto) { return this.studio.suggest(uid, id, dto); }
  @Post(':id/interview') answer(@CurrentUser('userId') uid: string, @Param('id') id: string, @Body() dto: InterviewAnswerDto) { return this.studio.answer(uid, id, dto); }
  @Post(':id/duplicate') duplicate(@CurrentUser('userId') uid: string, @Param('id') id: string) { return this.studio.duplicate(uid, id); }
  @Post(':id/variant') variant(@CurrentUser('userId') uid: string, @Param('id') id: string, @Body() dto: CreateCvVariantDto) { return this.studio.variant(uid, id, dto); }
  @Post(':id/writing-quality') writingQuality(@CurrentUser('userId') uid: string, @Param('id') id: string) { return this.studio.writingQuality(uid, id); }
  @Post(':id/revisions/:revisionId/restore') restore(@CurrentUser('userId') uid: string, @Param('id') id: string, @Param('revisionId') revision: string, @Body() dto: RestoreCvDto) { return this.studio.restore(uid, id, revision, dto.expectedVersion); }
  @Post(':id/export') export(@CurrentUser('userId') uid: string, @Param('id') id: string) { return this.studio.export(uid, id); }
  @Post(':id/publish') publish(@CurrentUser('userId') uid: string, @Param('id') id: string) { return this.studio.publish(uid, id); }
}
