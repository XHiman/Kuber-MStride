import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { BillsModule } from './bills/bills.module';
import { BudgetModule } from './budget/budget.module';
import { TransfersModule } from './transfers/transfers.module';
import { DistrictsModule } from './districts/districts.module';
import { DashboardModule } from './dashboard/dashboard.module';

@Module({
  imports: [PrismaModule, BillsModule, BudgetModule, TransfersModule, DistrictsModule, DashboardModule],
})
export class AppModule {}
