import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { BillsModule } from './bills/bills.module';
import { BudgetModule } from './budget/budget.module';
import { TransfersModule } from './transfers/transfers.module';
import { DistrictsModule } from './districts/districts.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { UsersModule } from './users/users.module';
import { SearchModule } from './search/search.module';
import { AdminModule } from './admin/admin.module';

@Module({
  imports: [PrismaModule, BillsModule, BudgetModule, TransfersModule, DistrictsModule, DashboardModule, UsersModule, SearchModule, AdminModule],
})
export class AppModule {}
