import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
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
    } catch {
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    const userId = client.data?.userId as number | undefined;
    if (userId) {
      this.logger.debug(`Socket disconnected for user ${userId}`);
    }
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
