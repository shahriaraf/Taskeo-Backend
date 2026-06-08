import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UploaderDto {
  @ApiProperty() id: string;
  @ApiProperty() name: string;
}

export class AttachmentResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() taskId: string;
  @ApiProperty() filename: string;
  @ApiProperty() url: string;
  @ApiPropertyOptional() publicId?: string | null;
  @ApiPropertyOptional() size?: number | null;
  @ApiPropertyOptional() mimeType?: string | null;
  @ApiProperty() createdAt: Date;
  @ApiProperty({ type: UploaderDto }) uploader: UploaderDto;
}