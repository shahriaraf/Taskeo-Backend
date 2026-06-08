import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { TeamService } from './team.service';
import { AddMemberDto } from './dto/create-team.dto';
import { UpdateMemberRoleDto } from './dto/update-team.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ApiResponse } from '../common/response/api-response';

@ApiTags('Team')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('team')
export class TeamController {
  constructor(private readonly teamService: TeamService) {}

  @Post('members')
  @ApiOperation({ summary: 'Add a member to a project' })
  async addMember(
    @Body() dto: AddMemberDto,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: string,
  ) {
    const member = await this.teamService.addMember(dto, userId, userRole);
    return ApiResponse.success(member, 'Member added successfully');
  }

  @Get('project/:projectId/members')
  @ApiOperation({ summary: 'Get all members of a project with workload' })
  async getProjectMembers(@Param('projectId', ParseUUIDPipe) projectId: string) {
    const members = await this.teamService.getProjectMembers(projectId);
    return ApiResponse.success(members, 'Members retrieved');
  }

  @Get('project/:projectId/workload')
  @ApiOperation({ summary: 'Get member workload summary for a project' })
  async getMemberWorkload(@Param('projectId', ParseUUIDPipe) projectId: string) {
    const workload = await this.teamService.getMemberWorkload(projectId);
    return ApiResponse.success(workload, 'Workload summary retrieved');
  }

  @Patch('project/:projectId/members/:userId/role')
  @ApiOperation({ summary: 'Update a member role in a project' })
  async updateMemberRole(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: UpdateMemberRoleDto,
    @CurrentUser('id') requesterId: string,
    @CurrentUser('role') requesterRole: string,
  ) {
    const member = await this.teamService.updateMemberRole(
      projectId, userId, dto, requesterId, requesterRole,
    );
    return ApiResponse.success(member, 'Member role updated');
  }

  @Delete('project/:projectId/members/:userId')
  @ApiOperation({ summary: 'Remove a member from a project' })
  async removeMember(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @CurrentUser('id') requesterId: string,
    @CurrentUser('role') requesterRole: string,
  ) {
    const result = await this.teamService.removeMember(
      projectId, userId, requesterId, requesterRole,
    );
    return ApiResponse.success(result, 'Member removed successfully');
  }

  @Get('users/search')
  @ApiOperation({ summary: 'Search users by name or email' })
  async searchUsers(@Query('q') search: string) {
    const users = await this.teamService.searchUsers(search || '');
    return ApiResponse.success(users, 'Users found');
  }
}
