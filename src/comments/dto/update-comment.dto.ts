import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateCommentDto {
  @ApiProperty({ example: 'Updated comment text.' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  content: string;
}
