import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  UploadedFile,
  UseInterceptors,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
  Body,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
  ApiParam,
} from '@nestjs/swagger';
import { AttachmentsService } from './attachments.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ApiResponse } from '../common/response/api-response';
import { UploadAttachmentDto } from './dto/upload-attachment.dto';

@ApiTags('Attachments')
@ApiBearerAuth('JWT-auth')
@Controller('attachments')
export class AttachmentsController {
  constructor(private attachmentsService: AttachmentsService) {}

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: undefined, // Use memory storage → buffer
      limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload file attachment to a task' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file', 'taskId'],
      properties: {
        file: { type: 'string', format: 'binary' },
        taskId: { type: 'string', format: 'uuid' },
        description: { type: 'string' },
      },
    },
  })
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UploadAttachmentDto,
    @CurrentUser('id') userId: string,
  ) {
    const attachment = await this.attachmentsService.upload(
      file,
      dto.taskId,
      userId,
    );
    return ApiResponse.success(attachment, 'File uploaded successfully');
  }

  @Get('task/:taskId')
  @ApiOperation({ summary: 'Get all attachments for a task' })
  @ApiParam({ name: 'taskId', type: 'string', format: 'uuid' })
  async findByTask(@Param('taskId', ParseUUIDPipe) taskId: string) {
    const attachments = await this.attachmentsService.findByTask(taskId);
    return ApiResponse.success(attachments, 'Attachments retrieved');
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get single attachment by ID' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    const attachment = await this.attachmentsService.findOne(id);
    return ApiResponse.success(attachment, 'Attachment retrieved');
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete attachment' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: string,
  ) {
    const result = await this.attachmentsService.remove(id, userId, userRole);
    return ApiResponse.success(result, 'Attachment deleted');
  }
}