import { Module } from '@nestjs/common';
import { AccountController } from './account.controller.js';
import { AccountService } from './account.service.js';
import { AdminUsersController } from './admin-users.controller.js';
import { UsersAdminService } from './users-admin.service.js';

@Module({
  controllers: [AccountController, AdminUsersController],
  providers: [AccountService, UsersAdminService],
})
export class UsersModule {}
