// src/tasks/dto/create-subtask.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TaskPriority } from '@prisma/client';
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

export class CreateSubTaskDto {
  @ApiProperty({ example: 'Write unit tests for login' })
  @IsString()
  @IsNotEmpty()
  @MinLength(3, { message: 'Sub-task title must be at least 3 characters' })
  @MaxLength(300)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  title: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID('4')
  assigneeId?: string;

  @ApiProperty({ example: '2025-12-31' })
  @IsDateString()
  @IsNotEmpty()
  @Transform(({ value }) => {
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return `${value}T23:59:59.000Z`;
    }
    return value;
  })
  dueDate: string;

  @ApiPropertyOptional({ enum: TaskPriority })
  @IsOptional()
  @IsEnum(TaskPriority)
  priority?: TaskPriority;
}
