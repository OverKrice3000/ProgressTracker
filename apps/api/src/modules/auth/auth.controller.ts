import { Body, Controller, Get, Post, Req, Res, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import { CurrentUserId } from '../common/current-user.decorator';
import { SessionAuthGuard } from '../common/session-auth.guard';
import { LoginDto } from './dto/login.dto';
import { AuthService } from './auth.service';

const COOKIE_NAME = process.env.SESSION_COOKIE_NAME ?? 'progress_tracker_session';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ userId: string; username: string }> {
    const user = await this.authService.validateUser(dto.username, dto.password);
    const sessionToken = this.authService.createSession(user.id);

    response.cookie(COOKIE_NAME, sessionToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 1000 * 60 * 60 * 24 * 7,
    });

    return { userId: user.id, username: user.username };
  }

  @Post('logout')
  logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): { ok: true } {
    const token = request.cookies?.[COOKIE_NAME] as string | undefined;
    this.authService.destroySession(token);
    response.clearCookie(COOKIE_NAME);
    return { ok: true };
  }

  @Get('me')
  @UseGuards(SessionAuthGuard)
  async me(@CurrentUserId() userId: string): Promise<{ userId: string; username: string }> {
    return this.authService.getProfile(userId);
  }
}
