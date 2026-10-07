import { Controller, Get, Post, Put, Param, Body, UseGuards } from '@nestjs/common';
import { DistrictsService } from './districts.service';
import { UserSessionGuard } from '../users/user-session.guard';

@Controller('districts')
export class DistrictsController {
  constructor(private districtsService: DistrictsService) {}

  @Get()
  async findAll() {
    return this.districtsService.getStats();
  }

  @Get('records')
  async getRecords() {
    return this.districtsService.findAll();
  }

  @Post()
  @UseGuards(UserSessionGuard)
  async create(@Body() data: any) {
    return this.districtsService.create(data);
  }

  @Put(':id')
  @UseGuards(UserSessionGuard)
  async update(@Param('id') id: string, @Body() data: any) {
    return this.districtsService.update(id, data);
  }
}
