import { Logger } from '@nestjs/common';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  //SubscribeMessage,
  WebSocketGateway,
  //WebSocketServer,
} from '@nestjs/websockets';

//import { Server, Socket } from 'socket.io';
import { Socket } from 'socket.io';

import { SessionMetadata, SessionsService } from './sessions.service';
import { UsersService } from '../users/users.service';
import { User } from '../users/entities/user.entity';
import { JwtService } from 'src/auth';
import { ReceptionProcess } from '../reception-process/entities';

@WebSocketGateway({
  namespace: 'sessions',
  cors: {
    origin: true,
    credentials: true,
  },
})
export class SessionsGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  /* @WebSocketServer()
  private readonly server: Server; */

  private readonly logger = new Logger(SessionsGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly sessionsService: SessionsService,
    private readonly usersService: UsersService,
  ) {}

  private get currentUsersIds(): number[] {
    return this.sessionsService.getAllUserIds();
  }

  private get currentUsers(): Promise<User[]> {
    return this.usersService.findAllByIds(this.currentUsersIds);
  }

  handleConnection(client: Socket): void {
    try {
      const token = this.extractToken(client);
      const { userId } = this.jwtService.verify(token);

      (client.data as { userId: number }).userId = userId;

      const snapshot = this.sessionsService.register(
        userId,
        client,
        this.buildMetadata(client),
      );

      client.emit(
        'sessions:ready',
        {
          socketId: client.id,
          sessions: snapshot,
        },
        async () => {
          await this.updateCurrentUser(client, userId);
          await this.updateCurrentUsers();
        },
      );

      this.sessionsService.emitToUser(userId, 'sessions:update', snapshot);

      this.logger.debug(
        `User ${userId} connected to sessions gateway with socket ${client.id}`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unauthorized';
      this.logger.warn(`WS connection refused: ${message}`);
      client.emit('sessions:error', { message: 'Unauthorized' });
      client.disconnect(true);
    }
  }

  async handleDisconnect(client: Socket): Promise<void> {
    const userId: number | undefined = (client.data as { userId?: number })
      .userId;

    if (!userId) {
      client.disconnect(true);
      return;
    }

    const snapshot = this.sessionsService.unregister(userId, client.id);

    if (snapshot.length) {
      this.sessionsService.emitToUser(userId, 'sessions:update', snapshot);
    }

    await this.updateCurrentUsers();

    this.logger.debug(
      `User ${userId} disconnected from sessions gateway (socket ${client.id})`,
    );
  }

  emitToUser<T>(userId: number, event: string, payload: T): number {
    return this.sessionsService.emitToUser(userId, event, payload);
  }

  private extractToken(client: Socket): string {
    const cookies = client.handshake.headers.cookie;
    const header = client.handshake.headers.authorization;

    if (cookies) {
      const match = cookies
        .split(';')
        .map((cookie) => cookie.trim())
        .find((cookie) => cookie.startsWith('token='));
      if (match) {
        return match.slice(6);
      }
    }

    if (typeof header === 'string' && header.startsWith('Bearer ')) {
      return header.slice(7);
    }

    const authToken = client.handshake.auth?.token as unknown;
    if (typeof authToken === 'string') {
      return authToken;
    }

    const queryToken = client.handshake.query?.token as unknown;
    if (typeof queryToken === 'string') {
      return queryToken;
    }

    throw new Error('Missing authentication token');
  }

  private buildMetadata(client: Socket): SessionMetadata {
    const deviceContext = this.resolveContext(client);
    const userAgent = client.handshake.headers['user-agent'];

    return {
      ip: client.handshake.address,
      userAgent: typeof userAgent === 'string' ? userAgent : undefined,
      deviceContext,
    };
  }

  private resolveContext(client: Socket): string | undefined {
    const userAgent = client.handshake.headers['user-agent'];

    if (!userAgent || typeof userAgent !== 'string') {
      return undefined;
    }

    const mobileRegex =
      /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i;
    const desktopRegex = /Windows|Macintosh|Linux/i;

    if (mobileRegex.test(userAgent)) {
      return 'mobile';
    }

    if (desktopRegex.test(userAgent)) {
      return 'desktop';
    }

    return undefined;
  }

  private emitAllUsers<T>(event: string, payload: T): void {
    this.currentUsersIds.forEach((userId) => {
      this.sessionsService.emitToUser(userId, event, payload);
    });
  }

  private async updateCurrentUsers() {
    const users = await this.currentUsers;
    this.emitAllUsers(
      'sessions:current_users',
      users.map((user) => ({
        ...user,
        context: this.sessionsService.getAllContextByUserId(user.id),
      })),
    );
  }

  private async updateCurrentUser(client: Socket, userId: number) {
    const user = await this.usersService.findOne(userId);
    client.emit('sessions:current_user', user);
  }

  emitReceptionProcessCreated(receptionProcess: ReceptionProcess): void {
    this.logger.debug(
      `Emitting reception process created event for process ${receptionProcess.id}`,
    );

    this.emitAllUsers('reception-process:created', receptionProcess);
  }

  /* @SubscribeMessage('sessions:new_user_connected')
  async handleNewUserConnected(): Promise<void> {
    const users = await this.currentUsers;
    this.emitAllUsers('sessions:users_connected', { users });
  } */
}
