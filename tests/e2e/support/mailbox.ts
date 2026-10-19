import { expect } from '@playwright/test';
import { MAIL_API_URL } from './env.js';

interface ReceivedMail {
  to: string[];
  subject: string;
  text: string;
  receivedAt: string;
}

/** Aguarda o e-mail com o assunto informado e devolve o primeiro link contido nele. */
export async function linkFromMail(to: string, subject: string): Promise<string> {
  let link: string | undefined;
  await expect
    .poll(
      async () => {
        const response = await fetch(`${MAIL_API_URL}/?to=${encodeURIComponent(to)}`);
        const mails = (await response.json()) as ReceivedMail[];
        const mail = mails.findLast((entry) => entry.subject === subject);
        link = mail ? /https?:\/\/\S+/.exec(mail.text)?.[0] : undefined;
        return link;
      },
      { message: `e-mail "${subject}" para ${to}`, timeout: 15_000 },
    )
    .toBeDefined();
  return link as string;
}
