import type { MailMessage } from './mailer.js';

const BRAND = 'Federação eFootball';

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

interface Layout {
  to: string;
  subject: string;
  greetingName: string;
  paragraphs: string[];
  action?: { label: string; url: string };
  footnote?: string;
}

function render({ to, subject, greetingName, paragraphs, action, footnote }: Layout): MailMessage {
  const textLines = [`Olá, ${greetingName}.`, '', ...paragraphs];
  if (action) {
    textLines.push('', `${action.label}: ${action.url}`);
  }
  if (footnote) {
    textLines.push('', footnote);
  }
  textLines.push('', `— ${BRAND}`);

  const htmlParagraphs = paragraphs
    .map((paragraph) => `<p style="margin:0 0 16px">${escapeHtml(paragraph)}</p>`)
    .join('');
  const htmlAction = action
    ? `<p style="margin:24px 0"><a href="${escapeHtml(action.url)}" style="background:#F5F500;color:#080B20;font-weight:700;text-decoration:none;padding:12px 20px;border-radius:8px;display:inline-block">${escapeHtml(action.label)}</a></p>
       <p style="margin:0 0 16px;font-size:13px;color:#A8B1C7">Se o botão não funcionar, copie este endereço:<br>${escapeHtml(action.url)}</p>`
    : '';
  const htmlFootnote = footnote
    ? `<p style="margin:24px 0 0;font-size:13px;color:#A8B1C7">${escapeHtml(footnote)}</p>`
    : '';

  const html = `<!doctype html>
<html lang="pt-BR">
  <body style="margin:0;background:#080B20;font-family:Arial,Helvetica,sans-serif;color:#FFFFFF">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px">
      <tr><td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#111936;border-radius:12px;padding:32px">
          <tr><td style="font-size:15px;line-height:1.6">
            <p style="margin:0 0 24px;font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:#F5F500;font-weight:700">${BRAND}</p>
            <p style="margin:0 0 16px">Olá, ${escapeHtml(greetingName)}.</p>
            ${htmlParagraphs}${htmlAction}${htmlFootnote}
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;

  return { to, subject, text: textLines.join('\n'), html };
}

interface Recipient {
  email: string;
  displayName: string;
}

export function emailVerificationMessage(recipient: Recipient, url: string): MailMessage {
  return render({
    to: recipient.email,
    subject: 'Confirme seu e-mail',
    greetingName: recipient.displayName,
    paragraphs: ['Recebemos seu cadastro. Para ativar a conta, confirme que este e-mail é seu.'],
    action: { label: 'Confirmar e-mail', url },
    footnote: 'O link vale por 24 horas. Se você não criou esta conta, ignore esta mensagem.',
  });
}

export function alreadyRegisteredMessage(recipient: Recipient, loginUrl: string): MailMessage {
  return render({
    to: recipient.email,
    subject: 'Você já tem uma conta',
    greetingName: recipient.displayName,
    paragraphs: [
      'Alguém tentou criar uma conta com este e-mail, mas ele já está cadastrado.',
      'Se foi você, basta entrar normalmente. Caso tenha esquecido a senha, use a opção de recuperação na tela de entrada.',
    ],
    action: { label: 'Entrar', url: loginUrl },
    footnote: 'Se não foi você, nenhuma ação é necessária: sua conta continua protegida.',
  });
}

export function passwordResetMessage(recipient: Recipient, url: string): MailMessage {
  return render({
    to: recipient.email,
    subject: 'Redefinição de senha',
    greetingName: recipient.displayName,
    paragraphs: ['Recebemos um pedido para redefinir a senha da sua conta.'],
    action: { label: 'Criar nova senha', url },
    footnote:
      'O link vale por 30 minutos e só pode ser usado uma vez. Se você não fez este pedido, ignore esta mensagem.',
  });
}

export function passwordChangedMessage(recipient: Recipient): MailMessage {
  return render({
    to: recipient.email,
    subject: 'Sua senha foi alterada',
    greetingName: recipient.displayName,
    paragraphs: [
      'A senha da sua conta acaba de ser alterada e as demais sessões foram encerradas.',
      'Se não foi você, redefina a senha imediatamente e avise a administração da federação.',
    ],
  });
}
