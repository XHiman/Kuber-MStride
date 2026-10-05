import { BadRequestException, Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { UsersService } from './users.service';
import { UserAuthService } from './user-auth.service';
import { UserSessionGuard } from './user-session.guard';

@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly auth: UserAuthService,
  ) {}

  @Post('login')
  login(@Body() data: { username?: string; password?: string }) {
    if (typeof data.username !== 'string' || typeof data.password !== 'string') {
      throw new BadRequestException('Username and password are required.');
    }
    return this.auth.login(data.username, data.password);
  }

  @Get()
  list() {
    return this.usersService.list();
  }

  @Get('session')
  @UseGuards(UserSessionGuard)
  session(@Req() request: Request & { userId: string }) {
    return this.usersService.getProfile(request.userId);
  }

  @Get('dashboard')
  @UseGuards(UserSessionGuard)
  dashboard(@Req() request: Request & { userId: string }) {
    return this.usersService.getDashboard(request.userId);
  }
}
