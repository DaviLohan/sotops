import {
  type AccountDto,
  accountDtoSchema,
  type ApiResponse,
  type UpdateProfileInput,
  updateProfileSchema,
} from '@efed/shared';
import { Body, Controller, Patch, Req } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { requestContextFrom } from '../../common/http/request-context.js';
import { ZodValidationPipe } from '../../common/http/zod-validation.pipe.js';
import { ApiProblems, ApiZodBody, ApiZodResponse } from '../../common/openapi/zod-openapi.js';
import { CurrentAuth } from '../auth/auth.decorators.js';
import type { AuthContext } from '../auth/auth.types.js';
import { AccountService } from './account.service.js';

@ApiTags('Conta')
@ApiCookieAuth()
@ApiProblems(401, 403)
@Controller({ path: 'account', version: '1' })
export class AccountController {
  constructor(private readonly account: AccountService) {}

  @Patch('profile')
  @ApiOperation({ summary: 'Atualiza os dados básicos da própria conta' })
  @ApiZodBody(updateProfileSchema)
  @ApiZodResponse(accountDtoSchema.pick({ id: true, displayName: true }), {
    description: 'Perfil atualizado.',
  })
  @ApiProblems(400)
  async updateProfile(
    @CurrentAuth() auth: AuthContext,
    @Body(new ZodValidationPipe(updateProfileSchema)) body: UpdateProfileInput,
    @Req() request: Request,
  ): Promise<ApiResponse<Pick<AccountDto, 'id' | 'displayName'>>> {
    return { data: await this.account.updateProfile(auth, body, requestContextFrom(request)) };
  }
}
