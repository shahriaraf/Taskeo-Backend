// src/app.module.ts  (Phase 1 — adds SearchModule, MailModule to imports)
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';

import configuration from './config/configuration';
import { validate } from './config/env.validation';

import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './common/redis/redis.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ProjectsModule } from './projects/projects.module';
import { TasksModule } from './tasks/tasks.module';
import { TeamModule } from './team/team.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { ActivityLogsModule } from './activity-logs/activity-logs.module';
import { NotificationsModule } from './notifications/notifications.module';
import { CommentsModule } from './comments/comments.module';
import { AttachmentsModule } from './attachments/attachments.module';
import { EventsModule } from './events/events.module';
import { SearchModule } from './search/search.module';   // NEW
import { MailModule } from './mail/mail.module';           // NEW
import { CustomThrottlerGuard } from './auth/guards/custom-throttler.guard';
import { BurnoutModule } from 'burnout/burnout.module';
import { PostMortemModule } from 'postmortem/postmortem.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validate,
    }),
    ThrottlerModule.forRoot([
      { name: 'short', ttl: 1000, limit: 10 },
      { name: 'medium', ttl: 10000, limit: 50 },
      { name: 'long', ttl: 60000, limit: 150 },
    ]),
    PrismaModule,
    RedisModule,
    EventsModule,
    AuthModule,
    UsersModule,
    ProjectsModule,
    TasksModule,
    TeamModule,
    AnalyticsModule,
    ActivityLogsModule,
    NotificationsModule,
    CommentsModule,
    AttachmentsModule,
    SearchModule,  
    MailModule,
    BurnoutModule,
    PostMortemModule 
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: CustomThrottlerGuard,
    },
  ],
})
export class AppModule { }
