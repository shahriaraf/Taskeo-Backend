import { IsNotEmpty, IsString, IsUUID, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateCommentDto {
  @ApiProperty({ example: 'uuid-of-task' })
  @IsUUID()
  @IsNotEmpty()
  taskId: string;

  @ApiProperty({ example: 'This looks good, let me review the PR.' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  content: string;
}
