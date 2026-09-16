import { Injectable } from '@nestjs/common';
import { BillsService } from '../bills/bills.service';
import { BudgetService } from '../budget/budget.service';
import { TransfersService } from '../transfers/transfers.service';
import { DistrictsService } from '../districts/districts.service';

@Injectable()
export class DashboardService {
  constructor(
    private bills: BillsService,
    private budget: BudgetService,
    private transfers: TransfersService,
    private districts: DistrictsService,
  ) {}

  async getFullDashboard() {
    const [billStats, budgetTotals, transferStats, districtStats] = await Promise.all([
      this.bills.getDashboardStats(),
      this.budget.getTotals(),
      this.transfers.getStats(),
      this.districts.getStats(),
    ]);

    return {
      bills: billStats,
      budget: budgetTotals,
      transfers: transferStats,
      districts: districtStats,
    };
  }
}
