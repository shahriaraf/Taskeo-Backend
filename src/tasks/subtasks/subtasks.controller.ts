// src/tasks/subtasks/subtasks.controller.ts
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SubTasksService } from './subtasks.service';
import { CreateSubTaskDto } from '../dto/create-subtask.dto';
import { UpdateTaskDto } from '../dto/update-task.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ApiResponse } from '../../common/response/api-response';

@ApiTags('Sub-Tasks')
@ApiBearerAuth('JWT-auth')
@Controller('tasks/:taskId/subtasks')
export class SubTasksController {
  constructor(private subTasksService: SubTasksService) {}

  /**
   * POST /tasks/:taskId/subtasks
   * Create a sub-task under a parent task.
   */
  @Post()
  @ApiOperation({ summary: 'Create a sub-task under a parent task' })
  async create(
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Body() dto: CreateSubTaskDto,
    @CurrentUser('id') userId: string,
  ) {
    const subTask = await this.subTasksService.create(taskId, dto, userId);
    return ApiResponse.success(subTask, 'Sub-task created successfully');
  }

  /**
   * GET /tasks/:taskId/subtasks
   * Get all sub-tasks for a parent task.
   */
  @Get()
  @ApiOperation({ summary: 'Get all sub-tasks of a task' })
  async findAll(
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: string,
  ) {
    const subTasks = await this.subTasksService.findByParent(taskId, userId, userRole);
    return ApiResponse.success(subTasks, 'Sub-tasks retrieved');
  }

  /**
   * PATCH /tasks/:taskId/subtasks/:subTaskId
   * Update a specific sub-task.
   */
  @Patch(':subTaskId')
  @ApiOperation({ summary: 'Update a sub-task' })
  async update(
    @Param('subTaskId', ParseUUIDPipe) subTaskId: string,
    @Body() dto: UpdateTaskDto,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: string,
  ) {
    const updated = await this.subTasksService.update(subTaskId, dto, userId, userRole);
    return ApiResponse.success(updated, 'Sub-task updated successfully');
  }

  /**
   * DELETE /tasks/:taskId/subtasks/:subTaskId
   */
  @Delete(':subTaskId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a sub-task' })
  async remove(
    @Param('subTaskId', ParseUUIDPipe) subTaskId: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: string,
  ) {
    const result = await this.subTasksService.remove(subTaskId, userId, userRole);
    return ApiResponse.success(result, result.message);
  }

  /**
   * PATCH /tasks/:taskId/subtasks/reorder
   * Reorder sub-tasks. Body: { ids: string[] }
   */
  @Patch('reorder')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reorder sub-tasks (drag and drop)' })
  async reorder(
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Body('ids') ids: string[],
  ) {
    const result = await this.subTasksService.reorder(taskId, ids);
    return ApiResponse.success(result, result.message);
  }
}
