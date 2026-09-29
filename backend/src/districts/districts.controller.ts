import { Controller, Get, Post, Put, Param, Body } from '@nestjs/common';
import { DistrictsService } from './districts.service';

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
  async create(@Body() data: any) {
    return this.districtsService.create(data);
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() data: any) {
    return this.districtsService.update(id, data);
  }
}
