// src/notifications/entities/notification.entity.ts
import { NotificationType } from '@prisma/client';

export class Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: NotificationType;
  isRead: boolean;
  entityType?: string;
  entityId?: string;
  createdAt: Date;
}
