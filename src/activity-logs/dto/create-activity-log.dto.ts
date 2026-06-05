// src/activity-logs/dto/create-activity-log.dto.ts

import {
  IsEnum,
  IsJSON,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ActivityAction } from '@prisma/client';

export class CreateActivityLogDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  userId?: string;

  @ApiProperty({ enum: ActivityAction })
  @IsEnum(ActivityAction)
  action: ActivityAction;

  @ApiPropertyOptional({ example: 'task' })
  @IsOptional()
  @IsString()
  entityType?: string;

  @ApiPropertyOptional({ example: 'uuid-of-entity' })
  @IsOptional()
  @IsUUID()
  entityId?: string;

  @ApiPropertyOptional({ example: { taskTitle: 'Setup API' } })
  @IsOptional()
  metadata?: Record<string, any>;
}