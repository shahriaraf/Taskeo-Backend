import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { PostMortemService } from './postmortem.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('postmortem')
@UseGuards(JwtAuthGuard)
export class PostMortemController {
  constructor(private readonly postMortemService: PostMortemService) {}

  // GET /postmortem/:projectId — generate report for a project
  @Get(':projectId')
  async generate(@Param('projectId') projectId: string) {
    return this.postMortemService.generate(projectId);
  }
}
