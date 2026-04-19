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
});
