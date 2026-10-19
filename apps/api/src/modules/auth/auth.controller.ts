import {
  type AuthStateDto,
  authStateDtoSchema,
  type ApiResponse,
  forgotPasswordSchema,
  type ForgotPasswordInput,
  type LoginInput,
  type LoginResultDto,
  loginResultDtoSchema,
  loginSchema,
  type MessageDto,
  messageDtoSchema,
  type MfaChallengeInput,
  mfaChallengeSchema,
  type RegisterInput,
  registerSchema,
  type VerifyEmailInput,
  verifyEmailSchema,
} from '@efed/shared';
import { Body, Controller, Get, HttpCode, Post, Req, Res } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { AppConfig } from '../../config/app-config.js';
import { requestContextFrom } from '../../common/http/request-context.js';
import { ZodValidationPipe } from '../../common/http/zod-validation.pipe.js';
import { ApiProblems, ApiZodBody, ApiZodResponse } from '../../common/openapi/zod-openapi.js';
import { AllowPendingMfa, AuthRateLimited, CurrentAuth, Public } from './auth.decorators.js';
import { AuthService } from './auth.service.js';
import type { AuthContext } from './auth.types.js';
import { SessionService } from './session.service.js';

const REGISTER_MESSAGE =
  'Se os dados estiverem corretos, enviamos um e-mail com o link de confirmação.';

@ApiTags('Autenticação')
@Controller({ path: 'auth', version: '1' })
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly sessions: SessionService,
    private readonly config: AppConfig,
  ) {}

  @Post('register')
  @Public()
  @AuthRateLimited()
  @HttpCode(202)
  @ApiOperation({ summary: 'Cria uma conta de jogador e envia o e-mail de verificação' })
  @ApiZodBody(registerSchema)
  @ApiZodResponse(messageDtoSchema, { status: 202, description: 'Cadastro recebido.' })
  @ApiProblems(400, 409, 429)
  async register(
    @Body(new ZodValidationPipe(registerSchema)) body: RegisterInput,
    @Req() request: Request,
  ): Promise<ApiResponse<MessageDto>> {
    await this.auth.register(body, requestContextFrom(request));
    return { data: { message: REGISTER_MESSAGE } };
  }

  @Post('verify-email')
  @Public()
  @AuthRateLimited()
  @HttpCode(200)
  @ApiOperation({ summary: 'Confirma o e-mail com o token recebido e ativa a conta' })
  @ApiZodBody(verifyEmailSchema)
  @ApiZodResponse(messageDtoSchema, { description: 'E-mail confirmado.' })
  @ApiProblems(400, 429)
  async verifyEmail(
    @Body(new ZodValidationPipe(verifyEmailSchema)) body: VerifyEmailInput,
    @Req() request: Request,
  ): Promise<ApiResponse<MessageDto>> {
    await this.auth.verifyEmail(body.token, requestContextFrom(request));
    return { data: { message: 'E-mail confirmado. Você já pode entrar.' } };
  }

  @Post('verify-email/resend')
  @Public()
  @AuthRateLimited()
  @HttpCode(202)
  @ApiOperation({ summary: 'Reenvia o e-mail de verificação para contas pendentes' })
  @ApiZodBody(forgotPasswordSchema)
  @ApiZodResponse(messageDtoSchema, { status: 202, description: 'Pedido recebido.' })
  @ApiProblems(400, 429)
  async resendVerification(
    @Body(new ZodValidationPipe(forgotPasswordSchema)) body: ForgotPasswordInput,
  ): Promise<ApiResponse<MessageDto>> {
    await this.auth.resendVerification(body.email);
    return {
      data: { message: 'Se houver uma conta pendente com este e-mail, reenviamos o link.' },
    };
  }

  @Post('login')
  @Public()
  @AuthRateLimited()
  @HttpCode(200)
  @ApiOperation({
    summary: 'Abre uma sessão',
    description:
      'Define o cookie de sessão HttpOnly. Contas com MFA recebem `MFA_REQUIRED` e precisam concluir `POST /auth/mfa/challenge`.',
  })
  @ApiZodBody(loginSchema)
  @ApiZodResponse(loginResultDtoSchema, { description: 'Sessão aberta ou aguardando MFA.' })
  @ApiProblems(400, 401, 403, 429)
  async login(
    @Body(new ZodValidationPipe(loginSchema)) body: LoginInput,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<ApiResponse<LoginResultDto>> {
    const outcome = await this.auth.login(body, requestContextFrom(request));
    this.sessions.setCookie(response, outcome.session);
    const csrfToken = this.sessions.csrfTokenFor(outcome.session.id);

    if (outcome.status === 'MFA_REQUIRED') {
      return { data: { status: 'MFA_REQUIRED', csrfToken } };
    }
    const context = await this.auth.reload(outcome.session.token);
    return {
      data: { status: 'AUTHENTICATED', account: this.auth.toAccountDto(context), csrfToken },
    };
  }

  @Post('mfa/challenge')
  @AllowPendingMfa()
  @AuthRateLimited()
  @HttpCode(200)
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Conclui o login com o código do autenticador ou de recuperação' })
  @ApiZodBody(mfaChallengeSchema)
  @ApiZodResponse(authStateDtoSchema, { description: 'Sessão totalmente autenticada.' })
  @ApiProblems(400, 401, 403, 409, 429)
  async mfaChallenge(
    @CurrentAuth() auth: AuthContext,
    @Body(new ZodValidationPipe(mfaChallengeSchema)) body: MfaChallengeInput,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<ApiResponse<AuthStateDto>> {
    const session = await this.auth.completeMfaChallenge(auth, body, requestContextFrom(request));
    this.sessions.setCookie(response, session);
    const context = await this.auth.reload(session.token);
    return {
      data: {
        account: this.auth.toAccountDto(context),
        csrfToken: this.sessions.csrfTokenFor(session.id),
      },
    };
  }

  @Post('logout')
  @Public()
  @HttpCode(204)
  @ApiOperation({ summary: 'Encerra a sessão atual e remove o cookie' })
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    const token: unknown = request.cookies?.[this.config.session.cookieName];
    await this.auth.logout(
      typeof token === 'string' ? token : undefined,
      requestContextFrom(request),
    );
    this.sessions.clearCookie(response);
  }

  @Get('me')
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Retorna a conta autenticada e o token anti-CSRF da sessão' })
  @ApiZodResponse(authStateDtoSchema, { description: 'Conta autenticada.' })
  @ApiProblems(401, 403)
  me(@CurrentAuth() auth: AuthContext): ApiResponse<AuthStateDto> {
    return {
      data: {
        account: this.auth.toAccountDto(auth),
        csrfToken: this.sessions.csrfTokenFor(auth.sessionId),
      },
    };
  }
}
