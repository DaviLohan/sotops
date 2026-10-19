import { Module } from '@nestjs/common';
import { PublicController } from './public.controller.js';
import { PublicDirectoryService } from './public-directory.service.js';
import { PublicService } from './public.service.js';

@Module({
  controllers: [PublicController],
  providers: [PublicService, PublicDirectoryService],
})
export class PublicModule {}
