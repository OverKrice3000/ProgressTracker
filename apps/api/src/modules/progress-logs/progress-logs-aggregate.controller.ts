import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { CurrentUserId } from '../common/current-user.decorator';
import { SessionAuthGuard } from '../common/session-auth.guard';
import { DailyTotalQueryDto } from './dto/daily-total-query.dto';
import { ProgressLogsService } from './progress-logs.service';

@Controller('progress-logs')
@UseGuards(SessionAuthGuard)
export class ProgressLogsAggregateController {
  constructor(private readonly progressLogsService: ProgressLogsService) {}

  @Get()
  list(@CurrentUserId() userId: string) {
    return this.progressLogsService.listForUser(userId);
  }

  @Get('daily-total')
  getDailyTotal(@CurrentUserId() userId: string, @Query() query: DailyTotalQueryDto) {
    return this.progressLogsService.getDailyTotalForRange(
      userId,
      query.dayStart,
      query.dayEnd,
      query.excludeLogId,
      query.dateYmd,
    );
  }
}
