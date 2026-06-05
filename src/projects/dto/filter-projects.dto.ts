// src/projects/dto/filter-projects.dto.ts

import { IsEnum, IsOptional, IsString, IsInt, Min } from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { ProjectStatus } from '@prisma/client';

export enum ProjectSortBy {
  LATEST = 'latest',
  DEADLINE = 'deadline',
  NAME = 'name',
  UPDATED = 'updated',
}

export class FilterProjectsDto {
  @IsOptional()
  @IsString()
  @Transform(({ value }) => (value === '' ? undefined : value))
  search?: string;

  @ApiPropertyOptional({ enum: ProjectStatus })
  @IsOptional()
  @IsEnum(ProjectStatus)
  @Transform(({ value }) => (value === '' ? undefined : value))
  status?: ProjectStatus;

  @ApiPropertyOptional({ enum: ProjectSortBy })
  @IsOptional()
  @IsEnum(ProjectSortBy)
  @Transform(({ value }) => (value === '' ? undefined : value))
  sort?: ProjectSortBy = ProjectSortBy.LATEST;

  // Pagination
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 12;
}