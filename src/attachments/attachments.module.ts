import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { AttachmentsService } from './attachments.service';
import { AttachmentsController } from './attachments.controller';
import { ActivityLogsModule } from '../activity-logs/activity-logs.module';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [
    MulterModule.register({
      storage: memoryStorage(),
    }),
    PrismaModule,
    ActivityLogsModule,
  ],
  controllers: [AttachmentsController],
  providers: [AttachmentsService],
  exports: [AttachmentsService],
})
export class AttachmentsModule {}
