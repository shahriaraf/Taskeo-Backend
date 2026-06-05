// src/tasks/dto/filter-tasks.dto.ts

import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { TaskPriority, TaskStatus } from '@prisma/client';
import { PaginationDto } from '../../common/dto/pagination.dto';

export enum DeadlineStatus {
  OVERDUE = 'overdue',
  UPCOMING = 'upcoming',
}

export enum TaskSortBy {
  LATEST = 'latest',
  DEADLINE = 'deadline',
  PRIORITY = 'priority',
  UPDATED = 'updated',
}

export class FilterTasksDto extends PaginationDto {
  @ApiPropertyOptional({ example: 'uuid-of-project' })
  @IsOptional()
  @IsUUID()
  @Transform(({ value }) => (value === '' ? undefined : value))
  projectId?: string;

  @ApiPropertyOptional({ enum: TaskStatus })
  @IsOptional()
  @IsEnum(TaskStatus)
  @Transform(({ value }) => (value === '' ? undefined : value))
  status?: TaskStatus;

  @ApiPropertyOptional({ enum: TaskPriority })
  @IsOptional()
  @IsEnum(TaskPriority)
  @Transform(({ value }) => (value === '' ? undefined : value))
  priority?: TaskPriority;

  @ApiPropertyOptional({ example: 'uuid-of-assignee' })
  @IsOptional()
  @IsUUID()
  @Transform(({ value }) => (value === '' ? undefined : value))
  assigneeId?: string;

  @ApiPropertyOptional({ example: 'api routes' })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => (value === '' ? undefined : value))
  search?: string;

  @ApiPropertyOptional({ enum: DeadlineStatus })
  @IsOptional()
  @IsEnum(DeadlineStatus)
  @Transform(({ value }) => (value === '' ? undefined : value))
  deadlineStatus?: DeadlineStatus;

  @ApiPropertyOptional({ enum: TaskSortBy, default: TaskSortBy.LATEST })
  @IsOptional()
  @IsEnum(TaskSortBy)
  @Transform(({ value }) => (value === '' ? undefined : value))
  sort?: TaskSortBy;
}