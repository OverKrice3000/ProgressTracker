import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma, TrackerType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TasksService } from '../tasks/tasks.service';
import { CreateProgressLogDto } from './dto/create-progress-log.dto';

@Injectable()
export class ProgressLogsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tasksService: TasksService,
  ) {}

  async create(userId: string, taskId: string, dto: CreateProgressLogDto) {
    if (dto.timeSpentMinutes > 1440) {
      throw new BadRequestException('timeSpentMinutes cannot exceed 1440');
    }

    const { dayStartIso, dayEndIso } = dto;
    if (dayStartIso && dayEndIso) {
      const { totalMinutes } = await this.getDailyTotalForRange(userId, dayStartIso, dayEndIso);
      if (totalMinutes + dto.timeSpentMinutes > 1440) {
        throw new BadRequestException('Total time for this day cannot exceed 24 hours.');
      }
    }

    const task = await this.tasksService.findById(userId, taskId);
    if (task.isHidden) {
      throw new BadRequestException('Archived task is locked for logging');
    }
    if (task.isCompleted) {
      throw new BadRequestException('Completed task is locked for logging');
    }

    this.assertIncremental(task.trackerType, task.trackerMetadata, dto.trackerMetadata);

    const isCompleted = await this.isCompletedAfterUpdate(
      userId,
      taskId,
      task.trackerType,
      dto.trackerMetadata,
    );

    const log = await this.prisma.progressLog.create({
      data: {
        taskId,
        userId,
        timestamp: dto.timestamp ? new Date(dto.timestamp) : new Date(),
        timeSpentMinutes: dto.timeSpentMinutes,
        snapshot: this.tasksService.makeSnapshot(task) as unknown as Prisma.InputJsonValue,
      },
    });

    await this.tasksService.updateProgressAndCompletion(
      taskId,
      dto.trackerMetadata as Prisma.InputJsonValue,
      isCompleted,
    );

    return log;
  }

  private assertIncremental(
    trackerType: TrackerType,
    currentMetadata: Prisma.JsonValue,
    nextMetadata: Record<string, unknown>,
  ): void {
    const current = currentMetadata as Record<string, unknown>;

    if (trackerType === TrackerType.BOOLEAN) {
      if (current.current === true && nextMetadata.current !== true) {
        throw new BadRequestException('Boolean tracker cannot decrease');
      }
      return;
    }

    if (trackerType === TrackerType.NUMBER) {
      const prev = Number(current.current ?? 0);
      const next = Number(nextMetadata.current ?? 0);
      if (next < prev) {
        throw new BadRequestException('Number tracker must be strictly incremental');
      }
      return;
    }

    if (trackerType === TrackerType.TIME) {
      const prev = Number(current.currentMinutes ?? 0);
      const next = Number(nextMetadata.currentMinutes ?? 0);
      if (next < prev) {
        throw new BadRequestException('Time tracker must be strictly incremental');
      }
      return;
    }
  }

  private async isCompletedAfterUpdate(
    userId: string,
    taskId: string,
    trackerType: TrackerType,
    nextMetadata: Record<string, unknown>,
  ): Promise<boolean> {
    if (trackerType === TrackerType.BOOLEAN) {
      return Boolean(nextMetadata.current) && Boolean(nextMetadata.total);
    }
    if (trackerType === TrackerType.NUMBER) {
      return Number(nextMetadata.current ?? 0) >= Number(nextMetadata.total ?? 1);
    }
    if (trackerType === TrackerType.TIME) {
      return Number(nextMetadata.currentMinutes ?? 0) >= Number(nextMetadata.totalMinutes ?? 1);
    }
    if (trackerType === TrackerType.SUBTASK) {
      const children = await this.prisma.task.findMany({
        where: { userId, parentId: taskId },
        select: { isCompleted: true },
      });
      return children.length > 0 && children.every((child) => child.isCompleted);
    }
    return false;
  }

  /** Sum of time_spent_minutes for all logs in [dayStart, dayEnd), optionally excluding one log (edit flow). */
  async getDailyTotalForRange(
    userId: string,
    dayStartIso: string,
    dayEndIso: string,
    excludeLogId?: string,
  ): Promise<{ totalMinutes: number }> {
    const dayStart = new Date(dayStartIso);
    const dayEnd = new Date(dayEndIso);
    if (Number.isNaN(dayStart.getTime()) || Number.isNaN(dayEnd.getTime()) || dayEnd <= dayStart) {
      throw new BadRequestException('Invalid day bounds');
    }
    const agg = await this.prisma.progressLog.aggregate({
      where: {
        userId,
        timestamp: { gte: dayStart, lt: dayEnd },
        ...(excludeLogId ? { id: { not: excludeLogId } } : {}),
      },
      _sum: { timeSpentMinutes: true },
    });
    return { totalMinutes: agg._sum.timeSpentMinutes ?? 0 };
  }
}
