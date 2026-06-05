// src/events/events.gateway.ts

import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';

@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL,
    credentials: true,
  },
  namespace: '/events',
})
export class EventsGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(EventsGateway.name);
  private connectedUsers = new Map<string, string>(); // socketId → userId

  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth?.token;
      if (!token) {
        client.disconnect();
        return;
      }

      const payload = this.jwtService.verify(token, {
        secret: this.configService.get<string>('jwt.accessSecret'),
      });

      this.connectedUsers.set(client.id, payload.sub);
      client.join(`user:${payload.sub}`);
      this.logger.log(`Client connected: ${client.id} (User: ${payload.sub})`);
    } catch {
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    this.connectedUsers.delete(client.id);
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('join:project')
  handleJoinProject(
    @ConnectedSocket() client: Socket,
    @MessageBody() projectId: string,
  ) {
    client.join(`project:${projectId}`);
    this.logger.log(`Socket ${client.id} joined project:${projectId}`);
  }

  @SubscribeMessage('leave:project')
  handleLeaveProject(
    @ConnectedSocket() client: Socket,
    @MessageBody() projectId: string,
  ) {
    client.leave(`project:${projectId}`);
  }

  // Emit to all users in a project room
  emitToProject(projectId: string, event: string, data: any) {
    this.server.to(`project:${projectId}`).emit(event, data);
  }

  // Emit to a specific user
  emitToUser(userId: string, event: string, data: any) {
    this.server.to(`user:${userId}`).emit(event, data);
  }

  // Broadcast to all connected clients
  broadcast(event: string, data: any) {
    this.server.emit(event, data);
  }
}