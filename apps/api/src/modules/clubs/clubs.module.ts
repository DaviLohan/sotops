import { Module } from '@nestjs/common';
import { AdminClubsController } from './admin-clubs.controller.js';
import { ClubsAdminService } from './clubs-admin.service.js';
import {
  AdminTransfersController,
  ClubRequestsController,
  MyClubController,
} from './transfers.controller.js';
import { TransfersService } from './transfers.service.js';

@Module({
  controllers: [
    AdminClubsController,
    MyClubController,
    ClubRequestsController,
    AdminTransfersController,
  ],
  providers: [ClubsAdminService, TransfersService],
})
export class ClubsModule {}
