// src/tasks/tasks.service.ts  (Phase 1 — adds email on assign, sub-task count awareness)
// Replaces the original tasks.service.ts

import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityLogsService } from '../activity-logs/activity-logs.service';
import { NotificationsService } from '../notifications/notifications.service';
import { MailService } from '../mail/mail.service';
import { EventsGateway } from '../events/events.gateway';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { FilterTasksDto } from './dto/filter-tasks.dto';
import { UpdateTaskStatusDto } from './dto/update-task-status.dto';
import {
  ActivityAction,
  NotificationType,
  UserRole,
  TaskStatus,
} from '@prisma/client';
import {
  getPaginationParams,
  buildPaginationMeta,
} from '../common/dto/pagination.dto';
import {
  DuplicateTaskException,
  PastDeadlineException,
  NotProjectMemberException,
  CompletedTaskReassignException,
} from '../common/exceptions/app.exception';

const TASK_INCLUDE = {
  project:  { select: { id: true, name: true } },
  assignee: { select: { id: true, name: true, email: true, avatarUrl: true } },
  creator:  { select: { id: true, name: true } },
  // Include top-level sub-task count and a preview of up to 3 sub-tasks
  subTasks: {
    where: { status: { not: TaskStatus.completed } },
    orderBy: { order: 'asc' as const },
    take: 3,
    select: {
      id: true,
      title: true,
      status: true,
      priority: true,
      assigneeId: true,
      dueDate: true,
    },
  },
  _count: {
    select: { comments: true, attachments: true, subTasks: true },
  },
};

@Injectable()
export class TasksService {
  private readonly logger = new Logger(TasksService.name);

  constructor(
    private prisma: PrismaService,
    private activityLogs: ActivityLogsService,
    private notifications: NotificationsService,
    private mailService: MailService,
    private eventsGateway: EventsGateway,
  ) {}

  async create(dto: CreateTaskDto, userId: string) {
    if (new Date(dto.dueDate) < new Date()) {
      throw new PastDeadlineException();
    }

    const project = await this.prisma.project.findUnique({
      where: { id: dto.projectId },
      include: { members: true },
    });
    if (!project) throw new NotFoundException('Project not found');

    // Check for duplicate task title in project
    const existingTask = await this.prisma.task.findUnique({
      where: { projectId_title: { projectId: dto.projectId, title: dto.title } },
    });
    if (existingTask) throw new DuplicateTaskException();

    // Validate assignee is a project member
    if (dto.assigneeId) {
      const isMember = project.members.some((m) => m.userId === dto.assigneeId);
      if (!isMember) throw new NotProjectMemberException();
    }

    const task = await this.prisma.task.create({
      data: {
        title:       dto.title,
        description: dto.description,
        projectId:   dto.projectId,
        assigneeId:  dto.assigneeId,
        dueDate:     new Date(dto.dueDate),
        priority:    dto.priority,
        status:      dto.status ?? TaskStatus.todo,
        createdBy:   userId,
      },
      include: TASK_INCLUDE,
    });

    await this.activityLogs.log({
      userId,
      action: ActivityAction.TASK_CREATED,
      entityType: 'task',
      entityId: task.id,
      metadata: { taskTitle: task.title, projectName: project.name },
    });

    // Notify and email the assignee if different from creator
    if (dto.assigneeId && dto.assigneeId !== userId) {
      await this.notifications.create({
        userId: dto.assigneeId,
        title: 'New Task Assigned to You',
        message: `You were assigned "${task.title}" in ${project.name}`,
        type: NotificationType.task_assigned,
        entityType: 'task',
        entityId: task.id,
      });

      const assignee = await this.prisma.user.findUnique({
        where: { id: dto.assigneeId },
        select: { name: true, email: true },
      });
      const creator = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { name: true },
      });
      if (assignee) {
        this.mailService
          .sendTaskAssigned({
            to:             assignee.email,
            assigneeName:   assignee.name,
            taskTitle:      task.title,
            projectName:    project.name,
            taskId:         task.id,
            dueDate:        task.dueDate.toLocaleDateString('en-US', { dateStyle: 'medium' }),
            assignedByName: creator?.name ?? 'A team member',
          })
          .catch(() => {});
      }
    }

    this.eventsGateway.emitToProject(dto.projectId, 'task:created', task);
    return task;
  }

  async findAll(dto: FilterTasksDto, userId: string, userRole: string) {
    const { skip, take } = getPaginationParams(dto.page ?? 1, dto.limit ?? 10);

    const where: any = {
      AND: [
        // Top-level tasks only (parentId = null) — sub-tasks are loaded separately
        { parentId: null },
        userRole !== UserRole.admin
          ? {
              OR: [
                { createdBy: userId },
                { assigneeId: userId },
                { project: { members: { some: { userId } } } },
              ],
            }
          : {},
        dto.search
          ? {
              OR: [
                { title:       { contains: dto.search, mode: 'insensitive' } },
                { description: { contains: dto.search, mode: 'insensitive' } },
              ],
            }
          : {},
        dto.status   ? { status:   dto.status }   : {},
        dto.priority ? { priority: dto.priority } : {},
        dto.projectId ? { projectId: dto.projectId } : {},
        dto.assigneeId ? { assigneeId: dto.assigneeId } : {},
      ],
    };

    const [tasks, total] = await Promise.all([
      this.prisma.task.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        include: TASK_INCLUDE,
      }),
      this.prisma.task.count({ where }),
    ]);

    return {
      data: tasks,
      meta: buildPaginationMeta(total, dto.page ?? 1, dto.limit ?? 10),
    };
  }

  async findOne(id: string, userId: string, userRole: string) {
    const task = await this.prisma.task.findUnique({
      where: { id },
      include: {
        ...TASK_INCLUDE,
        // Full sub-task list for single task view (no limit)
        subTasks: {
          orderBy: { order: 'asc' },
          include: {
            assignee: { select: { id: true, name: true, email: true, avatarUrl: true } },
            _count: { select: { comments: true } },
          },
        },
        comments: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          include: { user: { select: { id: true, name: true, avatarUrl: true } } },
        },
        attachments: {
          orderBy: { createdAt: 'desc' },
          select: {
            id: true, filename: true, url: true, size: true, mimeType: true, createdAt: true,
            uploader: { select: { id: true, name: true } },
          },
        },
      },
    });

    if (!task) throw new NotFoundException('Task not found');

    if (
      userRole === UserRole.team_member &&
      task.assigneeId !== userId &&
      task.createdBy !== userId
    ) {
      throw new ForbiddenException('Access denied');
    }

    return task;
  }

  async update(id: string, dto: UpdateTaskDto, userId: string, userRole: string) {
    const task = await this.prisma.task.findUnique({ where: { id } });
    if (!task) throw new NotFoundException('Task not found');

    if (
      userRole === UserRole.team_member &&
      task.assigneeId !== userId &&
      task.createdBy !== userId
    ) {
      throw new ForbiddenException('You can only edit tasks assigned to or created by you');
    }

    if (dto.assigneeId && task.status === TaskStatus.completed) {
      throw new CompletedTaskReassignException();
    }

    // If reassigning, notify the new assignee
    const isReassigned = dto.assigneeId && dto.assigneeId !== task.assigneeId;

    const updated = await this.prisma.task.update({
      where: { id },
      data: {
        ...(dto.title       !== undefined && { title: dto.title }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.assigneeId  !== undefined && { assigneeId: dto.assigneeId }),
        ...(dto.dueDate     !== undefined && { dueDate: new Date(dto.dueDate) }),
        ...(dto.priority    !== undefined && { priority: dto.priority }),
        ...(dto.status      !== undefined && { status: dto.status }),
      },
      include: TASK_INCLUDE,
    });

    await this.activityLogs.log({
      userId,
      action: ActivityAction.TASK_UPDATED,
      entityType: 'task',
      entityId: id,
      metadata: { changes: dto },
    });

    if (isReassigned && dto.assigneeId !== userId) {
      await this.notifications.create({
        userId: dto.assigneeId!,
        title: 'Task Reassigned to You',
        message: `You were assigned "${updated.title}"`,
        type: NotificationType.task_assigned,
        entityType: 'task',
        entityId: id,
      });

      const assignee = await this.prisma.user.findUnique({
        where: { id: dto.assigneeId! },
        select: { name: true, email: true },
      });
      const assigner = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { name: true },
      });
      if (assignee) {
        this.mailService
          .sendTaskAssigned({
            to:             assignee.email,
            assigneeName:   assignee.name,
            taskTitle:      updated.title,
            projectName:    (updated as any).project?.name ?? '',
            taskId:         id,
            dueDate:        updated.dueDate.toLocaleDateString('en-US', { dateStyle: 'medium' }),
            assignedByName: assigner?.name ?? 'A team member',
          })
          .catch(() => {});
      }
    }

    this.eventsGateway.emitToProject(updated.projectId, 'task:updated', updated);
    return updated;
  }

  async updateStatus(
    id: string,
    dto: UpdateTaskStatusDto,
    userId: string,
    userRole: string,
  ) {
    const task = await this.prisma.task.findUnique({ where: { id } });
    if (!task) throw new NotFoundException('Task not found');

    if (
      userRole === UserRole.team_member &&
      task.assigneeId !== userId &&
      task.createdBy !== userId
    ) {
      throw new ForbiddenException('Access denied');
    }

    const updated = await this.prisma.task.update({
      where: { id },
      data: { status: dto.status },
      include: TASK_INCLUDE,
    });

    await this.activityLogs.log({
      userId,
      action: ActivityAction.TASK_STATUS_CHANGED,
      entityType: 'task',
      entityId: id,
      metadata: { from: task.status, to: dto.status },
    });

    this.eventsGateway.emitToProject(updated.projectId, 'task:status-changed', updated);
    return updated;
  }

  async remove(id: string, userId: string, userRole: string) {
    const task = await this.prisma.task.findUnique({ where: { id } });
    if (!task) throw new NotFoundException('Task not found');

    if (userRole === UserRole.team_member) {
      throw new ForbiddenException('Only admins and project managers can delete tasks');
    }

    await this.prisma.task.delete({ where: { id } });

    await this.activityLogs.log({
      userId,
      action: ActivityAction.TASK_DELETED,
      entityType: 'task',
      entityId: id,
    });

    this.eventsGateway.emitToProject(task.projectId, 'task:deleted', { id });
    return { message: 'Task deleted successfully' };
  }
}
