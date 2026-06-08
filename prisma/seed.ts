// prisma/seed.ts
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  // ── Users ──────────────────────────────────────────────────────────────────
  const hashedPassword = await bcrypt.hash('Demo@123', 10);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@flowboard.dev' },
    update: {},
    create: {
      // NO manual id — let Prisma generate UUID automatically
      name: 'Admin User',
      email: 'admin@flowboard.dev',
      passwordHash: hashedPassword,
      role: 'admin',
      isActive: true,
    },
  });

  const pm = await prisma.user.upsert({
    where: { email: 'pm@flowboard.dev' },
    update: {},
    create: {
      name: 'Project Manager',
      email: 'pm@flowboard.dev',
      passwordHash: hashedPassword,
      role: 'project_manager',
      isActive: true,
    },
  });

  const member = await prisma.user.upsert({
    where: { email: 'member@flowboard.dev' },
    update: {},
    create: {
      name: 'Team Member',
      email: 'member@flowboard.dev',
      passwordHash: hashedPassword,
      role: 'team_member',
      isActive: true,
    },
  });

  // ── Projects ───────────────────────────────────────────────────────────────
  // Use upsert by name+owner to avoid duplicates on re-seed
  // NEVER set manual id — always let @default(uuid()) handle it

  const project1 = await prisma.project.create({
    data: {
      // id: NOT SET — Prisma generates a real UUID
      name: 'E-Commerce App',
      description: 'Full stack e-commerce platform with payment integration',
      deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      status: 'active',
      ownerId: admin.id,
      members: {
        create: [
          { userId: admin.id,  role: 'owner'   },
          { userId: pm.id,     role: 'manager' },
          { userId: member.id, role: 'member'  },
        ],
      },
    },
  });

  const project2 = await prisma.project.create({
    data: {
      name: 'Mobile App Redesign',
      description: 'Redesign the mobile app with new UI/UX guidelines',
      deadline: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000), // 60 days
      status: 'active',
      ownerId: pm.id,
      members: {
        create: [
          { userId: pm.id,     role: 'owner'  },
          { userId: member.id, role: 'member' },
        ],
      },
    },
  });

  // ── Tasks ──────────────────────────────────────────────────────────────────
  await prisma.task.createMany({
    data: [
      {
        // id: NOT SET
        title: 'Setup API Routes',
        description: 'Create all REST API endpoints for the backend',
        projectId: project1.id,
        assigneeId: member.id,
        createdBy: admin.id,
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        priority: 'high',
        status: 'in_progress',
      },
      {
        title: 'Design Homepage',
        description: 'Create homepage mockups and implement UI',
        projectId: project1.id,
        assigneeId: pm.id,
        createdBy: admin.id,
        dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        priority: 'high',
        status: 'todo',
      },
      {
        title: 'Payment Integration',
        description: 'Integrate Stripe payment gateway',
        projectId: project1.id,
        assigneeId: member.id,
        createdBy: pm.id,
        dueDate: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000),
        priority: 'high',
        status: 'todo',
      },
      {
        title: 'UI Component Library',
        description: 'Build reusable component library for mobile app',
        projectId: project2.id,
        assigneeId: member.id,
        createdBy: pm.id,
        dueDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
        priority: 'medium',
        status: 'completed',
      },
      {
        title: 'User Testing',
        description: 'Conduct user testing sessions and gather feedback',
        projectId: project2.id,
        assigneeId: pm.id,
        createdBy: pm.id,
        dueDate: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000),
        priority: 'medium',
        status: 'todo',
      },
    ],
    skipDuplicates: true,
  });

  console.log('✅ Seed completed successfully');
  console.log(`   Admin:   admin@flowboard.dev  / Demo@123`);
  console.log(`   PM:      pm@flowboard.dev     / Demo@123`);
  console.log(`   Member:  member@flowboard.dev / Demo@123`);
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });