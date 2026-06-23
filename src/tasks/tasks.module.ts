// src/tasks/tasks.module.ts
import { Module } from '@nestjs/common';
import { TasksService } from './tasks.service';
import { TasksController } from './tasks.controller';
import { SubTasksService } from './subtasks/subtasks.service';
import { SubTasksController } from './subtasks/subtasks.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { ActivityLogsModule } from '../activity-logs/activity-logs.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { EventsModule } from '../events/events.module';
import { MailModule } from '../mail/mail.module';

@Module({
  imports: [
    PrismaModule,
    ActivityLogsModule,
    NotificationsModule,
    EventsModule,
    MailModule,
  ],
  controllers: [TasksController, SubTasksController],
  providers: [TasksService, SubTasksService],
  exports: [TasksService, SubTasksService],
})
export class TasksModule {}
