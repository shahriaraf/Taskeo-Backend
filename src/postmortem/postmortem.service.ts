import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface PostMortemReport {
  project: {
    id: string;
    name: string;
    description?: string;
    status: string;
    deadline: string;
    completedAt?: string;
    createdAt: string;
    owner: { id: string; name: string; avatarUrl?: string };
  };
  summary: {
    totalTasks: number;
    completedTasks: number;
    incompleteTasks: number;
    completionRate: number;
    totalMembers: number;
    plannedDeadline: string;
    wasOnTime: boolean;
    daysOverdue: number;
  };
  taskBreakdown: {
    byPriority: { high: number; medium: number; low: number };
    byStatus: { completed: number; in_progress: number; todo: number };
    overdueTasks: {
      id: string;
      title: string;
      assignee?: string;
      dueDate: string;
      daysOverdue: number;
    }[];
    unassignedTasks: { id: string; title: string; status: string }[];
  };
  memberContributions: {
    userId: string;
    name: string;
    avatarUrl?: string;
    assigned: number;
    completed: number;
    completionRate: number;
    tasksOverdue: number;
  }[];
  timeline: {
    action: string;
    actor: string;
    entityType: string;
    timestamp: string;
    note: string;
  }[];
  insights: string[];
  recommendations: string[];
  generatedAt: string;
}

@Injectable()
export class PostMortemService {
  constructor(private prisma: PrismaService) {}

  async generate(projectId: string): Promise<PostMortemReport> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        owner: { select: { id: true, name: true, avatarUrl: true } },
        members: {
          include: {
            user: { select: { id: true, name: true, avatarUrl: true } },
          },
        },
        tasks: {
          include: {
            assignee: { select: { id: true, name: true } },
            creator: { select: { id: true, name: true } },
          },
        },
      },
    });

    if (!project) throw new NotFoundException('Project not found');

    const now = new Date();
    const deadline = new Date(project.deadline);

    // ── Summary ──────────────────────────────────────────────────────────────
    const totalTasks = project.tasks.length;
    const completedTasks = project.tasks.filter((t) => t.status === 'completed').length;
    const incompleteTasks = totalTasks - completedTasks;
    const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
    const wasOnTime = project.status === 'completed' && now <= deadline;
    const daysOverdue = !wasOnTime ? Math.max(0, Math.floor((now.getTime() - deadline.getTime()) / (1000 * 60 * 60 * 24))) : 0;

    // ── Task breakdown ────────────────────────────────────────────────────────
    const byPriority = { high: 0, medium: 0, low: 0 };
    const byStatus = { completed: 0, in_progress: 0, todo: 0 };

    for (const task of project.tasks) {
      byPriority[task.priority]++;
      byStatus[task.status]++;
    }

    const overdueTasks = project.tasks
      .filter((t) => t.status !== 'completed' && new Date(t.dueDate) < now)
      .map((t) => ({
        id: t.id,
        title: t.title,
        assignee: t.assignee?.name,
        dueDate: t.dueDate.toISOString(),
        daysOverdue: Math.floor((now.getTime() - new Date(t.dueDate).getTime()) / (1000 * 60 * 60 * 24)),
      }))
      .sort((a, b) => b.daysOverdue - a.daysOverdue);

    const unassignedTasks = project.tasks
      .filter((t) => !t.assigneeId && t.status !== 'completed')
      .map((t) => ({ id: t.id, title: t.title, status: t.status }));

    // ── Member contributions ──────────────────────────────────────────────────
    const memberContributions = project.members.map((m) => {
      const memberTasks = project.tasks.filter((t) => t.assigneeId === m.userId);
      const completed = memberTasks.filter((t) => t.status === 'completed').length;
      const tasksOverdue = memberTasks.filter(
        (t) => t.status !== 'completed' && new Date(t.dueDate) < now,
      ).length;
      return {
        userId: m.userId,
        name: m.user.name,
        avatarUrl: m.user.avatarUrl ?? undefined,
        assigned: memberTasks.length,
        completed,
        completionRate: memberTasks.length > 0 ? Math.round((completed / memberTasks.length) * 100) : 0,
        tasksOverdue,
      };
    });

    // ── Timeline (key activity log events) ───────────────────────────────────
    const logs = await this.prisma.activityLog.findMany({
      where: { entityId: projectId, entityType: 'project' },
      include: { user: { select: { name: true } } },
      orderBy: { createdAt: 'asc' },
      take: 30,
    });

    // Also grab task-level key events
    const taskLogs = await this.prisma.activityLog.findMany({
      where: {
        entityType: 'task',
        entityId: { in: project.tasks.map((t) => t.id) },
        action: { in: ['TASK_STATUS_CHANGED', 'TASK_ASSIGNED', 'TASK_CREATED'] },
      },
      include: { user: { select: { name: true } } },
      orderBy: { createdAt: 'asc' },
      take: 50,
    });

    const allLogs = [...logs, ...taskLogs]
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
      .slice(0, 40);

    const timeline = allLogs.map((log) => ({
      action: log.action,
      actor: log.user?.name ?? 'System',
      entityType: log.entityType ?? '',
      timestamp: log.createdAt.toISOString(),
      note: this.humanizeAction(log.action, log.metadata as Record<string, any>),
    }));

    // ── Insights (auto-generated, blame-free) ─────────────────────────────────
    const insights: string[] = [];

    if (completionRate === 100) {
      insights.push('All tasks were completed successfully.');
    } else {
      insights.push(`${completionRate}% of tasks were completed (${completedTasks} of ${totalTasks}).`);
    }

    if (overdueTasks.length > 0) {
      insights.push(`${overdueTasks.length} task${overdueTasks.length > 1 ? 's' : ''} missed their deadline — most commonly by ${Math.round(overdueTasks.reduce((s, t) => s + t.daysOverdue, 0) / overdueTasks.length)} days on average.`);
    }

    if (unassignedTasks.length > 0) {
      insights.push(`${unassignedTasks.length} task${unassignedTasks.length > 1 ? 's were' : ' was'} never assigned to anyone and could not be completed.`);
    }

    const overloadedMembers = memberContributions.filter(
      (m) => m.assigned > 0 && m.tasksOverdue / m.assigned > 0.4,
    );
    if (overloadedMembers.length > 0) {
      insights.push(`${overloadedMembers.map((m) => m.name).join(', ')} had more than 40% of their tasks overdue — this may indicate overloading or unclear requirements.`);
    }

    if (byPriority.high > totalTasks * 0.5) {
      insights.push(`More than half of all tasks were marked high priority, which may reduce focus. Consider using priority labels more selectively next time.`);
    }

    if (daysOverdue > 0) {
      insights.push(`The project ran ${daysOverdue} day${daysOverdue > 1 ? 's' : ''} past its planned deadline.`);
    }

    // ── Recommendations ───────────────────────────────────────────────────────
    const recommendations: string[] = [];

    if (unassignedTasks.length > 0) {
      recommendations.push('Ensure every task has an assignee before the project starts. Unassigned tasks rarely get done.');
    }
    if (overloadedMembers.length > 0) {
      recommendations.push('Balance workload more evenly across team members. Review task distribution during project kickoff.');
    }
    if (byPriority.high > totalTasks * 0.5) {
      recommendations.push('Apply the "high priority" label only to truly critical tasks. Aim for no more than 20-30% of tasks being high priority.');
    }
    if (daysOverdue > 7) {
      recommendations.push('Add a mid-project review checkpoint to catch deadline risks early and re-plan if needed.');
    }
    if (completionRate < 70) {
      recommendations.push('Break large tasks into smaller, more achievable subtasks to improve completion rates.');
    }
    if (recommendations.length === 0) {
      recommendations.push('Great execution! Document what worked well and use this project as a template for future ones.');
    }

    return {
      project: {
        id: project.id,
        name: project.name,
        description: project.description ?? undefined,
        status: project.status,
        deadline: project.deadline.toISOString(),
        createdAt: project.createdAt.toISOString(),
        owner: {
          id: project.owner.id,
          name: project.owner.name,
          avatarUrl: project.owner.avatarUrl ?? undefined,
        },
      },
      summary: {
        totalTasks,
        completedTasks,
        incompleteTasks,
        completionRate,
        totalMembers: project.members.length,
        plannedDeadline: project.deadline.toISOString(),
        wasOnTime,
        daysOverdue,
      },
      taskBreakdown: { byPriority, byStatus, overdueTasks, unassignedTasks },
      memberContributions,
      timeline,
      insights,
      recommendations,
      generatedAt: now.toISOString(),
    };
  }

  private humanizeAction(action: string, metadata?: Record<string, any>): string {
    const map: Record<string, string> = {
      PROJECT_CREATED: 'Project was created',
      PROJECT_UPDATED: 'Project details were updated',
      TASK_CREATED: 'A new task was added',
      TASK_ASSIGNED: 'A task was assigned to a team member',
      TASK_STATUS_CHANGED: metadata?.newStatus
        ? `Task status changed to ${metadata.newStatus}`
        : 'Task status was changed',
      MEMBER_ADDED: 'A new member joined the project',
      MEMBER_REMOVED: 'A member was removed from the project',
      FILE_UPLOADED: 'A file was uploaded',
      COMMENT_ADDED: 'A comment was added',
    };
    return map[action] ?? action.replace(/_/g, ' ').toLowerCase();
  }
}
