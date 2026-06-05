// src/team/entities/team.entity.ts
import { ProjectMemberRole } from '@prisma/client';

export class ProjectMember {
  id: string;
  projectId: string;
  userId: string;
  role: ProjectMemberRole;
  joinedAt: Date;
}
