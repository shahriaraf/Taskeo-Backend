import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '@prisma/client';

export interface BurnoutSignal {
  userId: string;
  userName: string;
  avatarUrl?: string;
  riskScore: number; // 0–100
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  signals: {
    overdueTaskCount: number;
    deadlinePushCount: number;  // tasks updated repeatedly without completion
    lateNightActivityDays: number; // days with activity after 22:00
    taskAccumulationRate: number; // new tasks added faster than completed (last 14d)
    consecutiveOverdueDays: number;
  };
  recommendation: string;
}

@Injectable()
export class BurnoutService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  // ── Main: analyse all active members ──────────────────────────────────────
  async analyseTeam(requestingUserId: string, userRole: string): Promise<BurnoutSignal[]> {
    // Only admin and project_manager can see team burnout data
    const projectWhere =
      userRole === 'admin'
        ? {}
        : { members: { some: { userId: requestingUserId } } };

    const members = await this.prisma.user.findMany({
      where: {
        isActive: true,
        projectMembers: { some: { project: projectWhere } },
      },
      select: {
        id: true,
        name: true,
        avatarUrl: true,
      },
    });

    const signals = await Promise.all(
      members.map((m) => this.analyseUser(m.id, m.name, m.avatarUrl ?? undefined)),
    );

    // Sort by risk score descending
    return signals.sort((a, b) => b.riskScore - a.riskScore);
  }

  // ── Analyse a single user ──────────────────────────────────────────────────
  async analyseUser(userId: string, userName: string, avatarUrl?: string): Promise<BurnoutSignal> {
    const now = new Date();
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    // 1. Overdue tasks
    const overdueTaskCount = await this.prisma.task.count({
      where: {
        assigneeId: userId,
        status: { not: 'completed' },
        dueDate: { lt: now },
      },
    });

    // 2. Tasks updated many times without status change (deadline pushed)
    // We approximate using activity logs — TASK_UPDATED actions in last 14d
    const taskUpdateLogs = await this.prisma.activityLog.findMany({
      where: {
        userId,
        action: 'TASK_UPDATED',
        createdAt: { gte: fourteenDaysAgo },
      },
      select: { entityId: true },
    });

    // Count tasks updated more than twice (likely deadline pushed)
    const updatesByTask = taskUpdateLogs.reduce<Record<string, number>>((acc, log) => {
      if (log.entityId) acc[log.entityId] = (acc[log.entityId] ?? 0) + 1;
      return acc;
    }, {});
    const deadlinePushCount = Object.values(updatesByTask).filter((c) => c >= 2).length;

    // 3. Late night activity (after 22:00 local — we check UTC hour >= 17 as proxy, adjustable)
    const recentLogs = await this.prisma.activityLog.findMany({
      where: {
        userId,
        createdAt: { gte: fourteenDaysAgo },
      },
      select: { createdAt: true },
    });

    const lateNightDays = new Set<string>();
    for (const log of recentLogs) {
      const hour = log.createdAt.getUTCHours();
      // 21:00–04:00 UTC as "late night" — teams can configure this
      if (hour >= 21 || hour <= 4) {
        lateNightDays.add(log.createdAt.toISOString().slice(0, 10));
      }
    }
    const lateNightActivityDays = lateNightDays.size;

    // 4. Task accumulation: tasks created vs completed in last 14d
    const [tasksCreated, tasksCompleted] = await Promise.all([
      this.prisma.task.count({
        where: {
          assigneeId: userId,
          createdAt: { gte: fourteenDaysAgo },
        },
      }),
      this.prisma.task.count({
        where: {
          assigneeId: userId,
          status: 'completed',
          updatedAt: { gte: fourteenDaysAgo },
        },
      }),
    ]);
    const taskAccumulationRate = Math.max(0, tasksCreated - tasksCompleted);

    // 5. Consecutive days with overdue tasks (rough: days since oldest overdue task)
    const oldestOverdue = await this.prisma.task.findFirst({
      where: {
        assigneeId: userId,
        status: { not: 'completed' },
        dueDate: { lt: now },
      },
      orderBy: { dueDate: 'asc' },
      select: { dueDate: true },
    });
    const consecutiveOverdueDays = oldestOverdue
      ? Math.floor((now.getTime() - oldestOverdue.dueDate.getTime()) / (1000 * 60 * 60 * 24))
      : 0;

    // ── Score calculation ──────────────────────────────────────────────────
    let score = 0;
    score += Math.min(overdueTaskCount * 8, 30);       // max 30 pts
    score += Math.min(deadlinePushCount * 6, 20);      // max 20 pts
    score += Math.min(lateNightActivityDays * 4, 20);  // max 20 pts
    score += Math.min(taskAccumulationRate * 5, 20);   // max 20 pts
    score += Math.min(consecutiveOverdueDays * 2, 10); // max 10 pts

    const riskLevel =
      score >= 70 ? 'critical' :
      score >= 45 ? 'high' :
      score >= 20 ? 'medium' : 'low';

    const recommendation = this.getRecommendation(riskLevel, {
      overdueTaskCount,
      deadlinePushCount,
      lateNightActivityDays,
      taskAccumulationRate,
      consecutiveOverdueDays,
    });

    return {
      userId,
      userName,
      avatarUrl,
      riskScore: Math.min(score, 100),
      riskLevel,
      signals: {
        overdueTaskCount,
        deadlinePushCount,
        lateNightActivityDays,
        taskAccumulationRate,
        consecutiveOverdueDays,
      },
      recommendation,
    };
  }

  // ── Send notifications to PMs about critical members ──────────────────────
  async alertManagers(projectId: string): Promise<void> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        members: {
          include: { user: { select: { id: true, name: true, role: true } } },
        },
      },
    });
    if (!project) return;

    const managers = project.members.filter(
      (m) => m.user.role === 'admin' || m.user.role === 'project_manager',
    );
    const teamMembers = project.members.filter(
      (m) => m.user.role === 'team_member',
    );

    for (const member of teamMembers) {
      const signal = await this.analyseUser(member.user.id, member.user.name);
      if (signal.riskLevel === 'critical' || signal.riskLevel === 'high') {
        for (const mgr of managers) {
          await this.notifications.create({
            userId: mgr.user.id,
            title: `Burnout risk: ${member.user.name}`,
            message: `${member.user.name} shows a ${signal.riskLevel} burnout risk (score ${signal.riskScore}/100). ${signal.recommendation}`,
            type: NotificationType.task_updated,
            entityType: 'user',
            entityId: member.user.id,
          });
        }
      }
    }
  }

  // ── Private: generate recommendation text ─────────────────────────────────
  private getRecommendation(
    level: string,
    signals: BurnoutSignal['signals'],
  ): string {
    if (level === 'critical') {
      return `Immediate attention needed. Consider redistributing ${signals.overdueTaskCount} overdue tasks and having a 1:1 conversation.`;
    }
    if (level === 'high') {
      if (signals.lateNightActivityDays >= 3) {
        return `Working late ${signals.lateNightActivityDays} nights recently. Review workload and set working hours expectations.`;
      }
      if (signals.overdueTaskCount >= 5) {
        return `${signals.overdueTaskCount} overdue tasks. Help prioritise and remove blockers.`;
      }
      return `High risk signals detected. Check in and review current task load.`;
    }
    if (level === 'medium') {
      return `Moderate risk. Monitor over next few days and ensure no new high-priority tasks are added.`;
    }
    return `Workload looks healthy. Keep checking in regularly.`;
  }
}
