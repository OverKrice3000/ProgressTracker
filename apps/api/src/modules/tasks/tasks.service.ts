import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Prisma, Task, TrackerType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { TaskQueryDto } from './dto/task-query.dto';
import { UpdateTaskDto } from './dto/update-task.dto';

export interface TaskTreeNode extends Task {
  children: TaskTreeNode[];
}

export interface CurrentTrackingSessionDto {
  taskId: string;
  taskName: string;
  startTimeMs: number;
}

@Injectable()
export class TasksService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateTaskDto): Promise<Task> {
    const parent = dto.parentId
      ? await this.prisma.task.findFirst({
          where: { id: dto.parentId, userId },
        })
      : null;

    if (dto.parentId && !parent) {
      throw new NotFoundException('Parent task not found');
    }
    if (parent && parent.trackerType !== TrackerType.SUBTASK) {
      throw new BadRequestException('Only SUBTASK tracker can be parent');
    }

    const depth = parent ? parent.depth + 1 : 0;
    return this.prisma.task.create({
      data: {
        userId,
        parentId: parent?.id,
        depth,
        name: dto.name,
        description: dto.description,
        avatarUrl: dto.avatarUrl,
        isCompleted: dto.isCompleted ?? false,
        trackerType: dto.trackerType,
        trackerMetadata: dto.trackerMetadata as Prisma.InputJsonValue,
      },
    });
  }

  async findMany(userId: string, query: TaskQueryDto): Promise<Task[]> {
    const where: Prisma.TaskWhereInput = { userId };
    if (query.includeHidden !== 'true') {
      where.isHidden = false;
    }
    if (query.rootOnly === 'true') {
      where.parentId = null;
    }
    if (query.isCompleted === 'true') {
      where.isCompleted = true;
    }
    if (query.isCompleted === 'false') {
      where.isCompleted = false;
    }
    if (query.trackerType) {
      where.trackerType = query.trackerType;
    }

    const rawSort = query.sortBy ?? 'name';
    const orderField = rawSort === 'recent' ? 'name' : rawSort;
    const sortOrder = query.sortOrder ?? 'asc';
    return this.prisma.task.findMany({
      where,
      orderBy: {
        [orderField]: sortOrder,
      },
    });
  }

  async findRecentLeafTasks(
    userId: string,
    query: TaskQueryDto,
  ): Promise<(Task & { lastTrackedAt: string })[]> {
    const where: Prisma.TaskWhereInput = {
      userId,
      ...(query.includeHidden === 'true' ? {} : { isHidden: false }),
      children: { none: {} },
      progressLogs: { some: {} },
    };
    if (query.isCompleted === 'true') {
      where.isCompleted = true;
    }
    if (query.isCompleted === 'false') {
      where.isCompleted = false;
    }
    if (query.trackerType) {
      where.trackerType = query.trackerType;
    }

    const tasks = await this.prisma.task.findMany({
      where,
      include: {
        progressLogs: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { timestamp: true },
        },
      },
    });

    return tasks.map((t) => {
      const { progressLogs, ...rest } = t;
      const latest = progressLogs[0]?.timestamp;
      if (!latest) {
        return { ...rest, lastTrackedAt: t.updatedAt.toISOString() };
      }
      return { ...rest, lastTrackedAt: latest.toISOString() };
    });
  }

  async findById(userId: string, taskId: string): Promise<Task> {
    const task = await this.prisma.task.findFirst({
      where: { id: taskId, userId },
    });
    if (!task) {
      throw new NotFoundException('Task not found');
    }
    return task;
  }

  async update(userId: string, taskId: string, dto: UpdateTaskDto): Promise<Task> {
    const task = await this.findById(userId, taskId);
    const data: Prisma.TaskUpdateInput = {};
    if (dto.name !== undefined) {
      data.name = dto.name;
    }
    if (dto.description !== undefined) {
      data.description = dto.description;
    }
    if (dto.trackerMetadata !== undefined) {
      const targetUpdate = this.mergeTrackerTargetUpdate(task, dto.trackerMetadata);
      data.trackerMetadata = targetUpdate.metadata;
      if (targetUpdate.isCompleted !== undefined) {
        data.isCompleted = targetUpdate.isCompleted;
      }
    }
    if (Object.keys(data).length === 0) {
      return task;
    }
    return this.prisma.task.update({
      where: { id: task.id },
      data,
    });
  }

  private mergeTrackerTargetUpdate(
    task: Task,
    partial: Record<string, unknown>,
  ): { metadata: Prisma.InputJsonValue; isCompleted?: boolean } {
    if (task.trackerType === TrackerType.NUMBER) {
      const meta = task.trackerMetadata as { current?: unknown; total?: unknown };
      const current = Math.max(0, Math.floor(Number(meta.current ?? 0)));
      if (partial['total'] === undefined) {
        throw new BadRequestException('Missing total for counter target update.');
      }
      const newTotal = Math.floor(Number(partial['total']));
      if (!Number.isFinite(newTotal) || newTotal < 1) {
        throw new BadRequestException('Invalid target.');
      }
      if (newTotal < current) {
        throw new BadRequestException('Target cannot be lower than current progress.');
      }
      const next = { ...meta, total: newTotal };
      return {
        metadata: next as Prisma.InputJsonValue,
        isCompleted: current >= newTotal,
      };
    }
    if (task.trackerType === TrackerType.TIME) {
      const meta = task.trackerMetadata as { currentMinutes?: unknown; totalMinutes?: unknown };
      const currentMin = Math.max(0, Math.floor(Number(meta.currentMinutes ?? 0)));
      if (partial['totalMinutes'] === undefined) {
        throw new BadRequestException('Missing totalMinutes for duration target update.');
      }
      const newTotal = Math.floor(Number(partial['totalMinutes']));
      if (!Number.isFinite(newTotal) || newTotal < 1) {
        throw new BadRequestException('Invalid target duration.');
      }
      if (newTotal < currentMin) {
        throw new BadRequestException('Target cannot be lower than current progress.');
      }
      const next = { ...meta, totalMinutes: newTotal };
      return {
        metadata: next as Prisma.InputJsonValue,
        isCompleted: currentMin >= newTotal,
      };
    }
    throw new BadRequestException('Target can only be updated for counter and duration tasks.');
  }

  async findChildren(userId: string, parentId: string): Promise<Task[]> {
    return this.prisma.task.findMany({
      where: { userId, parentId },
      orderBy: { name: 'asc' },
    });
  }

  async findTree(userId: string): Promise<TaskTreeNode[]> {
    const tasks = await this.prisma.task.findMany({
      where: { userId, isHidden: false },
      orderBy: [{ depth: 'asc' }, { name: 'asc' }],
    });
    return this.buildTree(tasks);
  }

  async findTreeWithOptions(userId: string, includeHidden: boolean): Promise<TaskTreeNode[]> {
    const tasks = await this.prisma.task.findMany({
      where: {
        userId,
        ...(includeHidden ? {} : { isHidden: false }),
      },
      orderBy: [{ depth: 'asc' }, { name: 'asc' }],
    });
    return this.buildTree(tasks);
  }

  async updateProgressAndCompletion(
    taskId: string,
    trackerMetadata: Prisma.InputJsonValue,
    isCompleted: boolean,
    db: PrismaService | Prisma.TransactionClient = this.prisma,
  ): Promise<void> {
    await db.task.update({
      where: { id: taskId },
      data: {
        trackerMetadata,
        isCompleted,
      },
    });
  }

  makeSnapshot(task: Task): ProgressLogSnapshot {
    return {
      taskName: task.name,
      trackerType: task.trackerType,
      trackerMetadata: task.trackerMetadata as Prisma.JsonObject,
    };
  }

  async getCurrentSession(userId: string): Promise<CurrentTrackingSessionDto | null> {
    const rows = await this.prisma.$queryRaw<
      { taskId: string; taskName: string; startTimeMs: number | bigint }[]
    >(
      Prisma.sql`
        SELECT cs.task_id AS "taskId", t.name AS "taskName", cs.start_time_ms AS "startTimeMs"
        FROM current_sessions cs
        JOIN tasks t ON t.id = cs.task_id
        WHERE cs.user_id = ${userId}
        LIMIT 1
      `,
    );
    const session = rows[0];
    if (!session) {
      return null;
    }
    return {
      taskId: session.taskId,
      taskName: session.taskName,
      startTimeMs: Number(session.startTimeMs),
    };
  }

  async startTracking(
    userId: string,
    taskId: string,
    startTimeMs: number,
    stopExisting: boolean,
  ): Promise<CurrentTrackingSessionDto> {
    const task = await this.findById(userId, taskId);
    if (task.trackerType === TrackerType.SUBTASK) {
      throw new BadRequestException('Folders cannot be tracked directly');
    }
    if (task.isHidden) {
      throw new BadRequestException('Archived tasks cannot be tracked');
    }
    if (task.isCompleted) {
      throw new BadRequestException('Completed tasks cannot be tracked');
    }

    const existingRows = await this.prisma.$queryRaw<
      { taskId: string; taskName: string; startTimeMs: number | bigint }[]
    >(
      Prisma.sql`
        SELECT cs.task_id AS "taskId", t.name AS "taskName", cs.start_time_ms AS "startTimeMs"
        FROM current_sessions cs
        JOIN tasks t ON t.id = cs.task_id
        WHERE cs.user_id = ${userId}
        LIMIT 1
      `,
    );
    const existing = existingRows[0];
    if (existing && existing.taskId !== taskId && !stopExisting) {
      throw new BadRequestException(`Already tracking ${existing.taskName}`);
    }
    if (!Number.isFinite(startTimeMs) || startTimeMs < 0) {
      throw new BadRequestException('Invalid startTimeMs');
    }

    await this.prisma.$executeRaw(
      Prisma.sql`
        INSERT INTO current_sessions (id, user_id, task_id, start_time_ms, created_at, updated_at)
        VALUES (${randomUUID()}, ${userId}, ${taskId}, ${Math.floor(startTimeMs)}, now(), now())
        ON CONFLICT (user_id)
        DO UPDATE SET task_id = EXCLUDED.task_id, start_time_ms = EXCLUDED.start_time_ms, updated_at = now()
      `,
    );
    const rows = await this.prisma.$queryRaw<
      { taskId: string; taskName: string; startTimeMs: number | bigint }[]
    >(
      Prisma.sql`
        SELECT cs.task_id AS "taskId", t.name AS "taskName", cs.start_time_ms AS "startTimeMs"
        FROM current_sessions cs
        JOIN tasks t ON t.id = cs.task_id
        WHERE cs.user_id = ${userId}
        LIMIT 1
      `,
    );
    const session = rows[0]!;
    return {
      taskId: session.taskId,
      taskName: session.taskName,
      startTimeMs: Number(session.startTimeMs),
    };
  }

  async stopTracking(userId: string): Promise<{
    taskId: string;
    taskName: string;
    startTimeMs: number;
    stopTime: string;
    elapsedMinutes: number;
  }> {
    const rows = await this.prisma.$queryRaw<
      { taskId: string; taskName: string; startTimeMs: number | bigint }[]
    >(
      Prisma.sql`
        SELECT cs.task_id AS "taskId", t.name AS "taskName", cs.start_time_ms AS "startTimeMs"
        FROM current_sessions cs
        JOIN tasks t ON t.id = cs.task_id
        WHERE cs.user_id = ${userId}
        LIMIT 1
      `,
    );
    const session = rows[0];
    if (!session) {
      throw new NotFoundException('No active tracking session');
    }
    const stopTime = new Date();
    const startMs = Number(session.startTimeMs);
    const elapsedMinutes = Math.max(
      1,
      Math.round((stopTime.getTime() - startMs) / 60000),
    );
    await this.prisma.$executeRaw(
      Prisma.sql`DELETE FROM current_sessions WHERE user_id = ${userId}`,
    );
    return {
      taskId: session.taskId,
      taskName: session.taskName,
      startTimeMs: startMs,
      stopTime: stopTime.toISOString(),
      elapsedMinutes,
    };
  }

  async deleteOrArchive(
    userId: string,
    taskId: string,
  ): Promise<{ archivedTaskIds: string[]; deletedTaskIds: string[] }> {
    const root = await this.findById(userId, taskId);
    const allTasks = await this.prisma.task.findMany({
      where: { userId },
      select: { id: true, parentId: true },
    });
    const childrenByParent = new Map<string, string[]>();
    for (const task of allTasks) {
      if (!task.parentId) {
        continue;
      }
      const existing = childrenByParent.get(task.parentId) ?? [];
      existing.push(task.id);
      childrenByParent.set(task.parentId, existing);
    }

    const subtreeIds: string[] = [];
    const stack = [root.id];
    while (stack.length > 0) {
      const currentId = stack.pop()!;
      subtreeIds.push(currentId);
      const children = childrenByParent.get(currentId) ?? [];
      for (const childId of children) {
        stack.push(childId);
      }
    }

    const logCounts = await this.prisma.progressLog.groupBy({
      by: ['taskId'],
      where: { userId, taskId: { in: subtreeIds } },
      _count: { _all: true },
    });
    const hasHistory = new Set(logCounts.map((row) => row.taskId));

    const archivedTaskIds = new Set<string>();
    const deletedTaskIds = new Set<string>();
    const walk = (currentId: string): boolean => {
      const childIds = childrenByParent.get(currentId) ?? [];
      let branchHasHistory = hasHistory.has(currentId);
      for (const childId of childIds) {
        if (walk(childId)) {
          branchHasHistory = true;
        }
      }
      if (branchHasHistory) {
        archivedTaskIds.add(currentId);
      } else {
        deletedTaskIds.add(currentId);
      }
      return branchHasHistory;
    };
    walk(root.id);

    await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw(
        Prisma.sql`DELETE FROM current_sessions WHERE user_id = ${userId} AND task_id IN (${Prisma.join(subtreeIds)})`,
      );
      if (archivedTaskIds.size > 0) {
        await tx.task.updateMany({
          where: { userId, id: { in: [...archivedTaskIds] } },
          data: { isHidden: true },
        });
      }
      if (deletedTaskIds.size > 0) {
        await tx.task.deleteMany({
          where: { userId, id: { in: [...deletedTaskIds] } },
        });
      }
    });

    return {
      archivedTaskIds: [...archivedTaskIds],
      deletedTaskIds: [...deletedTaskIds],
    };
  }

  async restore(userId: string, taskId: string): Promise<Task> {
    await this.findById(userId, taskId);
    const allTasks = await this.prisma.task.findMany({
      where: { userId },
      select: { id: true, parentId: true },
    });
    const childrenByParent = new Map<string, string[]>();
    for (const task of allTasks) {
      if (!task.parentId) {
        continue;
      }
      const existing = childrenByParent.get(task.parentId) ?? [];
      existing.push(task.id);
      childrenByParent.set(task.parentId, existing);
    }
    const subtreeIds: string[] = [];
    const stack = [taskId];
    while (stack.length > 0) {
      const currentId = stack.pop()!;
      subtreeIds.push(currentId);
      const children = childrenByParent.get(currentId) ?? [];
      for (const childId of children) {
        stack.push(childId);
      }
    }
    await this.prisma.task.updateMany({
      where: { userId, id: { in: subtreeIds } },
      data: { isHidden: false },
    });
    return this.findById(userId, taskId);
  }

  private buildTree(tasks: Task[]): TaskTreeNode[] {
    const byId = new Map<string, TaskTreeNode>();
    const roots: TaskTreeNode[] = [];

    tasks.forEach((task) => {
      byId.set(task.id, { ...task, children: [] });
    });

    tasks.forEach((task) => {
      const node = byId.get(task.id);
      if (!node) {
        return;
      }
      if (!task.parentId) {
        roots.push(node);
        return;
      }
      const parent = byId.get(task.parentId);
      if (!parent) {
        roots.push(node);
        return;
      }
      parent.children.push(node);
    });

    return roots;
  }
}

interface ProgressLogSnapshot {
  taskName: string;
  trackerType: TrackerType;
  trackerMetadata: Prisma.JsonObject;
}
