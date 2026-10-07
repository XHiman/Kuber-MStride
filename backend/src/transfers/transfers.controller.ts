import { Controller, Get, Post, Put, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { TransfersService } from './transfers.service';
import { UserSessionGuard } from '../users/user-session.guard';

@Controller('transfers')
export class TransfersController {
  constructor(private transfersService: TransfersService) {}

  @Get()
  async findAll() {
    return this.transfersService.getStats();
  }

  @Get('records')
  async getRecords() {
    return this.transfersService.findAll();
  }

  @Post()
  @UseGuards(UserSessionGuard)
  async create(@Body() data: any) {
    return this.transfersService.create(data);
  }

  @Put(':id')
  @UseGuards(UserSessionGuard)
  async update(@Param('id') id: string, @Body() data: any) {
    return this.transfersService.update(id, data);
  }

  @Post(':id/utilizations')
  @UseGuards(UserSessionGuard)
  async addUtilization(@Param('id') id: string, @Body() data: any) {
    return this.transfersService.addUtilization(id, data);
  }

  @Put(':id/utilizations/:utilizationId')
  @UseGuards(UserSessionGuard)
  async updateUtilization(
    @Param('id') id: string,
    @Param('utilizationId') utilizationId: string,
    @Body() data: any,
  ) {
    return this.transfersService.updateUtilization(id, utilizationId, data);
  }

  @Delete(':id/utilizations/:utilizationId')
  @UseGuards(UserSessionGuard)
  async removeUtilization(
    @Param('id') id: string,
    @Param('utilizationId') utilizationId: string,
  ) {
    return this.transfersService.removeUtilization(id, utilizationId);
  }

  @Delete(':id')
  @UseGuards(UserSessionGuard)
  async remove(@Param('id') id: string) {
    return this.transfersService.remove(id);
  }
}
