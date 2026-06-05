// src/comments/entities/comment.entity.ts
export class Comment {
  id: string;
  taskId: string;
  userId: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
}
