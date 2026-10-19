import { Global, Module } from '@nestjs/common';
import { AccountMailer } from './account-mailer.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { CsrfGuard } from './csrf.guard.js';
import { MfaController } from './mfa.controller.js';
import { MfaService } from './mfa.service.js';
import { PasswordController } from './password.controller.js';
import { PasswordService } from './password.service.js';
import { PasswordVerifier } from './password-verifier.service.js';
import { PermissionsGuard } from './permissions.guard.js';
import { SessionGuard } from './session.guard.js';
import { SessionService } from './session.service.js';
import { SessionsController } from './sessions.controller.js';
import { UserTokenService } from './user-token.service.js';

/**
 * Global porque as guards de sessão, CSRF e permissão são registradas no AppModule e
 * outros módulos precisam encerrar sessões (ex.: suspensão de conta).
 */
@Global()
@Module({
  controllers: [AuthController, PasswordController, SessionsController, MfaController],
  providers: [
    AccountMailer,
    AuthService,
    CsrfGuard,
    MfaService,
    PasswordService,
    PasswordVerifier,
    PermissionsGuard,
    SessionGuard,
    SessionService,
    UserTokenService,
  ],
  exports: [SessionService, SessionGuard, CsrfGuard, PermissionsGuard],
})
export class AuthModule {}
