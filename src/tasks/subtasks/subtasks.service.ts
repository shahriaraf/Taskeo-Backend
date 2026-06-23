// src/tasks/subtasks/subtasks.service.ts
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ActivityLogsService } from '../../activity-logs/activity-logs.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { MailService } from '../../mail/mail.service';
import { EventsGateway } from '../../events/events.gateway';
import { CreateSubTaskDto } from '../dto/create-subtask.dto';
import { UpdateTaskDto } from '../dto/update-task.dto';
import {
  ActivityAction,
  NotificationType,
  TaskStatus,
  UserRole,
} from '@prisma/client';

// Shared include shape — keeps all queries consistent
const TASK_INCLUDE = {
  assignee: { select: { id: true, name: true, email: true, avatarUrl: true } },
  creator:  { select: { id: true, name: true } },
  project:  { select: { id: true, name: true } },
  subTasks: {
    orderBy: { order: 'asc' as const },
    include: {
      assignee: { select: { id: true, name: true, avatarUrl: true } },
      _count: { select: { comments: true, attachments: true } },
    },
  },
  _count: { select: { comments: true, attachments: true, subTasks: true } },
};

@Injectable()
export class SubTasksService {
  constructor(
    private prisma: PrismaService,
    private activityLogs: ActivityLogsService,
    private notifications: NotificationsService,
    private mailService: MailService,
    private eventsGateway: EventsGateway,
  ) {}

  /**
   * Create a sub-task under an existing parent task.
   * The sub-task inherits the parent's projectId automatically.
   */
  async create(parentTaskId: string, dto: CreateSubTaskDto, userId: string) {
    const parent = await this.prisma.task.findUnique({
      where: { id: parentTaskId },
      include: { project: { include: { members: true } } },
    });

    if (!parent) throw new NotFoundException('Parent task not found');

    if (parent.status === TaskStatus.completed) {
      throw new BadRequestException(
        'Cannot add sub-tasks to a completed task. Reopen the task first.',
      );
    }

    // Count existing sub-tasks to set order
    const siblingCount = await this.prisma.task.count({
      where: { parentId: parentTaskId },
    });

    const subTask = await this.prisma.task.create({
      data: {
        title:      dto.title,
        description: dto.description,
        projectId:  parent.projectId,
        parentId:   parentTaskId,
        assigneeId: dto.assigneeId,
        dueDate:    new Date(dto.dueDate),
        priority:   dto.priority ?? parent.priority,
        status:     TaskStatus.todo,
        createdBy:  userId,
        order:      siblingCount,
      },
      include: TASK_INCLUDE,
    });

    // Log activity
    await this.activityLogs.log({
      userId,
      action: ActivityAction.SUBTASK_CREATED,
      entityType: 'task',
      entityId: subTask.id,
      metadata: {
        subTaskTitle: subTask.title,
        parentTaskTitle: parent.title,
        projectName: parent.project.name,
      },
    });

    // Notify assignee (if different from creator)
    if (dto.assigneeId && dto.assigneeId !== userId) {
      await this.notifications.create({
        userId: dto.assigneeId,
        title: 'Sub-task Assigned to You',
        message: `You were assigned a sub-task "${subTask.title}" under "${parent.title}"`,
        type: NotificationType.task_assigned,
        entityType: 'task',
        entityId: subTask.id,
      });

      // Send email notification
      const assignee = await this.prisma.user.findUnique({
        where: { id: dto.assigneeId },
        select: { name: true, email: true },
      });
      if (assignee) {
        const creator = await this.prisma.user.findUnique({
          where: { id: userId },
          select: { name: true },
        });
        this.mailService
          .sendTaskAssigned({
            to:             assignee.email,
            assigneeName:   assignee.name,
            taskTitle:      subTask.title,
            projectName:    parent.project.name,
            taskId:         subTask.id,
            dueDate:        new Date(dto.dueDate).toLocaleDateString('en-US', { dateStyle: 'medium' }),
            assignedByName: creator?.name ?? 'A team member',
          })
          .catch(() => {/* logged inside MailService */});
      }
    }

    // Emit real-time update so Kanban boards refresh
    this.eventsGateway.emitToProject(parent.projectId, 'subtask:created', subTask);

    return subTask;
  }

  /**
   * Get all sub-tasks for a given parent task.
   */
  async findByParent(parentTaskId: string, userId: string, userRole: string) {
    const parent = await this.prisma.task.findUnique({
      where: { id: parentTaskId },
      include: { project: { include: { members: true } } },
    });

    if (!parent) throw new NotFoundException('Parent task not found');

    // Team members can only see their own tasks / tasks in projects they belong to
    if (userRole === UserRole.team_member) {
      const isMember = parent.project.members.some((m) => m.userId === userId);
      if (!isMember) throw new ForbiddenException('Not a member of this project');
    }

    const subTasks = await this.prisma.task.findMany({
      where: { parentId: parentTaskId },
      orderBy: { order: 'asc' },
      include: {
        assignee: { select: { id: true, name: true, email: true, avatarUrl: true } },
        _count: { select: { comments: true, attachments: true } },
      },
    });

    return subTasks;
  }

  /**
   * Update a sub-task (delegates to the same shape as regular task update).
   */
  async update(subTaskId: string, dto: UpdateTaskDto, userId: string, userRole: string) {
    const subTask = await this.prisma.task.findUnique({
      where: { id: subTaskId },
    });

    if (!subTask || !subTask.parentId) {
      throw new NotFoundException('Sub-task not found');
    }

    if (
      userRole === UserRole.team_member &&
      subTask.assigneeId !== userId &&
      subTask.createdBy !== userId
    ) {
      throw new ForbiddenException('You can only edit sub-tasks assigned to you');
    }

    const updated = await this.prisma.task.update({
      where: { id: subTaskId },
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
      entityId: subTaskId,
      metadata: { changes: dto },
    });

    this.eventsGateway.emitToProject(updated.projectId, 'subtask:updated', updated);

    return updated;
  }

  /**
   * Delete a sub-task.
   */
  async remove(subTaskId: string, userId: string, userRole: string) {
    const subTask = await this.prisma.task.findUnique({
      where: { id: subTaskId },
    });

    if (!subTask || !subTask.parentId) {
      throw new NotFoundException('Sub-task not found');
    }

    if (userRole === UserRole.team_member) {
      throw new ForbiddenException('Only admins and project managers can delete sub-tasks');
    }

    await this.prisma.task.delete({ where: { id: subTaskId } });

    await this.activityLogs.log({
      userId,
      action: ActivityAction.TASK_DELETED,
      entityType: 'task',
      entityId: subTaskId,
    });

    this.eventsGateway.emitToProject(subTask.projectId, 'subtask:deleted', { id: subTaskId });

    return { message: 'Sub-task deleted successfully' };
  }

  /**
   * Reorder sub-tasks by updating their `order` field.
   * Accepts an array of sub-task IDs in the new desired order.
   */
  async reorder(parentTaskId: string, orderedIds: string[]) {
    const updates = orderedIds.map((id, index) =>
      this.prisma.task.update({
        where: { id },
        data: { order: index },
      }),
    );
    await this.prisma.$transaction(updates);
    return { message: 'Sub-tasks reordered' };
  }
}
