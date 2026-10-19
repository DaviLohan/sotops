// Servidor SMTP de teste: recebe os e-mails enviados pela API e os expõe por HTTP,
// para que os testes sigam os links exatamente como um usuário faria.
import { createServer } from 'node:http';
import { simpleParser } from 'mailparser';
import { SMTPServer } from 'smtp-server';

const smtpPort = Number(process.env.SMTP_PORT);
const httpPort = Number(process.env.MAIL_API_PORT);
const messages = [];

const smtp = new SMTPServer({
  authOptional: true,
  disabledCommands: ['STARTTLS'],
  onData(stream, _session, callback) {
    simpleParser(stream)
      .then((mail) => {
        messages.push({
          to: mail.to?.value.map((entry) => entry.address) ?? [],
          subject: mail.subject ?? '',
          text: mail.text ?? '',
          receivedAt: new Date().toISOString(),
        });
        callback();
      })
      .catch(callback);
  },
});
smtp.listen(smtpPort, '127.0.0.1');

createServer((request, response) => {
  const url = new URL(request.url ?? '/', 'http://localhost');
  const to = url.searchParams.get('to');
  const body = to ? messages.filter((message) => message.to.includes(to)) : messages;
  response.writeHead(200, { 'Content-Type': 'application/json' });
  response.end(JSON.stringify(body));
}).listen(httpPort, '127.0.0.1', () => {
  console.log(`Caixa de e-mails de teste: SMTP ${smtpPort}, HTTP ${httpPort}`);
});
