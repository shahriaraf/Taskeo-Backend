// src/tasks/tasks.controller.ts

import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { TasksService } from './tasks.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { FilterTasksDto } from './dto/filter-tasks.dto';
import { UpdateTaskStatusDto } from './dto/update-task-status.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ApiResponse } from '../common/response/api-response';

@ApiTags('Tasks')
@ApiBearerAuth('JWT-auth')
@Controller('tasks')
export class TasksController {
  constructor(private tasksService: TasksService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new task' })
  async create(
    @Body() dto: CreateTaskDto,
    @CurrentUser('id') userId: string,
  ) {
    const task = await this.tasksService.create(dto, userId);
    return ApiResponse.success(task, 'Task created successfully');
  }

  @Get()
  @ApiOperation({ summary: 'Get all tasks with filters' })
  async findAll(
    @Query() dto: FilterTasksDto,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: string,
  ) {
    const result = await this.tasksService.findAll(dto, userId, userRole);
    return ApiResponse.success(result.data, 'Tasks retrieved', result.meta);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get task by ID' })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: string,
  ) {
    const task = await this.tasksService.findOne(id, userId, userRole);
    return ApiResponse.success(task, 'Task retrieved');
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update task' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTaskDto,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: string,
  ) {
    const task = await this.tasksService.update(id, dto, userId, userRole);
    return ApiResponse.success(task, 'Task updated successfully');
  }

  @Patch(':id/status')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Quick update task status' })
  async updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTaskStatusDto,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: string,
  ) {
    const task = await this.tasksService.updateStatus(id, dto, userId, userRole);
    return ApiResponse.success(task, 'Task status updated');
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete task' })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: string,
  ) {
    const result = await this.tasksService.remove(id, userId, userRole);
    return ApiResponse.success(result, 'Task deleted');
  }
}