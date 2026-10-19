import { Global, Module } from '@nestjs/common';
import { AdminAuditController } from './admin-audit.controller.js';
import { AuditQueryService } from './audit-query.service.js';
import { AuditService } from './audit.service.js';

@Global()
@Module({
  controllers: [AdminAuditController],
  providers: [AuditService, AuditQueryService],
  exports: [AuditService],
})
export class AuditModule {}
