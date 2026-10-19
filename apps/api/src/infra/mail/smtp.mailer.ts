import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import nodemailer, { type Transporter } from 'nodemailer';
import { AppConfig } from '../../config/app-config.js';
import { type MailMessage, Mailer } from './mailer.js';

@Injectable()
export class SmtpMailer extends Mailer implements OnModuleDestroy {
  private readonly transporter: Transporter;
  private readonly from: string;

  constructor(config: AppConfig) {
    super();
    const { host, port, secure, user, password, from } = config.mail;
    this.from = from;
    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: user && password ? { user, pass: password } : undefined,
      connectionTimeout: 10_000,
      socketTimeout: 15_000,
    });
  }

  async send(message: MailMessage): Promise<void> {
    await this.transporter.sendMail({ from: this.from, ...message });
  }

  onModuleDestroy(): void {
    this.transporter.close();
  }
}
