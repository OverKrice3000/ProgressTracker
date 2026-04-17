import { BadRequestException } from '@nestjs/common';
import { TrackerType } from '@prisma/client';
import { TasksService } from './tasks.service';

describe('TasksService', () => {
  it('rejects parent task when parent is not SUBTASK type', async () => {
    const prisma = {
      task: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'parent-1',
          userId: 'user-1',
          depth: 1,
          trackerType: TrackerType.NUMBER,
        }),
        create: jest.fn(),
      },
    };

    const service = new TasksService(prisma as never);

    await expect(
      service.create('user-1', {
        parentId: 'parent-1',
        name: 'child task',
        trackerType: TrackerType.TIME,
        trackerMetadata: { currentMinutes: 0, totalMinutes: 120 },
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('computes child depth from parent context', async () => {
    const prisma = {
      task: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'parent-1',
          userId: 'user-1',
          depth: 2,
          trackerType: TrackerType.SUBTASK,
        }),
        create: jest.fn().mockResolvedValue({ id: 'child-1', depth: 3 }),
      },
    };

    const service = new TasksService(prisma as never);
    await service.create('user-1', {
      parentId: 'parent-1',
      name: 'child task',
      trackerType: TrackerType.NUMBER,
      trackerMetadata: { current: 0, total: 100 },
    });

    expect(prisma.task.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          depth: 3,
        }),
      }),
    );
  });
});
