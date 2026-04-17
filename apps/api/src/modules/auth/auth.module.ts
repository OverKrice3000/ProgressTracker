import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { SessionStore } from './session.store';

@Module({
  controllers: [AuthController],
  providers: [AuthService, SessionStore],
  exports: [AuthService],
})
export class AuthModule {}
