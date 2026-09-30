import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { BillsModule } from '../bills/bills.module';
import { TransfersModule } from '../transfers/transfers.module';
import { AdminAuthService } from './admin-auth.service';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AdminSessionGuard } from './admin-session.guard';
import { DeviceAccessGuard } from './device-access.guard';

@Module({
  imports: [BillsModule, TransfersModule],
  controllers: [AdminController],
  providers: [
    AdminAuthService,
    AdminService,
    AdminSessionGuard,
    { provide: APP_GUARD, useClass: DeviceAccessGuard },
  ],
})
export class AdminModule {}
