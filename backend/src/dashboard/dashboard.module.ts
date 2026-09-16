import { Module } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { DashboardController } from './dashboard.controller';
import { BillsModule } from '../bills/bills.module';
import { BudgetModule } from '../budget/budget.module';
import { TransfersModule } from '../transfers/transfers.module';
import { DistrictsModule } from '../districts/districts.module';

@Module({
  imports: [BillsModule, BudgetModule, TransfersModule, DistrictsModule],
  providers: [DashboardService],
  controllers: [DashboardController],
})
export class DashboardModule {}
