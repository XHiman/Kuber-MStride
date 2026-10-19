import { Module } from '@nestjs/common';
import { BillsModule } from '../bills/bills.module';
import { TransfersModule } from '../transfers/transfers.module';
import { UsersModule } from '../users/users.module';
import { ResearchModule } from '../research/research.module';
import { AdminAuthService } from './admin-auth.service';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AdminSessionGuard } from './admin-session.guard';

@Module({
  imports: [BillsModule, TransfersModule, UsersModule, ResearchModule],
  controllers: [AdminController],
  providers: [AdminAuthService, AdminService, AdminSessionGuard],
})
export class AdminModule {}
