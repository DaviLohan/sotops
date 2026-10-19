export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}

/** Porta de envio de e-mail. A implementação SMTP é trocada por uma em memória nos testes. */
export abstract class Mailer {
  abstract send(message: MailMessage): Promise<void>;
}
