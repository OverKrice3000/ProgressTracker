import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { CurrentUserId } from '../common/current-user.decorator';
import { SessionAuthGuard } from '../common/session-auth.guard';
import { StatsQueryDto } from './dto/stats-query.dto';
import { StatsService } from './stats.service';

@Controller('stats')
@UseGuards(SessionAuthGuard)
export class StatsController {
  constructor(private readonly statsService: StatsService) {}

  @Get()
  getSummary(@CurrentUserId() userId: string, @Query() query: StatsQueryDto) {
    return this.statsService.getSummary(userId, query);
  }
}
