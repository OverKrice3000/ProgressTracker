import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { CurrentUserId } from '../common/current-user.decorator';
import { SessionAuthGuard } from '../common/session-auth.guard';
import { UsersService } from './users.service';
import { UpdateUserSettingsDto } from './dto/update-user-settings.dto';

@Controller('users')
@UseGuards(SessionAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('settings')
  getSettings(@CurrentUserId() userId: string) {
    return this.usersService.getSettings(userId);
  }

  @Patch('settings')
  updateSettings(@CurrentUserId() userId: string, @Body() dto: UpdateUserSettingsDto) {
    return this.usersService.updateSettings(userId, dto);
  }
}
