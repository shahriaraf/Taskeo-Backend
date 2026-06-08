import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ActivityAction } from '@prisma/client';

export class UserMiniEntity {
  @ApiProperty() id: string;
  @ApiProperty() name: string;
  @ApiPropertyOptional() avatarUrl?: string | null;
}

export class ActivityLogEntity {
  @ApiProperty() id: string;

  @ApiPropertyOptional() userId?: string | null;

  @ApiProperty({ enum: ActivityAction })
  action: ActivityAction;

  @ApiPropertyOptional() entityType?: string | null;

  @ApiPropertyOptional() entityId?: string | null;

  @ApiPropertyOptional({ type: Object })
  metadata?: Record<string, any> | null;

  @ApiProperty() createdAt: Date;

  @ApiPropertyOptional({ type: () => UserMiniEntity })
  user?: UserMiniEntity | null;

  // Computed human-readable message
  @ApiPropertyOptional()
  message?: string;
}