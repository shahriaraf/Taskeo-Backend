import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityLogsService } from '../activity-logs/activity-logs.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';
import { ActivityAction, NotificationType, UserRole } from '@prisma/client';

@Injectable()
export class CommentsService {
  constructor(
    private prisma: PrismaService,
    private activityLogs: ActivityLogsService,
    private notifications: NotificationsService,
  ) {}

  async create(dto: CreateCommentDto, userId: string) {
    const task = await this.prisma.task.findUnique({
      where: { id: dto.taskId },
      include: { project: true },
    });

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    const comment = await this.prisma.comment.create({
      data: {
        taskId: dto.taskId,
        userId,
        content: dto.content,
      },
      include: {
        user: {
          select: { id: true, name: true, avatarUrl: true },
        },
      },
    });

    await this.activityLogs.log({
      userId,
      action: ActivityAction.COMMENT_ADDED,
      entityType: 'comment',
      entityId: comment.id,
      metadata: { taskTitle: task.title, projectName: task.project.name },
    });

    // Notify task assignee if different from commenter
    if (task.assigneeId && task.assigneeId !== userId) {
      await this.notifications.create({
        userId: task.assigneeId,
        title: 'New Comment on Your Task',
        message: `A new comment was added to task "${task.title}"`,
        type: NotificationType.comment_added,
        entityType: 'task',
        entityId: task.id,
      });
    }

    return comment;
  }

  async findByTask(taskId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const task = await this.prisma.task.findUnique({ where: { id: taskId } });
    if (!task) throw new NotFoundException('Task not found');

    const [comments, total] = await Promise.all([
      this.prisma.comment.findMany({
        where: { taskId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          user: {
            select: { id: true, name: true, avatarUrl: true },
          },
        },
      }),
      this.prisma.comment.count({ where: { taskId } }),
    ]);

    return { comments, total, page, limit };
  }

  async update(id: string, dto: UpdateCommentDto, userId: string, userRole: string) {
    const comment = await this.prisma.comment.findUnique({ where: { id } });

    if (!comment) throw new NotFoundException('Comment not found');

    // Only owner or admin can edit
    if (comment.userId !== userId && userRole !== UserRole.admin) {
      throw new ForbiddenException('You can only edit your own comments');
    }

    return this.prisma.comment.update({
      where: { id },
      data: { content: dto.content },
      include: {
        user: { select: { id: true, name: true, avatarUrl: true } },
      },
    });
  }

  async remove(id: string, userId: string, userRole: string) {
    const comment = await this.prisma.comment.findUnique({ where: { id } });

    if (!comment) throw new NotFoundException('Comment not found');

    if (comment.userId !== userId && userRole !== UserRole.admin) {
      throw new ForbiddenException('You can only delete your own comments');
    }

    await this.prisma.comment.delete({ where: { id } });

    await this.activityLogs.log({
      userId,
      action: ActivityAction.COMMENT_DELETED,
      entityType: 'comment',
      entityId: id,
    });

    return { message: 'Comment deleted successfully' };
  }
}
