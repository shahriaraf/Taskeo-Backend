import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { TasksService } from '../../src/tasks/tasks.service';
import { PrismaService } from '../../src/prisma/prisma.service';
import { ActivityLogsService } from '../../src/activity-logs/activity-logs.service';
import { NotificationsService } from '../../src/notifications/notifications.service';
import { EventsGateway } from '../../src/events/events.gateway';
import { TaskStatus, TaskPriority } from '@prisma/client';

// ── Mocks ────────────────────────────────────────────
const mockTask = {
  id: 'task-uuid-1',
  title: 'Build login page',
  description: 'Create the login form',
  projectId: 'project-uuid-1',
  assigneeId: 'user-uuid-2',
  dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
  priority: TaskPriority.medium,
  status: TaskStatus.todo,
  createdBy: 'user-uuid-1',
  createdAt: new Date(),
  updatedAt: new Date(),
  project: { id: 'project-uuid-1', name: 'My Project' },
  assignee: { id: 'user-uuid-2', name: 'Jane', email: 'jane@example.com', avatarUrl: null },
  creator: { id: 'user-uuid-1', name: 'John' },
  _count: { comments: 0, attachments: 0 },
};

const mockProject = {
  id: 'project-uuid-1',
  name: 'My Project',
  members: [
    { userId: 'user-uuid-1', role: 'owner' },
    { userId: 'user-uuid-2', role: 'member' },
  ],
};

const mockPrisma = {
  task: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  project: {
    findUnique: jest.fn(),
  },
};

const mockActivityLogs = { log: jest.fn().mockResolvedValue(undefined) };
const mockNotifications = { create: jest.fn().mockResolvedValue(undefined) };
const mockEventsGateway = { emitToProject: jest.fn() };

describe('TasksService', () => {
  let service: TasksService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TasksService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ActivityLogsService, useValue: mockActivityLogs },
        { provide: NotificationsService, useValue: mockNotifications },
        { provide: EventsGateway, useValue: mockEventsGateway },
      ],
    }).compile();

    service = module.get<TasksService>(TasksService);
    jest.clearAllMocks();
  });

  // ── create ────────────────────────────────────────
  describe('create', () => {
    const dto = {
      title: 'Build login page',
      projectId: 'project-uuid-1',
      assigneeId: 'user-uuid-2',
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      priority: TaskPriority.medium,
    };

    it('should create a task and notify the assignee', async () => {
      mockPrisma.project.findUnique.mockResolvedValue(mockProject);
      mockPrisma.task.findUnique.mockResolvedValue(null); // no duplicate
      mockPrisma.task.create.mockResolvedValue(mockTask);

      const result = await service.create(dto, 'user-uuid-1');

      expect(result.title).toBe('Build login page');
      expect(mockNotifications.create).toHaveBeenCalledTimes(1);
      expect(mockEventsGateway.emitToProject).toHaveBeenCalledWith(
        'project-uuid-1',
        'task:created',
        mockTask,
      );
    });

    it('should throw NotFoundException when project does not exist', async () => {
      mockPrisma.project.findUnique.mockResolvedValue(null);

      await expect(service.create(dto, 'user-uuid-1')).rejects.toThrow(NotFoundException);
    });

    it('should not send notification when assignee is the creator', async () => {
      mockPrisma.project.findUnique.mockResolvedValue(mockProject);
      mockPrisma.task.findUnique.mockResolvedValue(null);
      mockPrisma.task.create.mockResolvedValue({ ...mockTask, assigneeId: 'user-uuid-1' });

      await service.create({ ...dto, assigneeId: 'user-uuid-1' }, 'user-uuid-1');

      // No notification when assigning to yourself
      expect(mockNotifications.create).not.toHaveBeenCalled();
    });
  });

  // ── findOne ───────────────────────────────────────
  describe('findOne', () => {
    it('should return a task for an admin user', async () => {
      mockPrisma.task.findUnique.mockResolvedValue(mockTask);

      const result = await service.findOne('task-uuid-1', 'any-user', 'admin');
      expect(result.id).toBe('task-uuid-1');
    });

    it('should throw NotFoundException when task does not exist', async () => {
      mockPrisma.task.findUnique.mockResolvedValue(null);

      await expect(service.findOne('nonexistent', 'user-uuid-1', 'admin')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException when team_member accesses another user task', async () => {
      mockPrisma.task.findUnique.mockResolvedValue(mockTask); // assigned to user-uuid-2

      await expect(
        service.findOne('task-uuid-1', 'user-uuid-99', 'team_member'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should allow team_member to access their own task', async () => {
      mockPrisma.task.findUnique.mockResolvedValue(mockTask); // assigned to user-uuid-2

      const result = await service.findOne('task-uuid-1', 'user-uuid-2', 'team_member');
      expect(result.id).toBe('task-uuid-1');
    });
  });

  // ── remove ────────────────────────────────────────
  describe('remove', () => {
    it('should delete a task for admin', async () => {
      mockPrisma.task.findUnique.mockResolvedValue(mockTask);
      mockPrisma.task.delete.mockResolvedValue(mockTask);

      const result = await service.remove('task-uuid-1', 'user-uuid-1', 'admin');
      expect(result.message).toBe('Task deleted successfully');
    });

    it('should throw ForbiddenException for team_member trying to delete', async () => {
      mockPrisma.task.findUnique.mockResolvedValue(mockTask);

      await expect(
        service.remove('task-uuid-1', 'user-uuid-2', 'team_member'),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
