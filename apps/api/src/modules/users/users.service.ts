import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateUserSettingsDto } from './dto/update-user-settings.dto';

export interface UserSettingsDto {
  idleHoursPerDay: number;
  language: string;
}

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async getById(userId: string): Promise<{ id: string; username: string }> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { id: true, username: true },
    });
    return user;
  }

  async getSettings(userId: string): Promise<UserSettingsDto> {
    const existing = await this.prisma.userSettings.findUnique({
      where: { userId },
    });
    if (existing) {
      return { idleHoursPerDay: existing.idleHoursPerDay, language: existing.language };
    }
    return { idleHoursPerDay: 0, language: 'en' };
  }

  async updateSettings(userId: string, dto: UpdateUserSettingsDto): Promise<UserSettingsDto> {
    const result = await this.prisma.userSettings.upsert({
      where: { userId },
      create: {
        userId,
        idleHoursPerDay: dto.idleHoursPerDay ?? 0,
        language: dto.language ?? 'en',
      },
      update: {
        ...(dto.idleHoursPerDay !== undefined && { idleHoursPerDay: dto.idleHoursPerDay }),
        ...(dto.language !== undefined && { language: dto.language }),
      },
    });
    return { idleHoursPerDay: result.idleHoursPerDay, language: result.language };
  }
}
