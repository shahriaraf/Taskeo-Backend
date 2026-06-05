// src/activity-logs/activity-logs.controller.ts

import {
  Controller,
  Get,
  Param,
  Query,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { ActivityLogsService } from './activity-logs.service';
import { QueryActivityLogsDto } from './dto/query-activity-logs.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { ApiResponse } from '../common/response/api-response';

@ApiTags('Activity Logs')
@ApiBearerAuth('JWT-auth')
@Controller('activity-logs')
export class ActivityLogsController {
  constructor(private activityLogsService: ActivityLogsService) {}

  @Get()
  @ApiOperation({ summary: 'Get activity logs (Admin & PM get all; others get their own)' })
  async findAll(
    @Query() dto: QueryActivityLogsDto,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: string,
  ) {
    // Admins and PMs see all logs; team members see only their own
    if (userRole === UserRole.admin || userRole === UserRole.project_manager) {
      const result = await this.activityLogsService.findAll(dto);
      return ApiResponse.success(
        result.data,
        'Activity logs retrieved',
        result.meta,
      );
    }

    // For team_member: scope to their own activity
    const scopedDto = { ...dto, userId };
    const result = await this.activityLogsService.findAll(scopedDto);
    return ApiResponse.success(
      result.data,
      'Activity logs retrieved',
      result.meta,
    );
  }

  @Get('recent')
  @ApiOperation({ summary: 'Get recent activity logs (latest 10)' })
  async getRecent(
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: string,
  ) {
    const result = await this.activityLogsService.getRecent(
      userId,
      userRole,
    );
    return ApiResponse.success(result, 'Recent activities retrieved');
  }

  @Get('entity/:entityType/:entityId')
  @ApiOperation({ summary: 'Get activity logs for a specific entity' })
  @ApiParam({ name: 'entityType', example: 'task' })
  @ApiParam({ name: 'entityId', type: 'string', format: 'uuid' })
  async findByEntity(
    @Param('entityType') entityType: string,
    @Param('entityId', ParseUUIDPipe) entityId: string,
  ) {
    const result = await this.activityLogsService.findByEntity(
      entityType,
      entityId,
    );
    return ApiResponse.success(result, 'Entity activity logs retrieved');
  }

  @Get('user/:userId')
  @ApiOperation({ summary: 'Get activity logs for a specific user' })
  @ApiParam({ name: 'userId', type: 'string', format: 'uuid' })
  async findByUser(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Query() dto: QueryActivityLogsDto,
  ) {
    const result = await this.activityLogsService.findByUser(userId, dto);
    return ApiResponse.success(
      result.data,
      'User activity logs retrieved',
      result.meta,
    );
  }
}