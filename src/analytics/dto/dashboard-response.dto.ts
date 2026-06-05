// src/analytics/dto/dashboard-response.dto.ts

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class KPIDto {
  @ApiProperty() totalProjects: number;
  @ApiProperty() totalTasks: number;
  @ApiProperty() completedTasks: number;
  @ApiProperty() pendingTasks: number;
  @ApiProperty() overdueTasks: number;
}

export class ProjectSummaryDto {
  @ApiProperty() id: string;
  @ApiProperty() name: string;
  @ApiProperty() status: string;
  @ApiProperty() deadline: Date;
  @ApiProperty() daysUntilDeadline: number;
  @ApiProperty() totalTasks: number;
  @ApiProperty() completedTasks: number;
  @ApiProperty() pendingTasks: number;
  @ApiProperty() completionPercent: number;
  @ApiProperty() isOverdue: boolean;
}

export class TasksByPriorityDto {
  @ApiProperty() priority: string;
  @ApiProperty() count: number;
}

export class TaskStatusDistributionDto {
  @ApiProperty() status: string;
  @ApiProperty() count: number;
}

export class MemberWorkloadDto {
  @ApiProperty() user: {
    id: string;
    name: string;
    avatarUrl?: string | null;
  };
  @ApiProperty() totalTasks: number;
  @ApiProperty() completedTasks: number;
  @ApiProperty() pendingTasks: number;
}

export class ProjectProgressTrendDto {
  @ApiProperty() date: string;
  @ApiProperty() completed: number;
  @ApiProperty() created: number;
}

export class DashboardResponseDto {
  @ApiProperty({ type: KPIDto })
  kpis: KPIDto;

  @ApiProperty({ type: [ProjectSummaryDto] })
  projectSummaries: ProjectSummaryDto[];

  @ApiProperty({ type: [MemberWorkloadDto] })
  memberWorkload: MemberWorkloadDto[];
}