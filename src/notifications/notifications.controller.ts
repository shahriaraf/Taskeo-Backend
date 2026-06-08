import {
  Controller,
  Get,
  Patch,
  Param,
  UseGuards,
  Query,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ApiResponse } from '../common/response/api-response';

@ApiTags('Notifications')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'Get notifications for current user' })
  async findMyNotifications(
    @CurrentUser('id') userId: string,
    @Query('page') page = 1,
    @Query('limit') limit = 10,
  ) {
    const result = await this.notificationsService.findByUser(userId, +page, +limit);
    return ApiResponse.success(result, 'Notifications retrieved');
  }

  @Patch(':id/read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark a notification as read' })
  async markAsRead(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
  ) {
    await this.notificationsService.markAsRead(id, userId);
    return ApiResponse.success(null, 'Notification marked as read');
  }

  @Patch('read-all')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark all notifications as read' })
  async markAllAsRead(@CurrentUser('id') userId: string) {
    await this.notificationsService.markAllAsRead(userId);
    return ApiResponse.success(null, 'All notifications marked as read');
  }
}
