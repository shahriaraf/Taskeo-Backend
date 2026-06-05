// src/comments/comments.controller.ts

import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CommentsService } from './comments.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ApiResponse } from '../common/response/api-response';

@ApiTags('Comments')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('comments')
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  @Post()
  @ApiOperation({ summary: 'Add a comment to a task' })
  async create(
    @Body() dto: CreateCommentDto,
    @CurrentUser('id') userId: string,
  ) {
    const comment = await this.commentsService.create(dto, userId);
    return ApiResponse.success(comment, 'Comment added successfully');
  }

  @Get('task/:taskId')
  @ApiOperation({ summary: 'Get all comments for a task' })
  async findByTask(
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    const result = await this.commentsService.findByTask(taskId, +page, +limit);
    return ApiResponse.success(result, 'Comments retrieved');
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a comment' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCommentDto,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: string,
  ) {
    const comment = await this.commentsService.update(id, dto, userId, userRole);
    return ApiResponse.success(comment, 'Comment updated successfully');
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a comment' })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: string,
  ) {
    const result = await this.commentsService.remove(id, userId, userRole);
    return ApiResponse.success(result, 'Comment deleted successfully');
  }
}
