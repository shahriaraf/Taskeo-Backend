import { Module } from '@nestjs/common';
import { PostMortemController } from './postmortem.controller';
import { PostMortemService } from './postmortem.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [PostMortemController],
  providers: [PostMortemService],
  exports: [PostMortemService],
})
export class PostMortemModule {}
