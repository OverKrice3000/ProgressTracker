import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StatsQueryDto } from './dto/stats-query.dto';

@Injectable()
export class StatsService {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary(userId: string, query: StatsQueryDto) {
    const from = new Date(query.from);
    const to = new Date(query.to);
    const idleMinutes = (query.idleHours ?? 0) * 60;

    const logs = await this.prisma.progressLog.findMany({
      where: {
        userId,
        timestamp: {
          gte: from,
          lte: to,
        },
      },
      include: {
        task: {
          select: { id: true, name: true, parentId: true, depth: true },
        },
      },
    });

    const totalLoggedMinutes = logs.reduce((acc, log) => acc + log.timeSpentMinutes, 0);
    const byTask = new Map<string, { taskId: string; taskName: string; minutes: number }>();
    logs.forEach((log) => {
      const row = byTask.get(log.taskId) ?? {
        taskId: log.taskId,
        taskName: log.task.name,
        minutes: 0,
      };
      row.minutes += log.timeSpentMinutes;
      byTask.set(log.taskId, row);
    });

    const days = Math.max(
      1,
      Math.ceil((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24)) + 1,
    );
    const availableMinutes = days * 24 * 60;
    const untrackedMinutes = Math.max(0, availableMinutes - totalLoggedMinutes - idleMinutes);

    return {
      range: { from, to, days },
      totals: {
        loggedMinutes: totalLoggedMinutes,
        idleMinutes,
        untrackedMinutes,
      },
      byTask: Array.from(byTask.values()).sort((a, b) => b.minutes - a.minutes),
      logs,
    };
  }
}
