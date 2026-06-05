import { IsUUID, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UploadAttachmentDto {
  @ApiProperty({ example: 'uuid-of-task' })
  @IsUUID()
  @IsNotEmpty()
  taskId!: string;
}