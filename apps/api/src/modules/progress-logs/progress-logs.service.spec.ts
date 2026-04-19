import { BadRequestException } from '@nestjs/common';
import { TrackerType } from '@prisma/client';
import { ProgressLogsService } from './progress-logs.service';

describe('ProgressLogsService', () => {
  const baseTask = {
    id: 'task-1',
    userId: 'user-1',
    name: 'Read book',
    isCompleted: false,
    trackerType: TrackerType.NUMBER,
    trackerMetadata: { current: 20, total: 100 },
  };

  it('rejects timeSpentMinutes over 1440', async () => {
    const prisma = {
      progressLog: { create: jest.fn() },
      task: { findMany: jest.fn() },
    };
    const tasksService = {
      findById: jest.fn().mockResolvedValue(baseTask),
      makeSnapshot: jest.fn().mockReturnValue({ taskName: 'Read book', trackerType: TrackerType.NUMBER }),
      updateProgressAndCompletion: jest.fn(),
    };

    const service = new ProgressLogsService(prisma as never, tasksService as never);
    await expect(
      service.create('user-1', 'task-1', {
        timeSpentMinutes: 1441,
        loggedDateYmd: '2026-01-15',
        trackerMetadata: { current: 30, total: 100 },
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects decreasing progress updates', async () => {
    const prisma = {
      progressLog: { create: jest.fn() },
      task: { findMany: jest.fn() },
    };
    const tasksService = {
      findById: jest.fn().mockResolvedValue(baseTask),
      makeSnapshot: jest.fn().mockReturnValue({ taskName: 'Read book', trackerType: TrackerType.NUMBER }),
      updateProgressAndCompletion: jest.fn(),
    };

    const service = new ProgressLogsService(prisma as never, tasksService as never);
    await expect(
      service.create('user-1', 'task-1', {
        timeSpentMinutes: 10,
        loggedDateYmd: '2026-01-15',
        trackerMetadata: { current: 10, total: 100 },
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('marks task completed when goal is met', async () => {
    const prisma = {
      progressLog: { create: jest.fn().mockResolvedValue({ id: 'log-1' }) },
      task: { findMany: jest.fn() },
    };
    const tasksService = {
      findById: jest.fn().mockResolvedValue(baseTask),
      makeSnapshot: jest.fn().mockReturnValue({ taskName: 'Read book', trackerType: TrackerType.NUMBER }),
      updateProgressAndCompletion: jest.fn().mockResolvedValue(undefined),
    };

    const service = new ProgressLogsService(prisma as never, tasksService as never);
    await service.create('user-1', 'task-1', {
      timeSpentMinutes: 30,
      loggedDateYmd: '2026-01-15',
      trackerMetadata: { current: 100, total: 100 },
    });

    expect(tasksService.updateProgressAndCompletion).toHaveBeenCalledWith(
      'task-1',
      { current: 100, total: 100 },
      true,
    );
  });

  it('allows local calendar today when UTC date is still yesterday (ahead-of-UTC timezone)', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-04-19T22:00:00.000Z'));
    const prisma = {
      progressLog: { create: jest.fn().mockResolvedValue({ id: 'log-1' }) },
      task: { findMany: jest.fn() },
    };
    const tasksService = {
      findById: jest.fn().mockResolvedValue(baseTask),
      makeSnapshot: jest.fn().mockReturnValue({
        taskName: 'Read book',
        trackerType: TrackerType.NUMBER,
        trackerMetadata: {},
      }),
      updateProgressAndCompletion: jest.fn().mockResolvedValue(undefined),
    };

    const service = new ProgressLogsService(prisma as never, tasksService as never);
    await service.create('user-1', 'task-1', {
      timeSpentMinutes: 30,
      loggedDateYmd: '2026-04-20',
      trackerMetadata: { current: 30, total: 100 },
      clientTimezoneOffsetMinutes: -180,
    });

    expect(prisma.progressLog.create).toHaveBeenCalled();
    jest.useRealTimers();
  });

  it('still rejects a date after local today when client timezone offset is sent', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-04-19T22:00:00.000Z'));
    const prisma = { progressLog: { create: jest.fn() }, task: { findMany: jest.fn() } };
    const tasksService = {
      findById: jest.fn().mockResolvedValue(baseTask),
      makeSnapshot: jest.fn(),
      updateProgressAndCompletion: jest.fn(),
    };

    const service = new ProgressLogsService(prisma as never, tasksService as never);
    await expect(
      service.create('user-1', 'task-1', {
        timeSpentMinutes: 30,
        loggedDateYmd: '2026-04-21',
        trackerMetadata: { current: 30, total: 100 },
        clientTimezoneOffsetMinutes: -180,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    jest.useRealTimers();
  });

  it('recalculateTaskFromLogs applies last log metadata', async () => {
    const prisma = {
      task: {
        findFirst: jest.fn().mockResolvedValue(baseTask),
      },
      progressLog: {
        findMany: jest.fn().mockResolvedValue([
          { id: '1', appliedTrackerMetadata: { current: 10, total: 100 } },
          { id: '2', appliedTrackerMetadata: { current: 25, total: 100 } },
        ]),
      },
    };
    const tasksService = {
      updateProgressAndCompletion: jest.fn().mockResolvedValue(undefined),
    };

    const service = new ProgressLogsService(prisma as never, tasksService as never);
    await service.recalculateTaskFromLogs('user-1', 'task-1');

    expect(tasksService.updateProgressAndCompletion).toHaveBeenCalledWith(
      'task-1',
      { current: 25, total: 100 },
      false,
      prisma,
    );
  });

  it('recalculateTaskFromLogs resets task when no logs remain', async () => {
    const task = {
      ...baseTask,
      trackerMetadata: { current: 40, total: 100 },
    };
    const prisma = {
      task: {
        findFirst: jest.fn().mockResolvedValue(task),
      },
      progressLog: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    const tasksService = {
      updateProgressAndCompletion: jest.fn().mockResolvedValue(undefined),
    };

    const service = new ProgressLogsService(prisma as never, tasksService as never);
    await service.recalculateTaskFromLogs('user-1', 'task-1');

    expect(tasksService.updateProgressAndCompletion).toHaveBeenCalledWith(
      'task-1',
      { current: 0, total: 100 },
      false,
      prisma,
    );
  });

  it('deleteLog removes log, replays task, and hard-deletes empty hidden leaf', async () => {
    const tx = {
      progressLog: {
        delete: jest.fn().mockResolvedValue({}),
        count: jest.fn().mockResolvedValue(0),
        findMany: jest.fn().mockResolvedValue([]),
      },
      task: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'task-1',
          userId: 'user-1',
          trackerType: TrackerType.NUMBER,
          trackerMetadata: { current: 5, total: 100 },
          isHidden: true,
          _count: { children: 0 },
        }),
        delete: jest.fn().mockResolvedValue({}),
      },
    };
    const prisma = {
      progressLog: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'log-1',
          taskId: 'task-1',
          userId: 'user-1',
        }),
      },
      $transaction: jest.fn(async (fn: (arg: typeof tx) => Promise<void>) => fn(tx)),
    };
    const tasksService = {
      updateProgressAndCompletion: jest.fn().mockResolvedValue(undefined),
    };

    const service = new ProgressLogsService(prisma as never, tasksService as never);
    await service.deleteLog('user-1', 'task-1', 'log-1');

    expect(tx.progressLog.delete).toHaveBeenCalledWith({ where: { id: 'log-1' } });
    expect(tasksService.updateProgressAndCompletion).toHaveBeenCalled();
    expect(tx.task.delete).toHaveBeenCalledWith({ where: { id: 'task-1' } });
  });

  it('deleteLog does not delete task when logs remain', async () => {
    const tx = {
      progressLog: {
        delete: jest.fn().mockResolvedValue({}),
        count: jest.fn().mockResolvedValue(1),
        findMany: jest.fn().mockResolvedValue([
          { id: 'log-2', appliedTrackerMetadata: { current: 10, total: 100 } },
        ]),
      },
      task: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'task-1',
          userId: 'user-1',
          trackerType: TrackerType.NUMBER,
          trackerMetadata: { current: 5, total: 100 },
        }),
        delete: jest.fn(),
      },
    };
    const prisma = {
      progressLog: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'log-1',
          taskId: 'task-1',
          userId: 'user-1',
        }),
      },
      $transaction: jest.fn(async (fn: (arg: typeof tx) => Promise<void>) => fn(tx)),
    };
    const tasksService = {
      updateProgressAndCompletion: jest.fn().mockResolvedValue(undefined),
    };

    const service = new ProgressLogsService(prisma as never, tasksService as never);
    await service.deleteLog('user-1', 'task-1', 'log-1');

    expect(tx.task.delete).not.toHaveBeenCalled();
  });
});
