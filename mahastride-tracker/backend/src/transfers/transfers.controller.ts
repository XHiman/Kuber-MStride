import { Controller, Get, Post, Put, Delete, Param, Body } from '@nestjs/common';
import { TransfersService } from './transfers.service';

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
  async create(@Body() data: any) {
    return this.transfersService.create(data);
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() data: any) {
    return this.transfersService.update(id, data);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.transfersService.remove(id);
  }
}
