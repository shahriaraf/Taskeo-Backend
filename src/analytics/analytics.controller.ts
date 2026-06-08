// src/analytics/analytics.controller.ts

import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ApiResponse } from '../common/response/api-response';

@ApiTags('Analytics')
@ApiBearerAuth('JWT-auth')
@Controller('analytics')
export class AnalyticsController {
  constructor(private analyticsService: AnalyticsService) { }

  @Get('dashboard')
  @ApiOperation({ summary: 'Get full dashboard data' })
  async getDashboard(
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: string,
  ) {
    const data = await this.analyticsService.getDashboard(userId, userRole);
    return ApiResponse.success(data, 'Dashboard data retrieved');
  }

  @Get('kpis')
  @ApiOperation({ summary: 'Get KPI metrics' })
  async getKPIs(
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: string,
  ) {
    const data = await this.analyticsService.getKPIs(userId, userRole);
    return ApiResponse.success(data, 'KPIs retrieved');
  }

  @Get('tasks-by-priority')
  @ApiOperation({ summary: 'Get tasks grouped by priority' })
  async getTasksByPriority(
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: string,
  ) {
    const data = await this.analyticsService.getTasksByPriority(userId, userRole);
    return ApiResponse.success(data, 'Tasks by priority retrieved');
  }

  @Get('task-status-distribution')
  @ApiOperation({ summary: 'Get task status distribution' })
  async getStatusDistribution(
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: string,
  ) {
    const data = await this.analyticsService.getTaskStatusDistribution(userId, userRole);
    return ApiResponse.success(data, 'Status distribution retrieved');
  }

  @Get('member-workload')
  @ApiOperation({ summary: 'Get team member workload summary' })
  async getMemberWorkload(
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: string,
  ) {
    const data = await this.analyticsService.getMemberWorkload(userId, userRole);
    return ApiResponse.success(data, 'Member workload retrieved');
  }

  @Get('upcoming-deadlines')
  @ApiOperation({ summary: 'Get tasks with upcoming deadlines' })
  async getUpcomingDeadlines(
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: string,
  ) {
    const data = await this.analyticsService.getUpcomingDeadlines(userId, userRole);
    return ApiResponse.success(data, 'Upcoming deadlines retrieved');
  }

  @Get('high-priority-tasks')
  @ApiOperation({ summary: 'Get high priority pending tasks' })
  async getHighPriorityTasks(
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: string,
  ) {
    const data = await this.analyticsService.getHighPriorityTasks(userId, userRole);
    return ApiResponse.success(data, 'High priority tasks retrieved');
  }

  @Get('progress-trend')
  @ApiOperation({ summary: 'Get task progress trend over last 6 weeks' })
  async getProgressTrend(
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: string,
  ) {
    const data = await this.analyticsService.getProgressTrend(userId, userRole);
    return ApiResponse.success(data, 'Progress trend retrieved');
  }
}