// src/activity-logs/dto/query-activity-logs.dto.ts

import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { ActivityAction } from '@prisma/client';
import { PaginationDto } from '../../common/dto/pagination.dto';

export class QueryActivityLogsDto extends PaginationDto {
  @ApiPropertyOptional({ enum: ActivityAction })
  @IsOptional()
  @IsEnum(ActivityAction)
  action?: ActivityAction;

  @ApiPropertyOptional({ example: 'task' })
  @IsOptional()
  @IsString()
  entityType?: string;

  @ApiPropertyOptional({ example: 'uuid-of-entity' })
  @IsOptional()
  @IsUUID()
  entityId?: string;

  @ApiPropertyOptional({ example: 'uuid-of-user' })
  @IsOptional()
  @IsUUID()
  userId?: string;

  @ApiPropertyOptional({ example: '2025-01-01' })
  @IsOptional()
  @IsString()
  dateFrom?: string;

  @ApiPropertyOptional({ example: '2025-12-31' })
  @IsOptional()
  @IsString()
  dateTo?: string;
}