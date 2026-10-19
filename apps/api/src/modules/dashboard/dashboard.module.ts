import { Module } from '@nestjs/common';
import { AdminDashboardController } from './admin-dashboard.controller.js';
import { DashboardService } from './dashboard.service.js';

@Module({
  controllers: [AdminDashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
