import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TaskStatus, TaskPriority } from '@prisma/client';

@Injectable()
export class AnalyticsService {
  constructor(private prisma: PrismaService) {}

  async getDashboard(userId: string, userRole: string) {
    const [kpis, projectSummaries, memberWorkload] = await Promise.all([
      this.getKPIs(userId, userRole),
      this.getProjectSummaries(userId, userRole),
      this.getMemberWorkload(userId, userRole),
    ]);

    return { kpis, projectSummaries, memberWorkload };
  }

  async getKPIs(userId: string, userRole: string) {
    const now = new Date();

    const projectWhere =
      userRole !== 'admin'
        ? { members: { some: { userId } } }
        : {};

    const taskWhere =
      userRole === 'team_member'
        ? { assigneeId: userId }
        : userRole !== 'admin'
        ? { project: { members: { some: { userId } } } }
        : {};

    const [
      totalProjects,
      totalTasks,
      completedTasks,
      overdueTasks,
    ] = await Promise.all([
      this.prisma.project.count({ where: projectWhere }),
      this.prisma.task.count({ where: taskWhere }),
      this.prisma.task.count({
        where: { ...taskWhere, status: TaskStatus.completed },
      }),
      this.prisma.task.count({
        where: {
          ...taskWhere,
          dueDate: { lt: now },
          status: { not: TaskStatus.completed },
        },
      }),
    ]);

    return {
      totalProjects,
      totalTasks,
      completedTasks,
      pendingTasks: totalTasks - completedTasks,
      overdueTasks,
    };
  }

  async getProjectSummaries(userId: string, userRole: string) {
    const where =
      userRole !== 'admin'
        ? { members: { some: { userId } } }
        : {};

    const projects = await this.prisma.project.findMany({
      where,
      include: {
        tasks: { select: { status: true, dueDate: true } },
      },
      orderBy: { deadline: 'asc' },
      take: 10,
    });

    const now = new Date();

    return projects.map((p) => {
      const total = p.tasks.length;
      const completed = p.tasks.filter(
        (t) => t.status === TaskStatus.completed,
      ).length;
      const pending = total - completed;
      const daysUntilDeadline = Math.ceil(
        (new Date(p.deadline).getTime() - now.getTime()) /
          (1000 * 60 * 60 * 24),
      );

      return {
        id: p.id,
        name: p.name,
        status: p.status,
        deadline: p.deadline,
        daysUntilDeadline,
        totalTasks: total,
        completedTasks: completed,
        pendingTasks: pending,
        completionPercent: total > 0 ? Math.round((completed / total) * 100) : 0,
        isOverdue: new Date(p.deadline) < now && p.status !== 'completed',
      };
    });
  }

  async getTasksByPriority(userId: string, userRole: string) {
    const taskWhere =
      userRole === 'team_member'
        ? { assigneeId: userId }
        : userRole !== 'admin'
        ? { project: { members: { some: { userId } } } }
        : {};

    const results = await this.prisma.task.groupBy({
      by: ['priority'],
      where: taskWhere,
      _count: { priority: true },
    });

    const priorityMap = {
      [TaskPriority.high]: 0,
      [TaskPriority.medium]: 0,
      [TaskPriority.low]: 0,
    };

    results.forEach((r) => {
      priorityMap[r.priority] = r._count.priority;
    });

    return Object.entries(priorityMap).map(([priority, count]) => ({
      priority,
      count,
    }));
  }

  async getTaskStatusDistribution(userId: string, userRole: string) {
    const taskWhere =
      userRole === 'team_member'
        ? { assigneeId: userId }
        : userRole !== 'admin'
        ? { project: { members: { some: { userId } } } }
        : {};

    const results = await this.prisma.task.groupBy({
      by: ['status'],
      where: taskWhere,
      _count: { status: true },
    });

    return results.map((r) => ({
      status: r.status,
      count: r._count.status,
    }));
  }

  async getMemberWorkload(userId: string, userRole: string) {
    const projectWhere =
      userRole !== 'admin'
        ? { members: { some: { userId } } }
        : {};

    const members = await this.prisma.user.findMany({
      where: {
        projectMembers: {
          some: { project: projectWhere },
        },
      },
      select: {
        id: true,
        name: true,
        avatarUrl: true,
        assignedTasks: {
          where: { project: projectWhere },
          select: { status: true },
        },
      },
    });

    return members.map((m) => ({
      user: { id: m.id, name: m.name, avatarUrl: m.avatarUrl },
      totalTasks: m.assignedTasks.length,
      completedTasks: m.assignedTasks.filter(
        (t) => t.status === TaskStatus.completed,
      ).length,
      pendingTasks: m.assignedTasks.filter(
        (t) => t.status !== TaskStatus.completed,
      ).length,
    }));
  }

  async getUpcomingDeadlines(userId: string, userRole: string) {
    const now = new Date();
    const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const taskWhere =
      userRole === 'team_member'
        ? { assigneeId: userId }
        : userRole !== 'admin'
        ? { project: { members: { some: { userId } } } }
        : {};

    return this.prisma.task.findMany({
      where: {
        ...taskWhere,
        dueDate: { gte: now, lte: nextWeek },
        status: { not: TaskStatus.completed },
      },
      include: {
        project: { select: { id: true, name: true } },
        assignee: { select: { id: true, name: true, avatarUrl: true } },
      },
      orderBy: { dueDate: 'asc' },
      take: 10,
    });
  }

  async getHighPriorityTasks(userId: string, userRole: string) {
    const taskWhere =
      userRole === 'team_member'
        ? { assigneeId: userId }
        : userRole !== 'admin'
        ? { project: { members: { some: { userId } } } }
        : {};

    return this.prisma.task.findMany({
      where: {
        ...taskWhere,
        priority: TaskPriority.high,
        status: { not: TaskStatus.completed },
      },
      include: {
        project: { select: { id: true, name: true } },
        assignee: { select: { id: true, name: true, avatarUrl: true } },
      },
      orderBy: { dueDate: 'asc' },
      take: 5,
    });
  }

  async getProgressTrend(userId: string, userRole: string) {
  const taskWhere =
    userRole === 'team_member'
      ? { assigneeId: userId }
      : userRole !== 'admin'
      ? { project: { members: { some: { userId } } } }
      : {};

  const sixWeeksAgo = new Date();
  sixWeeksAgo.setDate(sixWeeksAgo.getDate() - 42);

  const [createdTasks, completedTasks] = await Promise.all([
    this.prisma.task.findMany({
      where: {
        ...taskWhere,
        createdAt: { gte: sixWeeksAgo },
      },
      select: { createdAt: true },
    }),
    this.prisma.task.findMany({
      where: {
        ...taskWhere,
        status: TaskStatus.completed,
        updatedAt: { gte: sixWeeksAgo },
      },
      select: { updatedAt: true },
    }),
  ]);

  // Build 6 week buckets from oldest → newest
  const weeks = Array.from({ length: 6 }, (_, i) => {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - (5 - i) * 7 - 6);
    startDate.setHours(0, 0, 0, 0);

    const endDate = new Date();
    endDate.setDate(endDate.getDate() - (5 - i) * 7);
    endDate.setHours(23, 59, 59, 999);

    return { week: `W${i + 1}`, created: 0, completed: 0, startDate, endDate };
  });

  createdTasks.forEach((task) => {
    const d = new Date(task.createdAt);
    const bucket = weeks.find((w) => d >= w.startDate && d <= w.endDate);
    if (bucket) bucket.created++;
  });

  completedTasks.forEach((task) => {
    const d = new Date(task.updatedAt);
    const bucket = weeks.find((w) => d >= w.startDate && d <= w.endDate);
    if (bucket) bucket.completed++;
  });

  return weeks.map(({ week, created, completed }) => ({
    week,
    created,
    completed,
  }));
}
}