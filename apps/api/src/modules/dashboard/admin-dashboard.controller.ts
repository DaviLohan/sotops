import {
  type ApiResponse,
  type DashboardSummaryDto,
  dashboardSummaryDtoSchema,
} from '@efed/shared';
import { Controller, Get } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiProblems, ApiZodResponse } from '../../common/openapi/zod-openapi.js';
import { RequirePermissions } from '../auth/auth.decorators.js';
import { DashboardService } from './dashboard.service.js';

@ApiTags('Administração — Dashboard')
@ApiCookieAuth()
@ApiProblems(401, 403)
@Controller({ path: 'admin/dashboard', version: '1' })
export class AdminDashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get('summary')
  @RequirePermissions('dashboard.read')
  @ApiOperation({ summary: 'Indicadores gerais calculados a partir do banco de dados' })
  @ApiZodResponse(dashboardSummaryDtoSchema, { description: 'Indicadores atuais.' })
  async summary(): Promise<ApiResponse<DashboardSummaryDto>> {
    return { data: await this.dashboard.summary() };
  }
}
