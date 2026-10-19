import {
  type ApiResponse,
  type MessageDto,
  messageDtoSchema,
  type MfaConfirmInput,
  mfaConfirmSchema,
  type MfaEnrollmentDto,
  mfaEnrollmentDtoSchema,
  type MfaRecoveryCodesDto,
  mfaRecoveryCodesDtoSchema,
  type MfaStatusDto,
  mfaStatusDtoSchema,
  type PasswordConfirmationInput,
  passwordConfirmationSchema,
} from '@efed/shared';
import { Body, Controller, Get, HttpCode, Post, Req } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { requestContextFrom } from '../../common/http/request-context.js';
import { ZodValidationPipe } from '../../common/http/zod-validation.pipe.js';
import { ApiProblems, ApiZodBody, ApiZodResponse } from '../../common/openapi/zod-openapi.js';
import { AuthRateLimited, CurrentAuth } from './auth.decorators.js';
import type { AuthContext } from './auth.types.js';
import { MfaService } from './mfa.service.js';

@ApiTags('Autenticação — MFA')
@ApiCookieAuth()
@ApiProblems(401, 403)
@Controller({ path: 'auth/mfa', version: '1' })
export class MfaController {
  constructor(private readonly mfa: MfaService) {}

  @Get()
  @ApiOperation({ summary: 'Situação da verificação em duas etapas da conta' })
  @ApiZodResponse(mfaStatusDtoSchema, { description: 'Situação do MFA.' })
  async status(@CurrentAuth() auth: AuthContext): Promise<ApiResponse<MfaStatusDto>> {
    return { data: await this.mfa.status(auth) };
  }

  @Post('enrollment')
  @AuthRateLimited()
  @HttpCode(200)
  @ApiOperation({
    summary: 'Inicia o cadastro do autenticador (TOTP)',
    description: 'Exige a senha atual. O segredo só passa a valer após a confirmação.',
  })
  @ApiZodBody(passwordConfirmationSchema)
  @ApiZodResponse(mfaEnrollmentDtoSchema, { description: 'Segredo pendente de confirmação.' })
  @ApiProblems(400, 409, 429)
  async startEnrollment(
    @CurrentAuth() auth: AuthContext,
    @Body(new ZodValidationPipe(passwordConfirmationSchema)) body: PasswordConfirmationInput,
  ): Promise<ApiResponse<MfaEnrollmentDto>> {
    return { data: await this.mfa.startEnrollment(auth, body.password) };
  }

  @Post('enrollment/confirm')
  @AuthRateLimited()
  @HttpCode(200)
  @ApiOperation({
    summary: 'Confirma o cadastro com um código e devolve os códigos de recuperação',
    description: 'Os códigos de recuperação são exibidos uma única vez.',
  })
  @ApiZodBody(mfaConfirmSchema)
  @ApiZodResponse(mfaRecoveryCodesDtoSchema, { description: 'MFA ativado.' })
  @ApiProblems(400, 409, 429)
  async confirmEnrollment(
    @CurrentAuth() auth: AuthContext,
    @Body(new ZodValidationPipe(mfaConfirmSchema)) body: MfaConfirmInput,
    @Req() request: Request,
  ): Promise<ApiResponse<MfaRecoveryCodesDto>> {
    return {
      data: await this.mfa.confirmEnrollment(auth, body.code, requestContextFrom(request)),
    };
  }

  @Post('recovery-codes')
  @AuthRateLimited()
  @HttpCode(200)
  @ApiOperation({ summary: 'Gera novos códigos de recuperação e invalida os anteriores' })
  @ApiZodBody(passwordConfirmationSchema)
  @ApiZodResponse(mfaRecoveryCodesDtoSchema, { description: 'Novos códigos.' })
  @ApiProblems(400, 409, 429)
  async regenerateRecoveryCodes(
    @CurrentAuth() auth: AuthContext,
    @Body(new ZodValidationPipe(passwordConfirmationSchema)) body: PasswordConfirmationInput,
    @Req() request: Request,
  ): Promise<ApiResponse<MfaRecoveryCodesDto>> {
    return {
      data: await this.mfa.regenerateRecoveryCodes(
        auth,
        body.password,
        requestContextFrom(request),
      ),
    };
  }

  @Post('disable')
  @AuthRateLimited()
  @HttpCode(200)
  @ApiOperation({
    summary: 'Desativa o MFA',
    description: 'Indisponível para contas cujo papel exige MFA.',
  })
  @ApiZodBody(passwordConfirmationSchema)
  @ApiZodResponse(messageDtoSchema, { description: 'MFA desativado.' })
  @ApiProblems(400, 409, 429)
  async disable(
    @CurrentAuth() auth: AuthContext,
    @Body(new ZodValidationPipe(passwordConfirmationSchema)) body: PasswordConfirmationInput,
    @Req() request: Request,
  ): Promise<ApiResponse<MessageDto>> {
    await this.mfa.disable(auth, body.password, requestContextFrom(request));
    return { data: { message: 'Verificação em duas etapas desativada.' } };
  }
}
