import {
  type ApiResponse,
  type ChangePasswordInput,
  changePasswordSchema,
  type ForgotPasswordInput,
  forgotPasswordSchema,
  type MessageDto,
  messageDtoSchema,
  type ResetPasswordInput,
  resetPasswordSchema,
} from '@efed/shared';
import { Body, Controller, HttpCode, Post, Req } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { requestContextFrom } from '../../common/http/request-context.js';
import { ZodValidationPipe } from '../../common/http/zod-validation.pipe.js';
import { ApiProblems, ApiZodBody, ApiZodResponse } from '../../common/openapi/zod-openapi.js';
import { AuthRateLimited, CurrentAuth, Public } from './auth.decorators.js';
import type { AuthContext } from './auth.types.js';
import { PasswordService } from './password.service.js';

@ApiTags('Autenticação — Senha')
@Controller({ path: 'auth/password', version: '1' })
export class PasswordController {
  constructor(private readonly passwords: PasswordService) {}

  @Post('forgot')
  @Public()
  @AuthRateLimited()
  @HttpCode(202)
  @ApiOperation({ summary: 'Solicita o link de redefinição de senha' })
  @ApiZodBody(forgotPasswordSchema)
  @ApiZodResponse(messageDtoSchema, { status: 202, description: 'Pedido recebido.' })
  @ApiProblems(400, 429)
  async forgot(
    @Body(new ZodValidationPipe(forgotPasswordSchema)) body: ForgotPasswordInput,
    @Req() request: Request,
  ): Promise<ApiResponse<MessageDto>> {
    await this.passwords.requestReset(body.email, requestContextFrom(request));
    return {
      data: { message: 'Se houver uma conta com este e-mail, enviamos o link de redefinição.' },
    };
  }

  @Post('reset')
  @Public()
  @AuthRateLimited()
  @HttpCode(200)
  @ApiOperation({ summary: 'Define uma nova senha com o token e encerra todas as sessões' })
  @ApiZodBody(resetPasswordSchema)
  @ApiZodResponse(messageDtoSchema, { description: 'Senha redefinida.' })
  @ApiProblems(400, 429)
  async reset(
    @Body(new ZodValidationPipe(resetPasswordSchema)) body: ResetPasswordInput,
    @Req() request: Request,
  ): Promise<ApiResponse<MessageDto>> {
    await this.passwords.reset(body, requestContextFrom(request));
    return { data: { message: 'Senha redefinida. Entre com a nova senha.' } };
  }

  @Post('change')
  @AuthRateLimited()
  @HttpCode(200)
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Troca a senha e encerra as demais sessões' })
  @ApiZodBody(changePasswordSchema)
  @ApiZodResponse(messageDtoSchema, { description: 'Senha alterada.' })
  @ApiProblems(400, 401, 403, 429)
  async change(
    @CurrentAuth() auth: AuthContext,
    @Body(new ZodValidationPipe(changePasswordSchema)) body: ChangePasswordInput,
    @Req() request: Request,
  ): Promise<ApiResponse<MessageDto>> {
    await this.passwords.change(auth, body, requestContextFrom(request));
    return { data: { message: 'Senha alterada. As outras sessões foram encerradas.' } };
  }
}
