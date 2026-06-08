import { UserRole } from '@prisma/client';

export class User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatarUrl?: string;
  isActive: boolean;
  lastLogin?: Date;
  createdAt: Date;
  updatedAt: Date;
}
