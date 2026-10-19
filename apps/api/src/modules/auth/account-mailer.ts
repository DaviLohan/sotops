import { Injectable, Logger } from '@nestjs/common';
import { DEFAULT_FEDERATION_NAME } from '@efed/shared';
import { AppConfig } from '../../config/app-config.js';
import { type MailMessage, Mailer } from '../../infra/mail/mailer.js';
import {
  alreadyRegisteredMessage,
  emailVerificationMessage,
  passwordChangedMessage,
  passwordResetMessage,
} from '../../infra/mail/templates.js';
import { SettingsService } from '../settings/settings.service.js';

interface Recipient {
  email: string;
  displayName: string;
}

/**
 * E-mails transacionais da conta. Uma falha de envio é registrada e não derruba a operação:
 * o usuário pode pedir o reenvio, e a resposta da API não revela se o endereço existe.
 * (A Fase 5 move o envio para a fila de notificações, com novas tentativas.)
 */
@Injectable()
export class AccountMailer {
  private readonly logger = new Logger(AccountMailer.name);

  constructor(
    private readonly mailer: Mailer,
    private readonly config: AppConfig,
    private readonly settings: SettingsService,
  ) {}

  sendEmailVerification(recipient: Recipient, token: string): Promise<void> {
    const url = `${this.config.publicWebUrl}/verificar-email?token=${encodeURIComponent(token)}`;
    return this.deliver('verificação de e-mail', (brand) =>
      emailVerificationMessage(recipient, url, brand),
    );
  }

  sendAlreadyRegistered(recipient: Recipient): Promise<void> {
    const url = `${this.config.publicWebUrl}/entrar`;
    return this.deliver('aviso de conta existente', (brand) =>
      alreadyRegisteredMessage(recipient, url, brand),
    );
  }

  sendPasswordReset(recipient: Recipient, token: string): Promise<void> {
    const url = `${this.config.publicWebUrl}/redefinir-senha?token=${encodeURIComponent(token)}`;
    return this.deliver('redefinição de senha', (brand) =>
      passwordResetMessage(recipient, url, brand),
    );
  }

  sendPasswordChanged(recipient: Recipient): Promise<void> {
    return this.deliver('aviso de senha alterada', (brand) =>
      passwordChangedMessage(recipient, brand),
    );
  }

  private async deliver(kind: string, build: (brand: string) => MailMessage): Promise<void> {
    try {
      const brand = await this.settings
        .get()
        .then((settings) => settings.federationName)
        .catch(() => DEFAULT_FEDERATION_NAME);
      await this.mailer.send(build(brand));
    } catch (error) {
      this.logger.error({ err: error, kind }, 'Falha ao enviar e-mail transacional');
    }
  }
}
