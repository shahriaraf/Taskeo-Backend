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
} from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateTaskDto {
  @ApiProperty({ example: 'Setup API Routes' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  title!: string;

  @ApiPropertyOptional({ example: 'Create all REST API endpoints' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: 'uuid-of-project' })
  @IsUUID()
  @IsNotEmpty()
  projectId!: string;

  @ApiPropertyOptional({ example: 'uuid-of-user' })
  @IsOptional()
  @IsUUID()
  assigneeId?: string;

  @ApiProperty({ example: '2025-12-31T23:59:59.000Z' })
  @IsDateString()
  @IsNotEmpty()
  // Normalize date-only strings (e.g. "2025-12-31") to end-of-day UTC so
  // the same-day due date does not immediately fail the past-deadline check
  @Transform(({ value }) => {
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return `${value}T23:59:59.000Z`;
    }
    return value;
  })
  dueDate!: string;

  @ApiPropertyOptional({ enum: TaskPriority, default: TaskPriority.medium })
  @IsOptional()
  @IsEnum(TaskPriority)
  @Transform(({ value }) => value ?? TaskPriority.medium)
  priority: TaskPriority = TaskPriority.medium;

  @ApiPropertyOptional({ enum: TaskStatus, default: TaskStatus.todo })
  @IsOptional()
  @IsEnum(TaskStatus)
  @Transform(({ value }) => (value === '' ? undefined : value))
  status?: TaskStatus;
}