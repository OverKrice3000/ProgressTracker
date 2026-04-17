import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { CurrentUserId } from '../common/current-user.decorator';
import { SessionAuthGuard } from '../common/session-auth.guard';
import { CreateProgressLogDto } from './dto/create-progress-log.dto';
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
}
