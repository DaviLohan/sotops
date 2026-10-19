import { Module } from '@nestjs/common';
import { ContentAdminController, SettingsAdminController } from './content-admin.controller.js';
import { ContentAdminService } from './content-admin.service.js';

@Module({
  controllers: [ContentAdminController, SettingsAdminController],
  providers: [ContentAdminService],
})
export class ContentModule {}
