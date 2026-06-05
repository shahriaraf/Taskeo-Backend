// src/team/dto/create-team.dto.ts

import { IsEnum, IsNotEmpty, IsOptional, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ProjectMemberRole } from '@prisma/client';

export class AddMemberDto {
  @ApiProperty({ example: 'uuid-of-project' })
  @IsUUID()
  @IsNotEmpty()
  projectId: string;

  @ApiProperty({ example: 'uuid-of-user' })
  @IsUUID()
  @IsNotEmpty()
  userId: string;

  @ApiPropertyOptional({ enum: ProjectMemberRole, default: ProjectMemberRole.member })
  @IsOptional()
  @IsEnum(ProjectMemberRole)
  role?: ProjectMemberRole;
}
