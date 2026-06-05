// src/users/users.service.ts

import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserRole } from '@prisma/client';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findAll(search?: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const where = search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' as const } },
            { email: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {};

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          avatarUrl: true,
          isActive: true,
          lastLogin: true,
          createdAt: true,
          _count: {
            select: { assignedTasks: true, ownedProjects: true },
          },
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    return { users, total, page, limit };
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        avatarUrl: true,
        isActive: true,
        lastLogin: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: { assignedTasks: true, ownedProjects: true, comments: true },
        },
      },
    });

    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async update(
    id: string,
    dto: UpdateUserDto,
    requesterId: string,
    requesterRole: string,
  ) {
    // Users can only update their own profile; admins can update anyone
    if (id !== requesterId && requesterRole !== UserRole.admin) {
      throw new ForbiddenException('You can only update your own profile');
    }

    // Only admins can change roles or deactivate accounts
    if ((dto.role || dto.isActive !== undefined) && requesterRole !== UserRole.admin) {
      throw new ForbiddenException('Only admins can change roles or account status');
    }

    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');

    return this.prisma.user.update({
      where: { id },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.avatarUrl !== undefined && { avatarUrl: dto.avatarUrl }),
        ...(dto.role && { role: dto.role }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        avatarUrl: true,
        isActive: true,
        updatedAt: true,
      },
    });
  }

  async remove(id: string, requesterRole: string) {
    if (requesterRole !== UserRole.admin) {
      throw new ForbiddenException('Only admins can delete users');
    }

    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');

    // Soft delete by deactivating
    return this.prisma.user.update({
      where: { id },
      data: { isActive: false },
      select: { id: true, name: true, isActive: true },
    });
  }

  async getUserTaskStats(userId: string) {
    const [total, completed, inProgress, todo, overdue] = await Promise.all([
      this.prisma.task.count({ where: { assigneeId: userId } }),
      this.prisma.task.count({ where: { assigneeId: userId, status: 'completed' } }),
      this.prisma.task.count({ where: { assigneeId: userId, status: 'in_progress' } }),
      this.prisma.task.count({ where: { assigneeId: userId, status: 'todo' } }),
      this.prisma.task.count({
        where: {
          assigneeId: userId,
          status: { not: 'completed' },
          dueDate: { lt: new Date() },
        },
      }),
    ]);

    return { total, completed, inProgress, todo, overdue };
  }
}
