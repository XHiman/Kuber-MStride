import { Controller, Get, Put, Param, Body, Query } from '@nestjs/common';
import { BudgetService } from './budget.service';

@Controller('budget')
export class BudgetController {
  constructor(private budgetService: BudgetService) {}

  @Get()
  async findAll(@Query('fiscalYear') fiscalYear?: string) {
    return this.budgetService.getTotals(fiscalYear);
  }

  @Put(':code')
  async update(@Param('code') code: string, @Body() data: any) {
    return this.budgetService.update('FY 2026-27', code, data);
  }

  @Put(':fiscalYear/:code')
  async updateForFiscalYear(
    @Param('fiscalYear') fiscalYear: string,
    @Param('code') code: string,
    @Body() data: any,
  ) {
    return this.budgetService.update(fiscalYear, code, data);
  }
}
