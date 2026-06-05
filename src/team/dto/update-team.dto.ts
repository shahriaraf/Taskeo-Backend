// src/team/dto/update-team.dto.ts

import { IsEnum, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { ProjectMemberRole } from '@prisma/client';

export class UpdateMemberRoleDto {
  @ApiProperty({ enum: ProjectMemberRole })
  @IsEnum(ProjectMemberRole)
  @IsNotEmpty()
  role: ProjectMemberRole;
}
