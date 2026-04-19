import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUserId } from '../common/current-user.decorator';
import { SessionAuthGuard } from '../common/session-auth.guard';
import { CreateTaskDto } from './dto/create-task.dto';
import { TaskQueryDto } from './dto/task-query.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { TasksService } from './tasks.service';

@Controller('tasks')
@UseGuards(SessionAuthGuard)
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Post()
  create(@CurrentUserId() userId: string, @Body() dto: CreateTaskDto) {
    return this.tasksService.create(userId, dto);
  }

  @Patch(':id')
  update(@CurrentUserId() userId: string, @Param('id') taskId: string, @Body() dto: UpdateTaskDto) {
    return this.tasksService.update(userId, taskId, dto);
  }

  @Get()
  list(@CurrentUserId() userId: string, @Query() query: TaskQueryDto) {
    return this.tasksService.findMany(userId, query);
  }

  @Get('tree')
  tree(@CurrentUserId() userId: string) {
    return this.tasksService.findTree(userId);
  }

  @Get('recent-leaves')
  recentLeaves(@CurrentUserId() userId: string, @Query() query: TaskQueryDto) {
    return this.tasksService.findRecentLeafTasks(userId, query);
  }

  @Get(':id')
  getById(@CurrentUserId() userId: string, @Param('id') taskId: string) {
    return this.tasksService.findById(userId, taskId);
  }

  @Get(':id/children')
  children(@CurrentUserId() userId: string, @Param('id') taskId: string) {
    return this.tasksService.findChildren(userId, taskId);
  }
}
