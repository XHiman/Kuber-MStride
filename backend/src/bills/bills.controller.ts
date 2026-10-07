import { Controller, Get, Post, Put, Delete, Query, Param, Body, UseGuards } from '@nestjs/common';
import { BillsService, BillCategory } from './bills.service';
import { CreateBillDto, UpdateBillDto } from './dto/bill.dto';
import { UserSessionGuard } from '../users/user-session.guard';

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
  @UseGuards(UserSessionGuard)
  async create(@Body() dto: CreateBillDto) {
    return this.billsService.create({
      ...dto,
      date: dto.date ? new Date(dto.date) : null,
      clearedFY: null,
    });
  }

  @Put(':id')
  @UseGuards(UserSessionGuard)
  async update(@Param('id') id: string, @Body() dto: UpdateBillDto) {
    return this.billsService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(UserSessionGuard)
  async remove(@Param('id') id: string) {
    return this.billsService.remove(id);
  }
}
