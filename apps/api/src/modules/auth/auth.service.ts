import { Injectable, UnauthorizedException } from '@nestjs/common';
import { User } from '@prisma/client';
import { compare, hash } from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { SessionStore } from './session.store';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sessions: SessionStore,
  ) {}

  async validateUser(username: string, password: string): Promise<User> {
    const user = await this.prisma.user.findUnique({
      where: { username },
    });
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const ok = await compare(password, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException('Invalid credentials');
    }
    return user;
  }

  createSession(userId: string): string {
    return this.sessions.create(userId);
  }

  getUserIdBySession(sessionToken: string | undefined): string | null {
    return this.sessions.getUserId(sessionToken);
  }

  destroySession(sessionToken: string | undefined): void {
    this.sessions.destroy(sessionToken);
  }

  async ensureDemoUser(): Promise<void> {
    const username = 'demo';
    const existing = await this.prisma.user.findUnique({
      where: { username },
    });
    if (existing) {
      return;
    }

    const passwordHash = await hash('password123', 10);
    await this.prisma.user.create({
      data: {
        username,
        passwordHash,
      },
    });
  }

  async getProfile(userId: string): Promise<{ userId: string; username: string }> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { id: true, username: true },
    });
    return {
      userId: user.id,
      username: user.username,
    };
  }
}
