import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StatsQueryDto } from './dto/stats-query.dto';

@Injectable()
export class StatsService {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary(userId: string, query: StatsQueryDto) {
    const from = this.startOfLocalDay(query.from);
    const toExclusive = this.startOfLocalDay(query.to);
    toExclusive.setDate(toExclusive.getDate() + 1);
    /** Idle allowance per calendar day in range (e.g. sleep); total = per-day × number of days. */
    const idleMinutesPerDay = (query.idleHours ?? 0) * 60;

    const logs = await this.prisma.progressLog.findMany({
      where: {
        userId,
        timestamp: {
          gte: from,
          lt: toExclusive,
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
      Math.ceil((toExclusive.getTime() - from.getTime()) / (1000 * 60 * 60 * 24)),
    );
    const idleMinutes = idleMinutesPerDay * days;
    const availableMinutes = days * 24 * 60;
    const untrackedMinutes = Math.max(0, availableMinutes - totalLoggedMinutes - idleMinutes);

    return {
      range: { from, to: new Date(toExclusive.getTime() - 1), days },
      totals: {
        loggedMinutes: totalLoggedMinutes,
        idleMinutes,
        untrackedMinutes,
      },
      byTask: Array.from(byTask.values()).sort((a, b) => b.minutes - a.minutes),
      logs,
    };
  }

  private startOfLocalDay(value: string): Date {
    const [year, month, day] = value.split('-').map((part) => Number(part));
    return new Date(year, month - 1, day, 0, 0, 0, 0);
  }
}
