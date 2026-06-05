// src/tasks/tasks.service.ts

import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityLogsService } from '../activity-logs/activity-logs.service';
import { NotificationsService } from '../notifications/notifications.service';
import { EventsGateway } from '../events/events.gateway';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { FilterTasksDto, DeadlineStatus, TaskSortBy } from './dto/filter-tasks.dto';
import { UpdateTaskStatusDto } from './dto/update-task-status.dto';
import {
  ActivityAction,
  UserRole,
  TaskStatus,
  NotificationType,
} from '@prisma/client';
import {
  DuplicateTaskException,
  CompletedTaskReassignException,
  PastDeadlineException,
  NotProjectMemberException,
  InsufficientPermissionsException,
} from '../common/exceptions/app.exception';
import {
  getPaginationParams,
  buildPaginationMeta,
} from '../common/dto/pagination.dto';

@Injectable()
export class TasksService {
  private readonly logger = new Logger(TasksService.name);

  constructor(
    private prisma: PrismaService,
    private activityLogs: ActivityLogsService,
    private notifications: NotificationsService,
    private eventsGateway: EventsGateway,
  ) {}

  async create(dto: CreateTaskDto, userId: string) {
    // ── Validate due date ─────────────────────────────────
    if (new Date(dto.dueDate) < new Date()) {
      throw new PastDeadlineException();
    }

    // ── Validate project exists ───────────────────────────
    const project = await this.prisma.project.findUnique({
      where: { id: dto.projectId },
      include: { members: true },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    // ── Check duplicate task title in same project ────────
    const existingTask = await this.prisma.task.findUnique({
      where: {
        projectId_title: {
          projectId: dto.projectId,
          title: dto.title,
        },
      },
    });

    if (existingTask) {
      throw new DuplicateTaskException();
    }

    // ── Validate assignee is project member ───────────────
    if (dto.assigneeId) {
      const isMember = project.members.some((m) => m.userId === dto.assigneeId);
      if (!isMember) {
        throw new NotProjectMemberException();
      }
    }

    const task = await this.prisma.task.create({
      data: {
        title: dto.title,
        description: dto.description,
        projectId: dto.projectId,
        assigneeId: dto.assigneeId,
        dueDate: new Date(dto.dueDate),
        priority: dto.priority,
        status: dto.status,
        createdBy: userId,
      },
      include: this.getTaskInclude(),
    });

    // ── Activity log ──────────────────────────────────────
    await this.activityLogs.log({
      userId,
      action: ActivityAction.TASK_CREATED,
      entityType: 'task',
      entityId: task.id,
      metadata: {
        taskTitle: task.title,
        projectName: project.name,
      },
    });

    // ── Notify assignee ───────────────────────────────────
    if (dto.assigneeId && dto.assigneeId !== userId) {
      await this.notifications.create({
        userId: dto.assigneeId,
        title: 'New Task Assigned',
        message: `You have been assigned to task "${task.title}" in project "${project.name}"`,
        type: NotificationType.task_assigned,
        entityType: 'task',
        entityId: task.id,
      });

      await this.activityLogs.log({
        userId,
        action: ActivityAction.TASK_ASSIGNED,
        entityType: 'task',
        entityId: task.id,
        metadata: {
          taskTitle: task.title,
          assigneeId: dto.assigneeId,
        },
      });
    }

    // ── Emit socket event ─────────────────────────────────
    this.eventsGateway.emitToProject(dto.projectId, 'task:created', task);

    return this.enrichTask(task);
  }

  async findAll(dto: FilterTasksDto, userId: string, userRole: string) {
    const { skip, take } = getPaginationParams(dto.page ?? 1, dto.limit ?? 10)

    const where: any = {
      AND: [
        // Team members see only assigned tasks
        userRole === UserRole.team_member ? { assigneeId: userId } : {},

        // Project filter
        dto.projectId ? { projectId: dto.projectId } : {},

        // Status filter
        dto.status ? { status: dto.status } : {},

        // Priority filter
        dto.priority ? { priority: dto.priority } : {},

        // Assignee filter
        dto.assigneeId ? { assigneeId: dto.assigneeId } : {},

        // Search
        dto.search
          ? {
              OR: [
                { title: { contains: dto.search, mode: 'insensitive' } },
                { description: { contains: dto.search, mode: 'insensitive' } },
              ],
            }
          : {},

        // Deadline status
        dto.deadlineStatus === DeadlineStatus.OVERDUE
          ? { dueDate: { lt: new Date() }, status: { not: TaskStatus.completed } }
          : dto.deadlineStatus === DeadlineStatus.UPCOMING
          ? { dueDate: { gte: new Date() } }
          : {},
      ],
    };

    const orderBy = this.getTaskOrderBy(dto.sort ?? TaskSortBy.LATEST)

    const [tasks, total] = await Promise.all([
      this.prisma.task.findMany({
        where,
        orderBy,
        skip,
        take,
        include: this.getTaskInclude(),
      }),
      this.prisma.task.count({ where }),
    ]);

    return {
      data: tasks.map((t) => this.enrichTask(t)),
      meta: buildPaginationMeta(total, dto.page ?? 1, dto.limit ?? 10),
    };
  }

  async findOne(id: string, userId: string, userRole: string) {
    const task = await this.prisma.task.findUnique({
      where: { id },
      include: {
        ...this.getTaskInclude(),
        comments: {
          include: {
            user: {
              select: { id: true, name: true, avatarUrl: true },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
        attachments: {
          include: {
            uploader: {
              select: { id: true, name: true },
            },
          },
        },
      },
    });

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    this.checkTaskAccess(task, userId, userRole);
    return this.enrichTask(task);
  }

  async update(id: string, dto: UpdateTaskDto, userId: string, userRole: string) {
    const task = await this.prisma.task.findUnique({
      where: { id },
      include: { project: { include: { members: true } } },
    });

    if (!task) throw new NotFoundException('Task not found');

    this.checkTaskAccess(task, userId, userRole);

    // ── Business Rules ────────────────────────────────────

    // Rule: Cannot reassign completed task
    if (
      task.status === TaskStatus.completed &&
      dto.assigneeId &&
      dto.assigneeId !== task.assigneeId
    ) {
      throw new CompletedTaskReassignException();
    }

    // Rule: Due date must be in future
    if (dto.dueDate && new Date(dto.dueDate) < new Date()) {
      throw new PastDeadlineException();
    }

    // Rule: Check duplicate title in project
    if (dto.title && dto.title !== task.title) {
      const duplicate = await this.prisma.task.findUnique({
        where: {
          projectId_title: {
            projectId: task.projectId,
            title: dto.title,
          },
        },
      });
      if (duplicate) throw new DuplicateTaskException();
    }

    // Rule: Assignee must be project member
    if (dto.assigneeId) {
      const isMember = task.project.members.some(
        (m) => m.userId === dto.assigneeId,
      );
      if (!isMember) throw new NotProjectMemberException();
    }

    const updated = await this.prisma.task.update({
      where: { id },
      data: {
        ...(dto.title && { title: dto.title }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.assigneeId !== undefined && { assigneeId: dto.assigneeId }),
        ...(dto.dueDate && { dueDate: new Date(dto.dueDate) }),
        ...(dto.priority && { priority: dto.priority }),
        ...(dto.status && { status: dto.status }),
      },
      include: this.getTaskInclude(),
    });

    await this.activityLogs.log({
      userId,
      action: ActivityAction.TASK_UPDATED,
      entityType: 'task',
      entityId: id,
      metadata: { taskTitle: updated.title, changes: dto },
    });

    // Notify new assignee
    if (dto.assigneeId && dto.assigneeId !== task.assigneeId && dto.assigneeId !== userId) {
      await this.notifications.create({
        userId: dto.assigneeId,
        title: 'Task Assigned to You',
        message: `Task "${updated.title}" has been assigned to you`,
        type: NotificationType.task_assigned,
        entityType: 'task',
        entityId: id,
      });
    }

    this.eventsGateway.emitToProject(task.projectId, 'task:updated', updated);

    return this.enrichTask(updated);
  }

  async updateStatus(id: string, dto: UpdateTaskStatusDto, userId: string, userRole: string) {
    const task = await this.prisma.task.findUnique({
      where: { id },
      include: { project: true },
    });

    if (!task) throw new NotFoundException('Task not found');

    this.checkTaskAccess(task, userId, userRole);

    const updated = await this.prisma.task.update({
      where: { id },
      data: { status: dto.status },
      include: this.getTaskInclude(),
    });

    await this.activityLogs.log({
      userId,
      action: ActivityAction.TASK_STATUS_CHANGED,
      entityType: 'task',
      entityId: id,
      metadata: {
        taskTitle: task.title,
        oldStatus: task.status,
        newStatus: dto.status,
        projectName: task.project.name,
      },
    });

    this.eventsGateway.emitToProject(
      task.projectId,
      'task:status_changed',
      updated,
    );

    return this.enrichTask(updated);
  }

  async remove(id: string, userId: string, userRole: string) {
    const task = await this.prisma.task.findUnique({ where: { id } });
    if (!task) throw new NotFoundException('Task not found');

    if (userRole === UserRole.team_member) {
      throw new InsufficientPermissionsException();
    }

    await this.prisma.task.delete({ where: { id } });

    await this.activityLogs.log({
      userId,
      action: ActivityAction.TASK_DELETED,
      entityType: 'task',
      entityId: id,
      metadata: { taskTitle: task.title },
    });

    this.eventsGateway.emitToProject(task.projectId, 'task:deleted', { id });

    return { message: 'Task deleted successfully' };
  }

  private checkTaskAccess(task: any, userId: string, userRole: string) {
    if (userRole === UserRole.admin || userRole === UserRole.project_manager) {
      return;
    }
    // Team members can only access their assigned tasks
    if (task.assigneeId !== userId) {
      throw new ForbiddenException('Access denied to this task');
    }
  }

  private getTaskInclude() {
    return {
      project: {
        select: { id: true, name: true },
      },
      assignee: {
        select: { id: true, name: true, email: true, avatarUrl: true },
      },
      creator: {
        select: { id: true, name: true },
      },
      _count: {
        select: { comments: true, attachments: true },
      },
    };
  }

  private enrichTask(task: any) {
    const now = new Date();
    return {
      ...task,
      isOverdue:
        new Date(task.dueDate) < now && task.status !== TaskStatus.completed,
    };
  }

  private getTaskOrderBy(sort: TaskSortBy) {
    const sortMap = {
      [TaskSortBy.LATEST]: { createdAt: 'desc' as const },
      [TaskSortBy.DEADLINE]: { dueDate: 'asc' as const },
      [TaskSortBy.PRIORITY]: { priority: 'asc' as const },
      [TaskSortBy.UPDATED]: { updatedAt: 'desc' as const },
    };
    return sortMap[sort] || { createdAt: 'desc' as const };
  }
}