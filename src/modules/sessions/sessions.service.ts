import { Injectable } from '@nestjs/common';

import { Socket } from 'socket.io';

export interface SessionMetadata {
  ip?: string;
  userAgent?: string;
  deviceContext?: string;
}

export interface SessionSnapshot {
  socketId: string;
  connectedAt: Date;
  metadata: SessionMetadata;
}

interface SessionRecord extends SessionSnapshot {
  socket: Socket;
}

@Injectable()
export class SessionsService {
  // Map<UserId, Map<SocketId, SessionRecord>> to keep every active connection per user
  private readonly sessions = new Map<number, Map<string, SessionRecord>>();

  register(
    userId: number,
    socket: Socket,
    metadata: SessionMetadata = {},
  ): SessionSnapshot[] {
    const userSessions = (this.sessions.get(userId) ?? new Map()) as Map<
      string,
      SessionRecord
    >;

    userSessions.set(socket.id, {
      socket,
      socketId: socket.id,
      connectedAt: new Date(),
      metadata,
    });

    this.sessions.set(userId, userSessions);

    return this.toSnapshot(userSessions);
  }

  unregister(userId: number, socketId: string): SessionSnapshot[] {
    const userSessions = this.sessions.get(userId);

    if (!userSessions) {
      return [];
    }

    userSessions.delete(socketId);

    if (!userSessions.size) {
      this.sessions.delete(userId);
      return [];
    }

    return this.toSnapshot(userSessions);
  }

  getSnapshot(userId: number): SessionSnapshot[] {
    const userSessions = this.sessions.get(userId);

    if (!userSessions) {
      return [];
    }

    return this.toSnapshot(userSessions);
  }

  emitToUser<T>(userId: number, event: string, payload: T): number {
    const userSessions = this.sessions.get(userId);

    if (!userSessions) {
      return 0;
    }

    userSessions.forEach(({ socket }) => socket.emit(event, payload));

    return userSessions.size;
  }

  getAllUserIds(): number[] {
    return Array.from(this.sessions.keys());
  }

  getAllContextByUserId(userId: number): string[] {
    const userSessions = this.sessions.get(userId);
    if (!userSessions) {
      return [];
    }

    const contextCounts = new Map<string, number>();
    Array.from(userSessions.values()).forEach(({ metadata }) => {
      const context = metadata.deviceContext || '';
      if (context) {
        contextCounts.set(context, (contextCounts.get(context) ?? 0) + 1);
      }
    });

    return Array.from(contextCounts.entries()).map(
      ([context, count]) => `${count} ${context}`,
    );
  }

  private toSnapshot(
    userSessions: Map<string, SessionRecord>,
  ): SessionSnapshot[] {
    return Array.from(userSessions.values()).map(
      ({ socketId, connectedAt, metadata }) => ({
        socketId,
        connectedAt,
        metadata,
      }),
    );
  }
}
