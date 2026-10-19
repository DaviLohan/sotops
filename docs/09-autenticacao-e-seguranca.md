# 09 · Autenticação e segurança

O que está **implementado e testado** na Fase 1, e o que está planejado.

## Autenticação

### Senhas

- **Argon2id** (19 MiB, 2 iterações, 1 via — mínimo recomendado pela OWASP). Os parâmetros ficam no
  próprio hash; ao endurecê-los, as senhas migram no próximo login bem-sucedido (`needsRehash`).
- Política por comprimento (10 a 128 caracteres), sem regras de composição, conforme NIST SP 800-63B.
- Tentativas contra contas inexistentes executam uma verificação Argon2id completa, para que o tempo
  de resposta não revele quem está cadastrado.

### Sessões

| Decisão                   | Implementação                                                                                            |
| ------------------------- | -------------------------------------------------------------------------------------------------------- |
| Tipo                      | Sessão de servidor com token opaco de 256 bits (não JWT — ver ADR 0001)                                  |
| Armazenamento             | O banco guarda apenas o SHA-256 do token; o cookie guarda o token                                        |
| Cookie                    | `HttpOnly`, `SameSite=Lax`, `Path=/`; em produção `Secure` e prefixo `__Host-`                           |
| Expiração por inatividade | 7 dias (jogadores) e 2 horas (papéis administrativos) — configurável                                     |
| Expiração absoluta        | 30 dias, nunca renovada                                                                                  |
| Encerramento              | Pelo usuário (uma ou todas as outras), na troca/redefinição de senha, na alteração do MFA e na suspensão |
| Revogação                 | Imediata: cada requisição consulta a sessão no banco                                                     |

### Verificação em duas etapas (MFA)

- **TOTP** (RFC 6238), compatível com qualquer aplicativo autenticador; implementação validada com os
  vetores de teste das RFCs 4226 e 6238.
- **Obrigatória para superadministradores e administradores**: sem MFA ativo, a conta não recebe
  nenhuma permissão administrativa (`MFA_ENROLLMENT_REQUIRED`), e o MFA não pode ser desativado
  enquanto o papel existir.
- Segredo cifrado em repouso (AES-256-GCM, vinculado ao usuário).
- Cada código vale **uma única vez** (o último passo aceito é registrado).
- 10 códigos de recuperação de uso único, armazenados como hash e exibidos uma só vez.
- Login em dois passos: a senha abre uma sessão **provisória** (10 minutos) que só alcança a rota do
  desafio; ao concluir, o token da sessão é trocado.
- Operações sensíveis (ativar/desativar MFA, gerar códigos, trocar senha) pedem a senha atual.

### Fluxos por e-mail

- Tokens de verificação (24 h) e de redefinição (30 min): aleatórios, de uso único, armazenados como
  hash, consumidos por `UPDATE` condicional (duas requisições simultâneas não são ambas aceitas).
- Um novo token invalida os anteriores do mesmo tipo.
- A confirmação de e-mail exige um clique na página: robôs que visitam links não consomem o token.
- Páginas que recebem token na URL usam `Referrer-Policy: no-referrer`.

### Proteção contra enumeração e força bruta

| Medida                                  | Detalhe                                                                          |
| --------------------------------------- | -------------------------------------------------------------------------------- |
| Respostas idênticas                     | Cadastro, recuperação de senha e reenvio respondem igual exista ou não a conta   |
| Estado da conta só após a senha correta | "E-mail não verificado" e "conta suspensa" não vazam a quem não conhece a senha  |
| Bloqueio progressivo                    | A partir de 5 falhas: 1, 2, 4… minutos, até 15; vale também para o segundo fator |
| Limite por IP (Redis)                   | 10/min nas rotas sensíveis de autenticação; 300/min no geral                     |
| Limite adicional no Nginx               | 30/min por IP nas rotas de autenticação                                          |

Concessão consciente: nomes de usuário são públicos (aparecem em tabelas e perfis), então o cadastro
informa quando um nome já está em uso, e o bloqueio temporário é informado mesmo sem a senha.

## Autorização

- **Negar por padrão**: toda rota exige sessão, salvo as marcadas com `@Public()`.
- **RBAC**: papel → permissões (`packages/shared/src/roles.ts`), verificadas por `PermissionsGuard`.
  As permissões são recalculadas do banco a cada requisição — revogar um papel vale na hora.
- **Políticas por recurso** (funções puras, testadas):
  - ninguém altera os próprios papéis ou a própria situação;
  - um ator só administra contas cujos papéis ele mesmo poderia conceder (administrador não altera
    administrador nem superadministrador);
  - administrador concede apenas organizador, árbitro e jogador;
  - a federação não pode ficar sem um superadministrador ativo;
  - sessões só podem ser encerradas pelo próprio dono.
- Informações de papel ou permissão enviadas pelo cliente são ignoradas.
- Identificador de outro usuário em rota "minha" responde `404`, sem confirmar a existência.

## Proteções de aplicação

| Ameaça                  | Controle                                                                                                         |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------- |
| CSRF                    | `SameSite=Lax` + verificação de `Origin`/`Referer` + token vinculado à sessão (HMAC) no cabeçalho `X-CSRF-Token` |
| XSS                     | React escapa por padrão; nenhum `dangerouslySetInnerHTML`; CSP; cookie inacessível ao JavaScript                 |
| Clickjacking            | `frame-ancestors 'none'` e `X-Frame-Options: DENY`                                                               |
| Injeção de SQL          | Prisma com consultas parametrizadas; SQL manual só com _template tags_ parametrizadas                            |
| Entrada malformada      | Validação Zod em toda entrada; corpo JSON limitado a 100 kB                                                      |
| Redirecionamento aberto | `?next=` aceita apenas caminhos internos                                                                         |
| Vazamento em erros      | Respostas genéricas para erros inesperados; detalhes só no log, com `requestId`                                  |
| Vazamento em logs       | Cookies, `Authorization` e token CSRF removidos; auditoria nunca grava credenciais (há teste)                    |
| CORS                    | Lista fechada de origens, com credenciais; em produção web e API compartilham a origem                           |
| Cabeçalhos              | Helmet na API (CSP `default-src 'none'`); cabeçalhos de segurança no web e HSTS no proxy                         |
| Configuração insegura   | Em produção a API não sobe com segredos de exemplo ou origens sem HTTPS                                          |
| IP falsificado          | O Nginx sobrescreve `X-Forwarded-For`; a API confia em exatamente um proxy                                       |

## Auditoria

- Eventos de autenticação, segurança e administração, com autor, recurso, IP, navegador e `requestId`.
- Gravados na **mesma transação** da alteração que descrevem.
- Tabela somente de inserção: `UPDATE`, `DELETE` e `TRUNCATE` bloqueados por trigger.
- Consulta restrita à permissão `audit.read`.

## Infraestrutura

- Só o proxy publica portas; PostgreSQL, Redis, MinIO e OCR ficam em rede interna sem saída.
- Contêineres de aplicação rodam sem privilégios de root.
- Segredos apenas por variáveis de ambiente; `.env` fora do controle de versão.
- Backups diários validados, com procedimento de restauração documentado.

## LGPD

| Princípio                 | Situação                                                                                        |
| ------------------------- | ----------------------------------------------------------------------------------------------- |
| Minimização               | Cadastro pede apenas e-mail, nome de usuário, nome de exibição e senha                          |
| Transparência             | Aviso de Privacidade descrevendo os dados realmente tratados; aceite com versão e data gravados |
| Segurança                 | Controles acima                                                                                 |
| Eliminação                | Modelo preparado para anonimização (nenhuma exclusão física); **fluxo ainda não implementado**  |
| Acesso e portabilidade    | **Não implementado** (exportação dos dados do titular)                                          |
| Retenção                  | Política proposta em `05`; **rotinas de expurgo não implementadas**                             |
| Controlador e encarregado | **A definir pela federação** (decisão D8)                                                       |

## Pendências de segurança (planejadas)

| Item                                                                                       | Fase |
| ------------------------------------------------------------------------------------------ | ---- |
| CSP com _nonce_ no web (hoje `script-src` permite `'unsafe-inline'`, exigido pelo Next.js) | 6    |
| Usuário de banco da aplicação distinto do dono do schema (reforça a auditoria imutável)    | 6    |
| Verificação de senhas vazadas (k-anonimato) no cadastro e na troca                         | 6    |
| Aviso por e-mail em login de novo dispositivo e em alteração de MFA                        | 5    |
| Envio de e-mail por fila, com novas tentativas (hoje: envio direto, falha só registrada)   | 5    |
| Expurgo de sessões e tokens antigos; exportação e anonimização de dados do titular         | 6    |
| Validação e antivírus de uploads; URLs temporárias para evidências                         | 4    |
| Renovação automática do certificado TLS                                                    | 6    |
| Teste de intrusão e revisão de dependências automatizada (SCA)                             | 6    |
