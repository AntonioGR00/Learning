import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

type SocketData = {
  userId?: number;
};

type JwtPayload = {
  sub: number;
  email: string;
  role: string;
};

@WebSocketGateway({
  cors: true,
})
export class MessagesGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(MessagesGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  private getUserId(client: Socket): number | undefined {
    const data = client.data as SocketData;
    return typeof data.userId === 'number' ? data.userId : undefined;
  }

  private setUserId(client: Socket, userId: number): void {
    const data = client.data as SocketData;
    data.userId = userId;
  }

  async handleConnection(client: Socket) {
    const tokenRaw =
      (client.handshake.auth?.token as string | undefined) ??
      (client.handshake.query?.token as string | undefined);

    if (!tokenRaw) {
      client.disconnect(true);
      return;
    }

    const token = tokenRaw.startsWith('Bearer ')
      ? tokenRaw.slice('Bearer '.length)
      : tokenRaw;

    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload>(token, {
        secret:
          this.configService.get<string>('JWT_ACCESS_SECRET') ??
          'access_secret',
      });

      const room = this.userRoom(payload.sub);
      await client.join(room);
      this.setUserId(client, payload.sub);
      this.logger.log(
        `[AUDIT] Socket connected: userId=${payload.sub} socketId=${client.id}`,
      );
    } catch {
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    const userId = this.getUserId(client);
    if (userId) {
      this.logger.debug(`[AUDIT] Socket disconnected: userId=${userId}`);
    }
  }

  @SubscribeMessage('typing:start')
  handleTypingStart(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { recipientId: number },
  ) {
    const senderId = this.getUserId(client);
    if (!senderId || !payload?.recipientId) return;
    this.server
      .to(this.userRoom(payload.recipientId))
      .emit('typing:start', { userId: senderId });
  }

  @SubscribeMessage('typing:stop')
  handleTypingStop(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { recipientId: number },
  ) {
    const senderId = this.getUserId(client);
    if (!senderId || !payload?.recipientId) return;
    this.server
      .to(this.userRoom(payload.recipientId))
      .emit('typing:stop', { userId: senderId });
  }

  emitMessageToUsers(userIds: number[], message: unknown) {
    userIds.forEach((userId) => {
      this.server.to(this.userRoom(userId)).emit('messages:new', message);
    });
  }

  private userRoom(userId: number) {
    return `user:${userId}`;
  }
}
