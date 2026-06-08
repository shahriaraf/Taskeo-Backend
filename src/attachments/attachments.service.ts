import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityLogsService } from '../activity-logs/activity-logs.service';
import { ActivityAction, UserRole } from '@prisma/client';
import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';

@Injectable()
export class AttachmentsService {
  private readonly logger = new Logger(AttachmentsService.name);

  // 10 MB limit
  private readonly MAX_FILE_SIZE = 10 * 1024 * 1024;

  private readonly ALLOWED_MIME_TYPES = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
    'application/zip',
  ];

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
    private activityLogs: ActivityLogsService,
  ) {
    // Configure Cloudinary
    cloudinary.config({
      cloud_name: this.configService.get<string>('cloudinary.cloudName'),
      api_key: this.configService.get<string>('cloudinary.apiKey'),
      api_secret: this.configService.get<string>('cloudinary.apiSecret'),
    });
  }

  async upload(
    file: Express.Multer.File,
    taskId: string,
    userId: string,
  ) {
    // ── Validate file ─────────────────────────────────────
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    if (file.size > this.MAX_FILE_SIZE) {
      throw new BadRequestException('File size exceeds 10MB limit');
    }

    if (!this.ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      throw new BadRequestException(
        `File type not allowed. Allowed: ${this.ALLOWED_MIME_TYPES.join(', ')}`,
      );
    }

    // ── Validate task exists ──────────────────────────────
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      include: { project: { select: { name: true } } },
    });

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    // ── Upload to Cloudinary ──────────────────────────────
    let uploadResult: UploadApiResponse;
    try {
      uploadResult = await this.uploadToCloudinary(file);
    } catch (error) {
      this.logger.error('Cloudinary upload failed', error);
      throw new BadRequestException('File upload failed. Please try again.');
    }

    // ── Save to database ──────────────────────────────────
    const attachment = await this.prisma.fileAttachment.create({
      data: {
        taskId,
        uploadedBy: userId,
        filename: file.originalname,
        url: uploadResult.secure_url,
        publicId: uploadResult.public_id,
        size: file.size,
        mimeType: file.mimetype,
      },
      include: {
        uploader: { select: { id: true, name: true } },
      },
    });

    // ── Activity log ──────────────────────────────────────
    await this.activityLogs.log({
      userId,
      action: ActivityAction.FILE_UPLOADED,
      entityType: 'task',
      entityId: taskId,
      metadata: {
        filename: file.originalname,
        taskTitle: task.title,
        projectName: task.project.name,
      },
    });

    return attachment;
  }

  async findByTask(taskId: string) {
    const task = await this.prisma.task.findUnique({ where: { id: taskId } });
    if (!task) throw new NotFoundException('Task not found');

    return this.prisma.fileAttachment.findMany({
      where: { taskId },
      include: {
        uploader: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async remove(id: string, userId: string, userRole: string) {
    const attachment = await this.prisma.fileAttachment.findUnique({
      where: { id },
      include: {
        task: { select: { title: true } },
      },
    });

    if (!attachment) {
      throw new NotFoundException('Attachment not found');
    }

    // ── Access control ────────────────────────────────────
    // Only uploader, admin, or project_manager can delete
    const canDelete =
      attachment.uploadedBy === userId ||
      userRole === UserRole.admin ||
      userRole === UserRole.project_manager;

    if (!canDelete) {
      throw new ForbiddenException(
        'You do not have permission to delete this attachment',
      );
    }

    // ── Delete from Cloudinary ────────────────────────────
    if (attachment.publicId) {
      try {
        await cloudinary.uploader.destroy(attachment.publicId);
      } catch (error) {
        this.logger.warn(
          `Failed to delete from Cloudinary: ${attachment.publicId}`,
          error,
        );
      }
    }

    // ── Delete from database ──────────────────────────────
    await this.prisma.fileAttachment.delete({ where: { id } });

    // ── Activity log ──────────────────────────────────────
    await this.activityLogs.log({
      userId,
      action: ActivityAction.FILE_DELETED,
      entityType: 'attachment',
      entityId: id,
      metadata: {
        filename: attachment.filename,
        taskTitle: attachment.task.title,
      },
    });

    return { message: 'Attachment deleted successfully' };
  }

  async findOne(id: string) {
    const attachment = await this.prisma.fileAttachment.findUnique({
      where: { id },
      include: {
        uploader: { select: { id: true, name: true } },
      },
    });

    if (!attachment) throw new NotFoundException('Attachment not found');
    return attachment;
  }

  // ── Private Helpers ───────────────────────────────────────────

  private uploadToCloudinary(
    file: Express.Multer.File,
  ): Promise<UploadApiResponse> {
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: 'task-collaboration/attachments',
          resource_type: 'auto',
          use_filename: true,
          unique_filename: true,
        },
        (error, result) => {
          if (error) return reject(error);
          resolve(result as UploadApiResponse);
        },
      );
      uploadStream.end(file.buffer);
    });
  }
}