import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityLogsService } from '../activity-logs/activity-logs.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { FilterProjectsDto, ProjectSortBy } from './dto/filter-projects.dto';
import { ActivityAction, UserRole, ProjectStatus } from '@prisma/client';
import {
  getPaginationParams,
  buildPaginationMeta,
} from '../common/dto/pagination.dto';
import { PastDeadlineException } from '../common/exceptions/app.exception';

@Injectable()
export class ProjectsService {
  private readonly logger = new Logger(ProjectsService.name);

  constructor(
    private prisma: PrismaService,
    private activityLogs: ActivityLogsService,
    private notifications: NotificationsService,
  ) {}

  async create(dto: CreateProjectDto, userId: string) {
    // Validate deadline
    if (new Date(dto.deadline) < new Date()) {
      throw new PastDeadlineException();
    }

    const project = await this.prisma.project.create({
      data: {
        name: dto.name,
        description: dto.description,
        deadline: new Date(dto.deadline),
        status: dto.status,
        ownerId: userId,
        // Add creator as owner member
        members: {
          create: {
            userId,
            role: 'owner',
          },
        },
      },
      include: this.getProjectInclude(),
    });

    await this.activityLogs.log({
      userId,
      action: ActivityAction.PROJECT_CREATED,
      entityType: 'project',
      entityId: project.id,
      metadata: { projectName: project.name },
    });

    return project;
  }

  async findAll(dto: FilterProjectsDto, userId: string, userRole: string) {
    const { skip, take } = getPaginationParams(dto.page ?? 1, dto.limit ?? 10)

    // Build where clause
    const where: any = {
      AND: [
        // Non-admins see only their projects
        userRole !== UserRole.admin
          ? { members: { some: { userId } } }
          : {},
        // Search filter
        dto.search
          ? {
              OR: [
                { name: { contains: dto.search, mode: 'insensitive' } },
                { description: { contains: dto.search, mode: 'insensitive' } },
              ],
            }
          : {},
        // Status filter
        dto.status ? { status: dto.status } : {},
      ],
    };

    // Sort options
    const orderBy = this.getProjectOrderBy(dto.sort ?? ProjectSortBy.LATEST)

    const [projects, total] = await Promise.all([
      this.prisma.project.findMany({
        where,
        orderBy,
        skip,
        take,
        include: this.getProjectInclude(),
      }),
      this.prisma.project.count({ where }),
    ]);

    // Enrich with computed fields
    const enriched = projects.map((p) => this.enrichProject(p));

    return {
      data: enriched,
      meta: buildPaginationMeta(total, dto.page ?? 1, dto.limit ?? 10)
    };
  }

  async findOne(id: string, userId: string, userRole: string) {
    const project = await this.prisma.project.findUnique({
      where: { id },
      include: {
        ...this.getProjectInclude(),
        tasks: {
          include: {
            assignee: {
              select: { id: true, name: true, avatarUrl: true },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    // Access control
    if (userRole !== UserRole.admin) {
      const isMember = project.members.some((m) => m.userId === userId);
      if (!isMember) {
        throw new ForbiddenException('Access denied to this project');
      }
    }

    return this.enrichProject(project);
  }

  async update(id: string, dto: UpdateProjectDto, userId: string, userRole: string) {
    const project = await this.findAndCheckAccess(id, userId, userRole);

    if (dto.deadline && new Date(dto.deadline) < new Date()) {
      throw new PastDeadlineException();
    }

    const updated = await this.prisma.project.update({
      where: { id },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.deadline && { deadline: new Date(dto.deadline) }),
        ...(dto.status && { status: dto.status }),
      },
      include: this.getProjectInclude(),
    });

    await this.activityLogs.log({
      userId,
      action: ActivityAction.PROJECT_UPDATED,
      entityType: 'project',
      entityId: id,
      metadata: { projectName: updated.name, changes: dto },
    });

    return this.enrichProject(updated);
  }

  async remove(id: string, userId: string, userRole: string) {
    const project = await this.findAndCheckAccess(id, userId, userRole);

    await this.prisma.project.delete({ where: { id } });

    await this.activityLogs.log({
      userId,
      action: ActivityAction.PROJECT_DELETED,
      entityType: 'project',
      entityId: id,
      metadata: { projectName: project.name },
    });

    return { message: 'Project deleted successfully' };
  }

  async getProjectStats(id: string) {
    const tasks = await this.prisma.task.findMany({
      where: { projectId: id },
      select: { status: true, dueDate: true },
    });

    const total = tasks.length;
    const completed = tasks.filter((t) => t.status === 'completed').length;
    const pending = tasks.filter((t) => t.status !== 'completed').length;
    const overdue = tasks.filter(
      (t) => t.dueDate < new Date() && t.status !== 'completed',
    ).length;

    return {
      totalTasks: total,
      completedTasks: completed,
      pendingTasks: pending,
      overdueTasks: overdue,
      completionPercentage: total > 0 ? Math.round((completed / total) * 100) : 0,
    };
  }

  private async findAndCheckAccess(id: string, userId: string, userRole: string) {
    const project = await this.prisma.project.findUnique({
      where: { id },
      include: { members: true },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    if (userRole === UserRole.admin) return project;

    const member = project.members.find((m) => m.userId === userId);
    if (!member || (member.role !== 'owner' && member.role !== 'manager')) {
      throw new ForbiddenException('Only project owners and managers can perform this action');
    }

    return project;
  }

  private getProjectInclude() {
    return {
      owner: {
        select: { id: true, name: true, email: true, avatarUrl: true },
      },
      members: {
        include: {
          user: {
            select: { id: true, name: true, email: true, avatarUrl: true, role: true },
          },
        },
      },
      _count: {
        select: { tasks: true, members: true },
      },
    };
  }

  private enrichProject(project: any) {
    const now = new Date();
    const deadline = new Date(project.deadline);
    const daysUntilDeadline = Math.ceil(
      (deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
    );

    return {
      ...project,
      isOverdue: deadline < now && project.status !== ProjectStatus.completed,
      daysUntilDeadline,
    };
  }

  private getProjectOrderBy(sort: ProjectSortBy) {
    const sortMap = {
      [ProjectSortBy.LATEST]: { createdAt: 'desc' as const },
      [ProjectSortBy.DEADLINE]: { deadline: 'asc' as const },
      [ProjectSortBy.NAME]: { name: 'asc' as const },
      [ProjectSortBy.UPDATED]: { updatedAt: 'desc' as const },
    };
    return sortMap[sort] || { createdAt: 'desc' as const };
  }
}