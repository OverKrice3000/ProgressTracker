import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma, ProgressLog, Task, TrackerType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TasksService } from '../tasks/tasks.service';
import { CreateProgressLogDto } from './dto/create-progress-log.dto';
import { UpdateProgressLogDto } from './dto/update-progress-log.dto';

export interface ProgressLogListItemDto {
  id: string;
  taskId: string;
  taskName: string;
  loggedDateYmd: string;
  timeSpentMinutes: number;
  trackerType: TrackerType;
  appliedTrackerMetadata: Record<string, unknown> | null;
  createdAt: string;
}

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

    this.assertLoggedDateNotFuture(dto.loggedDateYmd, dto.clientTimezoneOffsetMinutes);

    if (dto.dayStartIso && dto.dayEndIso) {
      const { totalMinutes } = await this.getDailyTotalForRange(
        userId,
        dto.dayStartIso,
        dto.dayEndIso,
        undefined,
        dto.loggedDateYmd,
      );
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

    const loggedDate = this.ymdToPrismaDate(dto.loggedDateYmd);

    const log = await this.prisma.progressLog.create({
      data: {
        taskId,
        userId,
        loggedDate,
        appliedTrackerMetadata: dto.trackerMetadata as Prisma.InputJsonValue,
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

  async listForUser(userId: string): Promise<ProgressLogListItemDto[]> {
    const logs = await this.prisma.progressLog.findMany({
      where: {
        userId,
        task: { trackerType: { not: TrackerType.SUBTASK } },
      },
      orderBy: [{ loggedDate: 'desc' }, { createdAt: 'desc' }],
      include: {
        task: { select: { name: true, trackerType: true } },
      },
    });

    return logs.map((log) => ({
      id: log.id,
      taskId: log.taskId,
      taskName: log.task.name,
      loggedDateYmd: this.prismaDateToYmd(log.loggedDate),
      timeSpentMinutes: log.timeSpentMinutes,
      trackerType: log.task.trackerType,
      appliedTrackerMetadata: log.appliedTrackerMetadata as Record<string, unknown> | null,
      createdAt: log.createdAt.toISOString(),
    }));
  }

  async updateLog(userId: string, taskId: string, logId: string, dto: UpdateProgressLogDto) {
    const log = await this.prisma.progressLog.findFirst({
      where: { id: logId, taskId, userId },
      include: { task: true },
    });
    if (!log) {
      throw new NotFoundException('Progress log not found');
    }

    const task = log.task;
    const nextTime =
      dto.timeSpentMinutes !== undefined ? dto.timeSpentMinutes : log.timeSpentMinutes;
    if (nextTime > 1440) {
      throw new BadRequestException('timeSpentMinutes cannot exceed 1440');
    }

    const nextYmd =
      dto.loggedDateYmd !== undefined ? dto.loggedDateYmd : this.prismaDateToYmd(log.loggedDate);
    this.assertLoggedDateNotFuture(nextYmd, dto.clientTimezoneOffsetMinutes);

    const nextMetadata = (dto.trackerMetadata ??
      (log.appliedTrackerMetadata as Record<string, unknown> | null)) as Record<string, unknown>;
    if (!nextMetadata || typeof nextMetadata !== 'object') {
      throw new BadRequestException('trackerMetadata is required');
    }

    const ordered = await this.loadOrderedLogs(taskId);
    const idx = ordered.findIndex((l) => l.id === logId);
    if (idx < 0) {
      throw new NotFoundException('Progress log not found');
    }

    const preMetadata = this.metadataBeforeLogInChain(ordered, idx);
    this.assertIncremental(task.trackerType, preMetadata as Prisma.JsonValue, nextMetadata);

    const { totalMinutes } = await this.getDailyTotalForRange(
      userId,
      '2000-01-01T00:00:00.000Z',
      '2000-01-02T00:00:00.000Z',
      logId,
      nextYmd,
    );
    if (totalMinutes + nextTime > 1440) {
      throw new BadRequestException('Total time for this day cannot exceed 24 hours.');
    }

    const isCompleted = await this.isCompletedAfterUpdate(
      userId,
      taskId,
      task.trackerType,
      nextMetadata,
    );

    await this.prisma.progressLog.update({
      where: { id: logId },
      data: {
        loggedDate: this.ymdToPrismaDate(nextYmd),
        timeSpentMinutes: nextTime,
        appliedTrackerMetadata: nextMetadata as Prisma.InputJsonValue,
        ...(dto.timestamp ? { timestamp: new Date(dto.timestamp) } : {}),
      },
    });

    await this.recalculateTaskFromLogs(userId, taskId);
    return this.prisma.progressLog.findFirstOrThrow({ where: { id: logId } });
  }

  async deleteLog(userId: string, taskId: string, logId: string): Promise<void> {
    const log = await this.prisma.progressLog.findFirst({
      where: { id: logId, taskId, userId },
    });
    if (!log) {
      throw new NotFoundException('Progress log not found');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.progressLog.delete({ where: { id: logId } });
      await this.recalculateTaskFromLogsWithDb(tx, userId, taskId);
      await this.maybeDeleteEmptyArchivedTask(tx, userId, taskId);
    });
  }

  /** Replays remaining logs and updates task tracker metadata + completion. */
  async recalculateTaskFromLogs(userId: string, taskId: string): Promise<void> {
    await this.recalculateTaskFromLogsWithDb(this.prisma, userId, taskId);
  }

  private async recalculateTaskFromLogsWithDb(
    db: PrismaService | Prisma.TransactionClient,
    userId: string,
    taskId: string,
  ): Promise<void> {
    const task = await db.task.findFirst({ where: { id: taskId, userId } });
    if (!task) {
      throw new NotFoundException('Task not found');
    }

    const logs = await this.loadOrderedLogsWithDb(db, taskId);
    if (logs.length === 0) {
      const meta = this.defaultMetadataAfterAllLogsRemoved(task);
      const isCompleted = await this.isCompletedAfterUpdate(
        userId,
        taskId,
        task.trackerType,
        meta,
      );
      await this.tasksService.updateProgressAndCompletion(
        taskId,
        meta as Prisma.InputJsonValue,
        isCompleted,
        db,
      );
      return;
    }

    for (const lg of logs) {
      if (lg.appliedTrackerMetadata == null) {
        throw new UnprocessableEntityException(
          'A progress log is missing applied metadata; cannot replay. Re-save or backfill logs.',
        );
      }
    }

    const last = logs[logs.length - 1]!;
    const finalMeta = last.appliedTrackerMetadata as Record<string, unknown>;
    const isCompleted = await this.isCompletedAfterUpdate(
      userId,
      taskId,
      task.trackerType,
      finalMeta,
    );
    await this.tasksService.updateProgressAndCompletion(
      taskId,
      finalMeta as Prisma.InputJsonValue,
      isCompleted,
      db,
    );
  }

  private async maybeDeleteEmptyArchivedTask(
    db: PrismaService | Prisma.TransactionClient,
    userId: string,
    taskId: string,
  ): Promise<void> {
    const remaining = await db.progressLog.count({ where: { taskId } });
    if (remaining > 0) {
      return;
    }
    const task = await db.task.findFirst({
      where: { id: taskId, userId },
      include: { _count: { select: { children: true } } },
    });
    if (!task || !task.isHidden || task._count.children > 0) {
      return;
    }
    await db.task.delete({ where: { id: taskId } });
  }

  private async loadOrderedLogs(taskId: string): Promise<ProgressLog[]> {
    return this.loadOrderedLogsWithDb(this.prisma, taskId);
  }

  private async loadOrderedLogsWithDb(
    db: PrismaService | Prisma.TransactionClient,
    taskId: string,
  ): Promise<ProgressLog[]> {
    return db.progressLog.findMany({
      where: { taskId },
      orderBy: [{ loggedDate: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
    });
  }

  private metadataBeforeLogInChain(ordered: ProgressLog[], index: number): Record<string, unknown> {
    if (index === 0) {
      return this.snapshotPreMetadata(ordered[0]!.snapshot);
    }
    const prev = ordered[index - 1]!;
    if (prev.appliedTrackerMetadata == null) {
      throw new UnprocessableEntityException(
        'A progress log is missing applied metadata; cannot validate edit.',
      );
    }
    return prev.appliedTrackerMetadata as Record<string, unknown>;
  }

  private snapshotPreMetadata(snapshot: Prisma.JsonValue): Record<string, unknown> {
    const s = snapshot as { trackerMetadata?: Record<string, unknown> };
    if (!s?.trackerMetadata || typeof s.trackerMetadata !== 'object') {
      throw new BadRequestException('Invalid progress log snapshot');
    }
    return s.trackerMetadata as Record<string, unknown>;
  }

  private defaultMetadataAfterAllLogsRemoved(task: Task): Record<string, unknown> {
    const m = task.trackerMetadata as Record<string, unknown>;
    switch (task.trackerType) {
      case TrackerType.BOOLEAN:
        return { ...m, current: false };
      case TrackerType.NUMBER:
        return { ...m, current: 0 };
      case TrackerType.TIME:
        return { ...m, currentMinutes: 0 };
      default:
        return { ...m };
    }
  }

  /**
   * `loggedDateYmd` is the user's local calendar day. Without `clientTimezoneOffsetMinutes`, we only know
   * UTC "today", which wrongly rejects local-today near midnight in timezones ahead of UTC.
   */
  private assertLoggedDateNotFuture(ymd: string, clientTimezoneOffsetMinutes?: number): void {
    const todayYmd = this.getTodayYmdForClient(clientTimezoneOffsetMinutes);
    if (ymd > todayYmd) {
      throw new BadRequestException('Cannot log progress for a future date.');
    }
  }

  /** YYYY-MM-DD for the user's local calendar day (`getTimezoneOffset` per ECMAScript). */
  private getTodayYmdForClient(clientTimezoneOffsetMinutes?: number): string {
    if (clientTimezoneOffsetMinutes === undefined || clientTimezoneOffsetMinutes === null) {
      const now = new Date();
      const y = now.getUTCFullYear();
      const mo = String(now.getUTCMonth() + 1).padStart(2, '0');
      const day = String(now.getUTCDate()).padStart(2, '0');
      return `${y}-${mo}-${day}`;
    }
    const shifted = new Date(Date.now() - clientTimezoneOffsetMinutes * 60 * 1000);
    const y = shifted.getUTCFullYear();
    const mo = String(shifted.getUTCMonth() + 1).padStart(2, '0');
    const day = String(shifted.getUTCDate()).padStart(2, '0');
    return `${y}-${mo}-${day}`;
  }

  /** Store as PostgreSQL DATE via Prisma (UTC calendar day). */
  private ymdToPrismaDate(ymd: string): Date {
    const [y, mo, d] = ymd.split('-').map(Number);
    return new Date(Date.UTC(y, mo - 1, d, 12, 0, 0, 0));
  }

  private prismaDateToYmd(d: Date): string {
    const y = d.getUTCFullYear();
    const mo = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    return `${y}-${mo}-${day}`;
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

  /** Sum of time_spent_minutes for logs on the given calendar day, optionally excluding one log (edit flow). */
  async getDailyTotalForRange(
    userId: string,
    dayStartIso: string,
    dayEndIso: string,
    excludeLogId?: string,
    dateYmd?: string,
  ): Promise<{ totalMinutes: number }> {
    const dayStart = new Date(dayStartIso);
    const dayEnd = new Date(dayEndIso);
    if (Number.isNaN(dayStart.getTime()) || Number.isNaN(dayEnd.getTime()) || dayEnd <= dayStart) {
      throw new BadRequestException('Invalid day bounds');
    }

    if (dateYmd) {
      const loggedDate = this.ymdToPrismaDate(dateYmd);
      const agg = await this.prisma.progressLog.aggregate({
        where: {
          userId,
          loggedDate,
          ...(excludeLogId ? { id: { not: excludeLogId } } : {}),
        },
        _sum: { timeSpentMinutes: true },
      });
      return { totalMinutes: agg._sum.timeSpentMinutes ?? 0 };
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
