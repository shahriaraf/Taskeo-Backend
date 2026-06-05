// prisma/seed.ts

import { PrismaClient, UserRole, ProjectStatus, TaskPriority, TaskStatus, ProjectMemberRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // ── Users ──────────────────────────────────────────────
  const passwordHash = await bcrypt.hash('Demo@1234', 12);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@demo.com' },
    update: {},
    create: {
      name: 'Admin User',
      email: 'admin@demo.com',
      passwordHash,
      role: UserRole.admin,
      isActive: true,
    },
  });

  const pm = await prisma.user.upsert({
    where: { email: 'pm@demo.com' },
    update: {},
    create: {
      name: 'Project Manager',
      email: 'pm@demo.com',
      passwordHash,
      role: UserRole.project_manager,
      isActive: true,
    },
  });

  const member1 = await prisma.user.upsert({
    where: { email: 'john@demo.com' },
    update: {},
    create: {
      name: 'John Smith',
      email: 'john@demo.com',
      passwordHash,
      role: UserRole.team_member,
      isActive: true,
    },
  });

  const member2 = await prisma.user.upsert({
    where: { email: 'jane@demo.com' },
    update: {},
    create: {
      name: 'Jane Doe',
      email: 'jane@demo.com',
      passwordHash,
      role: UserRole.team_member,
      isActive: true,
    },
  });

  console.log('✅ Users created');

  // ── Projects ───────────────────────────────────────────
  const project1 = await prisma.project.upsert({
    where: { id: 'seed-project-1' },
    update: {},
    create: {
      id: 'seed-project-1',
      name: 'E-Commerce App',
      description: 'Full-stack e-commerce platform with payment integration',
      deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      status: ProjectStatus.active,
      ownerId: admin.id,
      members: {
        create: [
          { userId: admin.id, role: ProjectMemberRole.owner },
          { userId: pm.id, role: ProjectMemberRole.manager },
          { userId: member1.id, role: ProjectMemberRole.member },
          { userId: member2.id, role: ProjectMemberRole.member },
        ],
      },
    },
  });

  const project2 = await prisma.project.upsert({
    where: { id: 'seed-project-2' },
    update: {},
    create: {
      id: 'seed-project-2',
      name: 'Mobile App Redesign',
      description: 'Redesign the mobile application UI/UX for better user experience',
      deadline: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days
      status: ProjectStatus.active,
      ownerId: pm.id,
      members: {
        create: [
          { userId: pm.id, role: ProjectMemberRole.owner },
          { userId: member1.id, role: ProjectMemberRole.member },
        ],
      },
    },
  });

  const project3 = await prisma.project.upsert({
    where: { id: 'seed-project-3' },
    update: {},
    create: {
      id: 'seed-project-3',
      name: 'Admin Dashboard',
      description: 'Internal admin dashboard for operations team',
      deadline: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000), // 60 days
      status: ProjectStatus.on_hold,
      ownerId: admin.id,
      members: {
        create: [
          { userId: admin.id, role: ProjectMemberRole.owner },
          { userId: member2.id, role: ProjectMemberRole.member },
        ],
      },
    },
  });

  console.log('✅ Projects created');

  // ── Tasks ──────────────────────────────────────────────
  const tasksData = [
    // Project 1 - E-Commerce App
    {
      title: 'Setup API Routes',
      description: 'Create all REST API endpoints for the platform',
      projectId: project1.id,
      assigneeId: member1.id,
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      priority: TaskPriority.high,
      status: TaskStatus.in_progress,
      createdBy: pm.id,
    },
    {
      title: 'Homepage Design',
      description: 'Design the homepage with hero section and featured products',
      projectId: project1.id,
      assigneeId: member2.id,
      dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
      priority: TaskPriority.high,
      status: TaskStatus.completed,
      createdBy: pm.id,
    },
    {
      title: 'Payment Gateway Integration',
      description: 'Integrate Stripe payment gateway',
      projectId: project1.id,
      assigneeId: member1.id,
      dueDate: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000),
      priority: TaskPriority.high,
      status: TaskStatus.todo,
      createdBy: admin.id,
    },
    {
      title: 'Product Catalog Page',
      description: 'Build product listing page with filters and pagination',
      projectId: project1.id,
      assigneeId: member2.id,
      dueDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
      priority: TaskPriority.medium,
      status: TaskStatus.in_progress,
      createdBy: pm.id,
    },
    {
      title: 'User Authentication',
      description: 'Implement signup, login and JWT auth',
      projectId: project1.id,
      assigneeId: member1.id,
      dueDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // overdue
      priority: TaskPriority.high,
      status: TaskStatus.in_progress,
      createdBy: admin.id,
    },
    // Project 2 - Mobile App
    {
      title: 'Wireframe Design',
      description: 'Create wireframes for all major screens',
      projectId: project2.id,
      assigneeId: member1.id,
      dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      priority: TaskPriority.high,
      status: TaskStatus.completed,
      createdBy: pm.id,
    },
    {
      title: 'Implement Navigation',
      description: 'Setup bottom tab navigation and routing',
      projectId: project2.id,
      assigneeId: member1.id,
      dueDate: new Date(Date.now() + 8 * 24 * 60 * 60 * 1000),
      priority: TaskPriority.medium,
      status: TaskStatus.todo,
      createdBy: pm.id,
    },
    // Project 3 - Admin Dashboard
    {
      title: 'Database Schema Design',
      description: 'Design database schema for admin panel',
      projectId: project3.id,
      assigneeId: member2.id,
      dueDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
      priority: TaskPriority.medium,
      status: TaskStatus.todo,
      createdBy: admin.id,
    },
  ];

  for (const task of tasksData) {
    await prisma.task.upsert({
      where: {
        projectId_title: {
          projectId: task.projectId,
          title: task.title,
        },
      },
      update: {},
      create: task,
    });
  }

  console.log('✅ Tasks created');

  // ── Activity Logs ──────────────────────────────────────
  await prisma.activityLog.createMany({
    data: [
      {
        userId: admin.id,
        action: 'PROJECT_CREATED',
        entityType: 'project',
        entityId: project1.id,
        metadata: { projectName: 'E-Commerce App' },
      },
      {
        userId: pm.id,
        action: 'TASK_ASSIGNED',
        entityType: 'task',
        entityId: 'seed-task-1',
        metadata: { taskTitle: 'Setup API Routes', assigneeName: 'John Smith' },
      },
      {
        userId: member2.id,
        action: 'TASK_STATUS_CHANGED',
        entityType: 'task',
        entityId: 'seed-task-2',
        metadata: {
          taskTitle: 'Homepage Design',
          oldStatus: 'in_progress',
          newStatus: 'completed',
        },
      },
      {
        userId: admin.id,
        action: 'MEMBER_ADDED',
        entityType: 'project',
        entityId: project1.id,
        metadata: { userName: 'Jane Doe', projectName: 'E-Commerce App' },
      },
    ],
    skipDuplicates: true,
  });

  console.log('✅ Activity logs created');
  console.log('');
  console.log('🎉 Seed completed successfully!');
  console.log('');
  console.log('Demo Credentials:');
  console.log('  Admin:          admin@demo.com  / Demo@1234');
  console.log('  Project Manager: pm@demo.com    / Demo@1234');
  console.log('  Team Member:    john@demo.com   / Demo@1234');
  console.log('  Team Member:    jane@demo.com   / Demo@1234');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
