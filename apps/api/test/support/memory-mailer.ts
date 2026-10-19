import { type MailMessage, Mailer } from '../../src/infra/mail/mailer.js';

/** Substitui o SMTP nos testes e guarda as mensagens para inspeção. */
export class MemoryMailer extends Mailer {
  readonly outbox: MailMessage[] = [];

  async send(message: MailMessage): Promise<void> {
    this.outbox.push(message);
  }

  clear(): void {
    this.outbox.length = 0;
  }

  lastTo(email: string): MailMessage {
    const message = this.outbox.findLast((entry) => entry.to === email);
    if (!message) {
      throw new Error(`Nenhum e-mail enviado para ${email}.`);
    }
    return message;
  }

  /** Extrai o token do link contido no último e-mail enviado ao endereço. */
  tokenFor(email: string): string {
    const match = /[?&]token=([A-Za-z0-9_-]+)/.exec(this.lastTo(email).text);
    if (!match?.[1]) {
      throw new Error(`O último e-mail para ${email} não contém um token.`);
    }
    return match[1];
  }
}
