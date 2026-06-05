// src/users/users.controller.ts

import {
  Controller,
  Get,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  Query,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ApiResponse } from '../common/response/api-response';

@ApiTags('Users')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @ApiOperation({ summary: 'Get all users (Admin only)' })
  async findAll(
    @Query('search') search?: string,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    const result = await this.usersService.findAll(search, +page, +limit);
    return ApiResponse.success(result, 'Users retrieved');
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get user by ID' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    const user = await this.usersService.findOne(id);
    return ApiResponse.success(user, 'User retrieved');
  }

  @Get(':id/stats')
  @ApiOperation({ summary: 'Get task statistics for a user' })
  async getUserStats(@Param('id', ParseUUIDPipe) id: string) {
    const stats = await this.usersService.getUserTaskStats(id);
    return ApiResponse.success(stats, 'User stats retrieved');
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update user profile' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser('id') requesterId: string,
    @CurrentUser('role') requesterRole: string,
  ) {
    const user = await this.usersService.update(id, dto, requesterId, requesterRole);
    return ApiResponse.success(user, 'User updated successfully');
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Deactivate a user (Admin only)' })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('role') requesterRole: string,
  ) {
    const result = await this.usersService.remove(id, requesterRole);
    return ApiResponse.success(result, 'User deactivated successfully');
  }
}
