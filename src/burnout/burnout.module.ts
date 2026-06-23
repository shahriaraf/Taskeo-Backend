import { Module } from '@nestjs/common';
import { BurnoutController } from './burnout.controller';
import { BurnoutService } from './burnout.service';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [PrismaModule, NotificationsModule],
  controllers: [BurnoutController],
  providers: [BurnoutService],
  exports: [BurnoutService],
})
export class BurnoutModule {}
