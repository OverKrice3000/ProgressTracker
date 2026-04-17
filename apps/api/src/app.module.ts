import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './modules/auth/auth.module';
import { PrismaModule } from './modules/prisma/prisma.module';
import { ProgressLogsModule } from './modules/progress-logs/progress-logs.module';
import { StatsModule } from './modules/stats/stats.module';
import { TasksModule } from './modules/tasks/tasks.module';
import { UsersModule } from './modules/users/users.module';

@Module({
  imports: [PrismaModule, AuthModule, UsersModule, TasksModule, ProgressLogsModule, StatsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
