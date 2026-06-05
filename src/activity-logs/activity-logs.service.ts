import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityAction } from '@prisma/client';
import { QueryActivityLogsDto } from './dto/query-activity-logs.dto';
import { getPaginationParams, buildPaginationMeta } from '../common/dto/pagination.dto';

interface LogActivityDto {
  userId?: string;
  action: ActivityAction;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, any>;
}

@Injectable()
export class ActivityLogsService {
  constructor(private prisma: PrismaService) {}

  async log(dto: LogActivityDto): Promise<void> {
    try {
      await this.prisma.activityLog.create({
        data: {
          userId: dto.userId,
          action: dto.action,
          entityType: dto.entityType,
          entityId: dto.entityId,
          metadata: dto.metadata,
        },
      });
    } catch (error) {
      console.error('Failed to log activity:', error);
    }
  }

  async findAll(dto: QueryActivityLogsDto) {
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 10;
    const { skip, take } = getPaginationParams(page, limit);

    const where: any = {};
    if (dto.action) where.action = dto.action;
    if (dto.entityType) where.entityType = dto.entityType;
    if (dto.entityId) where.entityId = dto.entityId;
    if (dto.userId) where.userId = dto.userId;
    if (dto.dateFrom || dto.dateTo) {
      where.createdAt = {
        ...(dto.dateFrom && { gte: new Date(dto.dateFrom) }),
        ...(dto.dateTo && { lte: new Date(dto.dateTo) }),
      };
    }

    const [logs, total] = await Promise.all([
      this.prisma.activityLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        include: { user: { select: { id: true, name: true, avatarUrl: true } } },
      }),
      this.prisma.activityLog.count({ where }),
    ]);

    return {
      data: { logs, total },
      meta: buildPaginationMeta(total, page, limit),
    };
  }

  async getRecent(userId: string, userRole: string) {
    const where: any =
      userRole === 'admin' || userRole === 'project_manager' ? {} : { userId };

    const logs = await this.prisma.activityLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: { user: { select: { id: true, name: true, avatarUrl: true } } },
    });

    return { logs, total: logs.length };
  }

  async findByEntity(entityType: string, entityId: string) {
    return this.prisma.activityLog.findMany({
      where: { entityType, entityId },
      orderBy: { createdAt: 'desc' },
      include: { user: { select: { id: true, name: true, avatarUrl: true } } },
      take: 20,
    });
  }

  async findByUser(userId: string, dto: QueryActivityLogsDto) {
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 10;
    const { skip, take } = getPaginationParams(page, limit);

    const where: any = { userId };
    if (dto.action) where.action = dto.action;

    const [logs, total] = await Promise.all([
      this.prisma.activityLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        include: { user: { select: { id: true, name: true, avatarUrl: true } } },
      }),
      this.prisma.activityLog.count({ where }),
    ]);

    return {
      data: { logs, total },
      meta: buildPaginationMeta(total, page, limit),
    };
  }
}