import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';

interface SessionRecord {
  userId: string;
  createdAt: number;
}

@Injectable()
export class SessionStore {
  private readonly sessions = new Map<string, SessionRecord>();

  create(userId: string): string {
    const token = randomUUID();
    this.sessions.set(token, { userId, createdAt: Date.now() });
    return token;
  }

  getUserId(token: string | undefined): string | null {
    if (!token) {
      return null;
    }
    return this.sessions.get(token)?.userId ?? null;
  }

  destroy(token: string | undefined): void {
    if (!token) {
      return;
    }
    this.sessions.delete(token);
  }
}
