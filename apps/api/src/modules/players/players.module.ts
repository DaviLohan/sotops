import { Module } from '@nestjs/common';
import { AdminPlayersController } from './admin-players.controller.js';
import { PlayerProfileController } from './player-profile.controller.js';
import { PlayerProfileService } from './player-profile.service.js';
import { PlayersAdminService } from './players-admin.service.js';

@Module({
  controllers: [PlayerProfileController, AdminPlayersController],
  providers: [PlayerProfileService, PlayersAdminService],
})
export class PlayersModule {}
