import { BadRequestException, Body, Controller, Get, Param, Post, Put, Req } from '@nestjs/common';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Post('device')
  registerDevice(
    @Body() data: { deviceId?: string; userAgent?: string },
    @Req() request: { ip?: string },
  ) {
    if (!data.deviceId || !data.userAgent) {
      throw new BadRequestException('Device ID and browser details are required.');
    }
    const ipAddress = request.ip ?? null;
    return this.usersService.registerDevice(data.deviceId, data.userAgent, ipAddress);
  }

  @Post('claim')
  claimDevice(@Body() data: { deviceId?: string; name?: string }) {
    if (!data.deviceId || !data.name) {
      throw new BadRequestException('Device ID and user name are required.');
    }
    return this.usersService.claimDevice(data.deviceId, data.name);
  }

  @Get()
  list() {
    return this.usersService.list();
  }

  @Get('dashboard/:id')
  dashboard(@Param('id') id: string) {
    return this.usersService.getDashboard(id);
  }

  @Put(':id')
  update(
    @Param('id') id: string,
    @Body() data: { name?: string; programs?: string[]; districts?: string[] },
  ) {
    return this.usersService.update(id, data);
  }
}
