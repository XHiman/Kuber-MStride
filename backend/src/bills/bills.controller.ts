import { Controller, Get, Post, Put, Delete, Query, Param, Body, UseGuards, Req } from '@nestjs/common';
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
  async create(@Body() dto: CreateBillDto, @Req() req: { userId?: string }) {
    const { changeNote, ...bill } = dto;
    return this.billsService.create({
      ...bill,
      date: dto.date ? new Date(dto.date) : null,
      clearedFY: null,
    }, await this.billsService.actorFor(req.userId), changeNote);
  }

  @Put(':id')
  @UseGuards(UserSessionGuard)
  async update(@Param('id') id: string, @Body() dto: UpdateBillDto, @Req() req: { userId?: string }) {
    const { changeNote, ...changes } = dto;
    return this.billsService.update(id, changes, await this.billsService.actorFor(req.userId), changeNote);
  }

  @Delete(':id')
  @UseGuards(UserSessionGuard)
  async remove(@Param('id') id: string) {
    return this.billsService.remove(id);
  }
}
