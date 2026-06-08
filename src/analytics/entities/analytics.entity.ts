import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class KPIEntity {
  @ApiProperty({ example: 12 }) totalProjects: number;
  @ApiProperty({ example: 48 }) totalTasks: number;
  @ApiProperty({ example: 30 }) completedTasks: number;
  @ApiProperty({ example: 18 }) pendingTasks: number;
  @ApiProperty({ example: 5 })  overdueTasks: number;
}

export class ProjectSummaryEntity {
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

export class PriorityChartEntity {
  @ApiProperty({ example: 'high' })   priority: string;
  @ApiProperty({ example: 10 })       count: number;
}

export class StatusChartEntity {
  @ApiProperty({ example: 'in_progress' }) status: string;
  @ApiProperty({ example: 8 })             count: number;
}

export class WorkloadUserEntity {
  @ApiProperty() id: string;
  @ApiProperty() name: string;
  @ApiPropertyOptional() avatarUrl?: string | null;
}

export class MemberWorkloadEntity {
  @ApiProperty({ type: WorkloadUserEntity }) user: WorkloadUserEntity;
  @ApiProperty() totalTasks: number;
  @ApiProperty() completedTasks: number;
  @ApiProperty() pendingTasks: number;
}

export class ProgressTrendEntity {
  @ApiProperty({ example: '2025-07-01' }) date: string;
  @ApiProperty({ example: 5 })            completed: number;
  @ApiProperty({ example: 8 })            created: number;
}