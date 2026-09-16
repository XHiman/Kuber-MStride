import { Controller, Get, Post, Put, Delete, Query, Param, Body } from '@nestjs/common';
import { BillsService, BillCategory } from './bills.service';
import { CreateBillDto, UpdateBillDto } from './dto/bill.dto';

@Controller('bills')
export class BillsController {
  constructor(private billsService: BillsService) {}

  @Get()
  async findAll(@Query() query: any) {
    return this.billsService.findAll({
      search: query.search,
      vendor: query.vendor,
      stage: query.stage,
      cat: query.cat as BillCategory,
      clearedFY: query.clearedFY,
      sortBy: query.sortBy || 'amount',
      sortDir: query.sortDir || 'desc',
    });
  }

  @Get('dashboard')
  async getDashboard() {
    return this.billsService.getDashboardStats();
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.billsService.findOne(id);
  }

  @Post()
  async create(@Body() dto: CreateBillDto) {
    return this.billsService.create({ ...dto, clearedFY: null });
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateBillDto) {
    return this.billsService.update(id, dto);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.billsService.remove(id);
  }
}
