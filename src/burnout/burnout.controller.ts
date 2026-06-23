import { Controller, Get, Param, Post, UseGuards, Request } from '@nestjs/common';
import { BurnoutService } from './burnout.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('burnout')
@UseGuards(JwtAuthGuard)
export class BurnoutController {
  constructor(private readonly burnoutService: BurnoutService) {}

  // GET /burnout/team — full team analysis (admin/PM only)
  @Get('team')
  async getTeamAnalysis(@Request() req: any) {
    return this.burnoutService.analyseTeam(req.user.sub, req.user.role);
  }

  // GET /burnout/me — current user's own signal
  @Get('me')
  async getMySignal(@Request() req: any) {
    return this.burnoutService.analyseUser(req.user.sub, req.user.name);
  }

  // GET /burnout/user/:id — specific user (admin/PM only)
  @Get('user/:id')
  async getUserSignal(@Param('id') id: string, @Request() req: any) {
    const user = await (this.burnoutService as any).prisma.user.findUnique({
      where: { id },
      select: { name: true, avatarUrl: true },
    });
    return this.burnoutService.analyseUser(id, user?.name ?? 'Unknown', user?.avatarUrl ?? undefined);
  }

  // POST /burnout/alert/:projectId — send notifications to PMs
  @Post('alert/:projectId')
  async alertManagers(@Param('projectId') projectId: string) {
    await this.burnoutService.alertManagers(projectId);
    return { message: 'Alerts sent to project managers' };
  }
}
