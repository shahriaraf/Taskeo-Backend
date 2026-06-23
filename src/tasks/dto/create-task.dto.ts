import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TaskPriority, TaskStatus } from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateTaskDto {
  @ApiProperty({ example: 'Setup API Routes' })
  @IsString()
  @IsNotEmpty()
  @MinLength(3, { message: 'Task title must be at least 3 characters' })
  @MaxLength(300, { message: 'Task title must not exceed 300 characters' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  title!: string;

  @ApiPropertyOptional({ example: 'Create all REST API endpoints for the tasks module' })
  @IsOptional()
  @IsString()
  @MaxLength(5000, { message: 'Description must not exceed 5000 characters' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  description?: string;

  @ApiProperty({ example: 'uuid-of-project' })
  @IsUUID('4', { message: 'projectId must be a valid UUID' })
  @IsNotEmpty()
  projectId!: string;

  @ApiPropertyOptional({ example: 'uuid-of-user' })
  @IsOptional()
  @IsUUID('4', { message: 'assigneeId must be a valid UUID' })
  assigneeId?: string;

  @ApiProperty({ example: '2025-12-31T23:59:59.000Z' })
  @IsDateString({}, { message: 'dueDate must be a valid ISO 8601 date string' })
  @IsNotEmpty()
  // Normalize date-only strings (e.g. "2025-12-31") to end-of-day UTC
  // so the same-day due date does not immediately fail the past-deadline check.
  @Transform(({ value }) => {
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return `${value}T23:59:59.000Z`;
    }
    return value;
  })
  dueDate!: string;

  @ApiPropertyOptional({ enum: TaskPriority, default: TaskPriority.medium })
  @IsOptional()
  @IsEnum(TaskPriority, { message: 'priority must be one of: high, medium, low' })
  @Transform(({ value }) => value ?? TaskPriority.medium)
  priority: TaskPriority = TaskPriority.medium;

  @ApiPropertyOptional({ enum: TaskStatus, default: TaskStatus.todo })
  @IsOptional()
  @IsEnum(TaskStatus, { message: 'status must be one of: todo, in_progress, completed' })
  @Transform(({ value }) => (value === '' ? undefined : value))
  status?: TaskStatus;
}
