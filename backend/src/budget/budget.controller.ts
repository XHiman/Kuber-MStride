import { Controller, Get, Put, Param, Body } from '@nestjs/common';
import { BudgetService } from './budget.service';

@Controller('budget')
export class BudgetController {
  constructor(private budgetService: BudgetService) {}

  @Get()
  async findAll() {
    return this.budgetService.getTotals();
  }

  @Put(':code')
  async update(@Param('code') code: string, @Body() data: any) {
    return this.budgetService.update(code, data);
  }
}
