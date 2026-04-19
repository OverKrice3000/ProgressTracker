import { Body, Controller, Delete, HttpCode, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { CurrentUserId } from '../common/current-user.decorator';
import { SessionAuthGuard } from '../common/session-auth.guard';
import { CreateProgressLogDto } from './dto/create-progress-log.dto';
import { UpdateProgressLogDto } from './dto/update-progress-log.dto';
import { ProgressLogsService } from './progress-logs.service';

@Controller('tasks/:taskId/logs')
@UseGuards(SessionAuthGuard)
export class ProgressLogsController {
  constructor(private readonly progressLogsService: ProgressLogsService) {}

  @Post()
  create(
    @CurrentUserId() userId: string,
    @Param('taskId') taskId: string,
    @Body() dto: CreateProgressLogDto,
  ) {
    return this.progressLogsService.create(userId, taskId, dto);
  }

  @Patch(':logId')
  update(
    @CurrentUserId() userId: string,
    @Param('taskId') taskId: string,
    @Param('logId') logId: string,
    @Body() dto: UpdateProgressLogDto,
  ) {
    return this.progressLogsService.updateLog(userId, taskId, logId, dto);
  }

  @Delete(':logId')
  @HttpCode(204)
  remove(
    @CurrentUserId() userId: string,
    @Param('taskId') taskId: string,
    @Param('logId') logId: string,
  ) {
    return this.progressLogsService.deleteLog(userId, taskId, logId);
  }
}
