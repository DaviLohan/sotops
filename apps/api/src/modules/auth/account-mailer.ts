import { Injectable, Logger } from '@nestjs/common';
import { AppConfig } from '../../config/app-config.js';
import { type MailMessage, Mailer } from '../../infra/mail/mailer.js';
import {
  alreadyRegisteredMessage,
  emailVerificationMessage,
  passwordChangedMessage,
  passwordResetMessage,
} from '../../infra/mail/templates.js';

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
  ) {}

  sendEmailVerification(recipient: Recipient, token: string): Promise<void> {
    const url = `${this.config.publicWebUrl}/verificar-email?token=${encodeURIComponent(token)}`;
    return this.deliver('verificação de e-mail', emailVerificationMessage(recipient, url));
  }

  sendAlreadyRegistered(recipient: Recipient): Promise<void> {
    const url = `${this.config.publicWebUrl}/entrar`;
    return this.deliver('aviso de conta existente', alreadyRegisteredMessage(recipient, url));
  }

  sendPasswordReset(recipient: Recipient, token: string): Promise<void> {
    const url = `${this.config.publicWebUrl}/redefinir-senha?token=${encodeURIComponent(token)}`;
    return this.deliver('redefinição de senha', passwordResetMessage(recipient, url));
  }

  sendPasswordChanged(recipient: Recipient): Promise<void> {
    return this.deliver('aviso de senha alterada', passwordChangedMessage(recipient));
  }

  private async deliver(kind: string, message: MailMessage): Promise<void> {
    try {
      await this.mailer.send(message);
    } catch (error) {
      this.logger.error({ err: error, kind }, 'Falha ao enviar e-mail transacional');
    }
  }
}
