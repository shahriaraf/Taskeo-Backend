import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityLogsService } from '../activity-logs/activity-logs.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AddMemberDto } from './dto/create-team.dto';
import { UpdateMemberRoleDto } from './dto/update-team.dto';
import { ActivityAction, NotificationType, UserRole } from '@prisma/client';

@Injectable()
export class TeamService {
  constructor(
    private prisma: PrismaService,
    private activityLogs: ActivityLogsService,
    private notifications: NotificationsService,
  ) {}

  async addMember(dto: AddMemberDto, requesterId: string, requesterRole: string) {
    // Check project exists
    const project = await this.prisma.project.findUnique({
      where: { id: dto.projectId },
      include: { members: true },
    });

    if (!project) throw new NotFoundException('Project not found');

    // Only admin or project owner/manager can add members
    if (requesterRole !== UserRole.admin) {
      const requesterMember = project.members.find((m) => m.userId === requesterId);
      if (!requesterMember || requesterMember.role === 'member') {
        throw new ForbiddenException('Only project owners/managers can add members');
      }
    }

    // Check user exists
    const user = await this.prisma.user.findUnique({
      where: { id: dto.userId },
      select: { id: true, name: true, email: true },
    });

    if (!user) throw new NotFoundException('User not found');

    // Check if already a member
    const alreadyMember = project.members.find((m) => m.userId === dto.userId);
    if (alreadyMember) throw new ConflictException('User is already a project member');

    const member = await this.prisma.projectMember.create({
      data: {
        projectId: dto.projectId,
        userId: dto.userId,
        role: dto.role || 'member',
      },
      include: {
        user: { select: { id: true, name: true, email: true, avatarUrl: true, role: true } },
        project: { select: { id: true, name: true } },
      },
    });

    await this.activityLogs.log({
      userId: requesterId,
      action: ActivityAction.MEMBER_ADDED,
      entityType: 'project',
      entityId: dto.projectId,
      metadata: { userName: user.name, projectName: project.name },
    });

    await this.notifications.create({
      userId: dto.userId,
      title: 'Added to Project',
      message: `You have been added to project "${project.name}"`,
      type: NotificationType.member_added,
      entityType: 'project',
      entityId: dto.projectId,
    });

    return member;
  }

  async getProjectMembers(projectId: string) {
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new NotFoundException('Project not found');

    const members = await this.prisma.projectMember.findMany({
      where: { projectId },
      include: {
        user: { select: { id: true, name: true, email: true, avatarUrl: true, role: true } },
      },
      orderBy: { joinedAt: 'asc' },
    });

    // Workload summary per member
    const memberIds = members.map((m) => m.userId);
    const tasks = await this.prisma.task.findMany({
      where: { projectId, assigneeId: { in: memberIds } },
      select: { assigneeId: true, status: true },
    });

    return members.map((m) => {
      const memberTasks = tasks.filter((t) => t.assigneeId === m.userId);
      return {
        ...m,
        workload: {
          total: memberTasks.length,
          completed: memberTasks.filter((t) => t.status === 'completed').length,
          pending: memberTasks.filter((t) => t.status !== 'completed').length,
        },
      };
    });
  }

  async getMemberWorkload(projectId: string) {
    const members = await this.getProjectMembers(projectId);
    return members.map((m) => ({
      userId: m.userId,
      user: m.user,
      role: m.role,
      workload: m.workload,
    }));
  }

  async updateMemberRole(
    projectId: string,
    userId: string,
    dto: UpdateMemberRoleDto,
    requesterId: string,
    requesterRole: string,
  ) {
    const member = await this.prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId } },
    });

    if (!member) throw new NotFoundException('Member not found in this project');

    // Cannot change owner role unless you are admin
    if (member.role === 'owner' && requesterRole !== UserRole.admin) {
      throw new ForbiddenException('Cannot change project owner role');
    }

    return this.prisma.projectMember.update({
      where: { projectId_userId: { projectId, userId } },
      data: { role: dto.role },
      include: {
        user: { select: { id: true, name: true, email: true, avatarUrl: true } },
      },
    });
  }

  async removeMember(
    projectId: string,
    userId: string,
    requesterId: string,
    requesterRole: string,
  ) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: { members: true },
    });

    if (!project) throw new NotFoundException('Project not found');

    const member = project.members.find((m) => m.userId === userId);
    if (!member) throw new NotFoundException('Member not found in this project');

    if (member.role === 'owner') throw new ForbiddenException('Cannot remove the project owner');

    if (requesterRole !== UserRole.admin) {
      const requester = project.members.find((m) => m.userId === requesterId);
      if (!requester || requester.role === 'member') {
        throw new ForbiddenException('Only owners/managers can remove members');
      }
    }

    await this.prisma.projectMember.delete({
      where: { projectId_userId: { projectId, userId } },
    });

    await this.activityLogs.log({
      userId: requesterId,
      action: ActivityAction.MEMBER_REMOVED,
      entityType: 'project',
      entityId: projectId,
      metadata: { removedUserId: userId, projectName: project.name },
    });

    return { message: 'Member removed successfully' };
  }

  async searchUsers(search: string) {
    return this.prisma.user.findMany({
      where: {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
        ],
        isActive: true,
      },
      select: { id: true, name: true, email: true, avatarUrl: true, role: true },
      take: 20,
    });
  }
}
