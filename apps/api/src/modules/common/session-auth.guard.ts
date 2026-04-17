import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthService } from '../auth/auth.service';

const COOKIE_NAME = process.env.SESSION_COOKIE_NAME ?? 'progress_tracker_session';

@Injectable()
export class SessionAuthGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const token = request.cookies?.[COOKIE_NAME] as string | undefined;
    const userId = this.authService.getUserIdBySession(token);
    if (!userId) {
      throw new UnauthorizedException('Authentication required');
    }
    request.userId = userId;
    return true;
  }
}
