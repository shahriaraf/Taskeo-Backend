// src/projects/projects.controller.ts

import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { ProjectsService } from './projects.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { FilterProjectsDto } from './dto/filter-projects.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { ApiResponse } from '../common/response/api-response';

@ApiTags('Projects')
@ApiBearerAuth('JWT-auth')
@Controller('projects')
export class ProjectsController {
  constructor(private projectsService: ProjectsService) {}

  @Post()
  @Roles(UserRole.admin, UserRole.project_manager)
  @ApiOperation({ summary: 'Create a new project' })
  async create(
    @Body() dto: CreateProjectDto,
    @CurrentUser('id') userId: string,
  ) {
    const project = await this.projectsService.create(dto, userId);
    return ApiResponse.success(project, 'Project created successfully');
  }

  @Get()
  @ApiOperation({ summary: 'Get all projects with filters' })
  async findAll(
    @Query() dto: FilterProjectsDto,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: string,
  ) {
    const result = await this.projectsService.findAll(dto, userId, userRole);
    return ApiResponse.success(result.data, 'Projects retrieved', result.meta);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get project by ID' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async findOne(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: string,
  ) {
    const project = await this.projectsService.findOne(id, userId, userRole);
    return ApiResponse.success(project, 'Project retrieved');
  }

  @Get(':id/stats')
  @ApiOperation({ summary: 'Get project statistics' })
  async getStats(@Param('id') id: string) {
    const stats = await this.projectsService.getProjectStats(id);
    return ApiResponse.success(stats, 'Project stats retrieved');
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update project' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateProjectDto,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: string,
  ) {
    const project = await this.projectsService.update(id, dto, userId, userRole);
    return ApiResponse.success(project, 'Project updated successfully');
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.admin, UserRole.project_manager)
  @ApiOperation({ summary: 'Delete project' })
  async remove(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: string,
  ) {
    const result = await this.projectsService.remove(id, userId, userRole);
    return ApiResponse.success(result, 'Project deleted');
  }
}