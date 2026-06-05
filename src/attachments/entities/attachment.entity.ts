// src/attachments/entities/attachment.entity.ts

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AttachmentUploaderEntity {
  @ApiProperty() id: string;
  @ApiProperty() name: string;
}

export class AttachmentEntity {
  @ApiProperty()                              id: string;
  @ApiProperty()                              taskId: string;
  @ApiProperty()                              uploadedBy: string;
  @ApiProperty()                              filename: string;
  @ApiProperty()                              url: string;
  @ApiPropertyOptional()                      publicId?: string | null;
  @ApiPropertyOptional({ example: 204800 })   size?: number | null;
  @ApiPropertyOptional({ example: 'image/png' }) mimeType?: string | null;
  @ApiProperty()                              createdAt: Date;

  @ApiProperty({ type: () => AttachmentUploaderEntity })
  uploader: AttachmentUploaderEntity;
}