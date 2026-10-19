import { Module } from '@nestjs/common';
import { PlayerProfileController } from './player-profile.controller.js';
import { PlayerProfileService } from './player-profile.service.js';

@Module({ controllers: [PlayerProfileController], providers: [PlayerProfileService] })
export class PlayersModule {}
