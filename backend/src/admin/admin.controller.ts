import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Ip,
  Param,
  Post,
  Put,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { AdminAuthService } from './admin-auth.service';
import { AdminService, AdminEntity } from './admin.service';
import { AdminSessionGuard } from './admin-session.guard';

@Controller('adminX/api')
export class AdminController {
  constructor(
    private readonly auth: AdminAuthService,
    private readonly admin: AdminService,
  ) {}

  @Post('login')
  login(
    @Body() body: { username?: string; password?: string },
    @Ip() ip: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    if (typeof body.username !== 'string' || typeof body.password !== 'string') {
      throw new BadRequestException('Username and password are required.');
    }
    const token = this.auth.login(body.username, body.password, ip);
    response.setHeader('Set-Cookie', this.auth.cookie(token, process.env.NODE_ENV === 'production'));
    return { authenticated: true };
  }

  @Post('logout')
  logout(@Res({ passthrough: true }) response: Response) {
    response.setHeader('Set-Cookie', this.auth.clearCookie(process.env.NODE_ENV === 'production'));
    return { authenticated: false };
  }

  @Get('session')
  @UseGuards(AdminSessionGuard)
  session() {
    return { authenticated: true, username: 'XHiman' };
  }

  @Get(':entity')
  @UseGuards(AdminSessionGuard)
  list(@Param('entity') entity: string) {
    return this.admin.list(this.entity(entity));
  }

  @Post(':entity')
  @UseGuards(AdminSessionGuard)
  create(@Param('entity') entity: string, @Body() body: Record<string, unknown>) {
    return this.admin.create(this.entity(entity), body);
  }

  @Put(':entity/:id')
  @UseGuards(AdminSessionGuard)
  update(
    @Param('entity') entity: string,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.admin.update(this.entity(entity), id, body);
  }

  @Delete(':entity/:id')
  @UseGuards(AdminSessionGuard)
  remove(@Param('entity') entity: string, @Param('id') id: string) {
    return this.admin.remove(this.entity(entity), id);
  }

  private entity(value: string): AdminEntity {
    const entities: AdminEntity[] = [
      'bills', 'budgets', 'budgetHeads', 'objectHeads', 'transfers', 'districts', 'users', 'devices',
    ];
    if (!entities.includes(value as AdminEntity)) {
      throw new BadRequestException(`Unsupported admin entity: ${value}`);
    }
    return value as AdminEntity;
  }
}
