import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Task, TrackerType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { TaskQueryDto } from './dto/task-query.dto';
import { UpdateTaskDto } from './dto/update-task.dto';

export interface TaskTreeNode extends Task {
  children: TaskTreeNode[];
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
          orderBy: { timestamp: 'desc' },
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
    if (Object.keys(data).length === 0) {
      return task;
    }
    return this.prisma.task.update({
      where: { id: task.id },
      data,
    });
  }

  async findChildren(userId: string, parentId: string): Promise<Task[]> {
    return this.prisma.task.findMany({
      where: { userId, parentId },
      orderBy: { name: 'asc' },
    });
  }

  async findTree(userId: string): Promise<TaskTreeNode[]> {
    const tasks = await this.prisma.task.findMany({
      where: { userId },
      orderBy: [{ depth: 'asc' }, { name: 'asc' }],
    });
    return this.buildTree(tasks);
  }

  async updateProgressAndCompletion(
    taskId: string,
    trackerMetadata: Prisma.InputJsonValue,
    isCompleted: boolean,
  ): Promise<void> {
    await this.prisma.task.update({
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
