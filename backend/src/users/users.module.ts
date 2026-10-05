import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { UserAuthService } from './user-auth.service';
import { UserSessionGuard } from './user-session.guard';

@Module({
  controllers: [UsersController],
  providers: [UsersService, UserAuthService, UserSessionGuard],
  exports: [UsersService, UserAuthService],
})
export class UsersModule {}
