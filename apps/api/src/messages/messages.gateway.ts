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

type JwtPayload = {
  sub: number;
  email: string;
  role: string;
};

@WebSocketGateway({
  cors: true,
})
export class MessagesGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(MessagesGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

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
          this.configService.get<string>('JWT_ACCESS_SECRET') ?? 'access_secret',
      });

      const room = this.userRoom(payload.sub);
      await client.join(room);
      client.data.userId = payload.sub;
      this.logger.log(`[AUDIT] Socket connected: userId=${payload.sub} socketId=${client.id}`);
    } catch {
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    const userId = client.data?.userId as number | undefined;
    if (userId) {
      this.logger.debug(`[AUDIT] Socket disconnected: userId=${userId}`);
    }
  }

  @SubscribeMessage('typing:start')
  handleTypingStart(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { recipientId: number },
  ) {
    const senderId = client.data?.userId as number | undefined;
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
    const senderId = client.data?.userId as number | undefined;
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

