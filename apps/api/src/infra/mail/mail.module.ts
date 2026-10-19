import { Global, Module } from '@nestjs/common';
import { Mailer } from './mailer.js';
import { SmtpMailer } from './smtp.mailer.js';

@Global()
@Module({
  providers: [{ provide: Mailer, useClass: SmtpMailer }],
  exports: [Mailer],
})
export class MailModule {}
