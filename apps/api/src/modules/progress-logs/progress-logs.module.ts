import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { TasksModule } from '../tasks/tasks.module';
import { ProgressLogsController } from './progress-logs.controller';
import { ProgressLogsService } from './progress-logs.service';

@Module({
  imports: [AuthModule, TasksModule],
  controllers: [ProgressLogsController],
  providers: [ProgressLogsService],
})
export class ProgressLogsModule {}
