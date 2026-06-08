import { IsOptional, IsString, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UploadAttachmentDto {
  @ApiProperty({ example: 'uuid-of-task' })
  @IsUUID()
  taskId: string;

  @ApiPropertyOptional({ example: 'Optional description for this file' })
  @IsOptional()
  @IsString()
  description?: string;
}