// src/projects/dto/create-project.dto.ts

import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ProjectStatus } from '@prisma/client';

export class CreateProjectDto {
  @ApiProperty({ example: 'E-Commerce Platform' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name: string;

  @ApiPropertyOptional({ example: 'Build a full-featured e-commerce platform' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: '2025-12-31' })
  @IsDateString()
  @IsNotEmpty()
  deadline: string;

  @ApiPropertyOptional({ enum: ProjectStatus, default: ProjectStatus.active })
  @IsOptional()
  @IsEnum(ProjectStatus)
  status?: ProjectStatus;
}