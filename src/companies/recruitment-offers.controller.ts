import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { OfferDto, OfferResponseDto } from './dto/workspace.dto';
import { RecruitmentOffersService } from './recruitment-offers.service';
@Controller()
export class RecruitmentOffersController {
  constructor(private readonly service: RecruitmentOffersService) {}
  @Get('companies/:companyId/workspace/applications/:applicationId/offers') list(@CurrentUser('userId') u: string, @Param('companyId') c: string, @Param('applicationId') a: string) { return this.service.list(u, c, a); }
  @Post('companies/:companyId/workspace/applications/:applicationId/offers') create(@CurrentUser('userId') u: string, @Param('companyId') c: string, @Param('applicationId') a: string, @Body() d: OfferDto) { return this.service.create(u, c, a, d); }
  @Post('companies/:companyId/workspace/offers/:id/send') send(@CurrentUser('userId') u: string, @Param('companyId') c: string, @Param('id') id: string) { return this.service.send(u, c, id); }
  @Get('recruitment-offers/:id') candidate(@CurrentUser('userId') u: string, @Param('id') id: string) { return this.service.candidate(u, id); }
  @Post('recruitment-offers/:id/respond') respond(@CurrentUser('userId') u: string, @Param('id') id: string, @Body() d: OfferResponseDto) { return this.service.respond(u, id, d.response); }
}
