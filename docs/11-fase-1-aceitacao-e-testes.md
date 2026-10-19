# 11 · Fase 1 — critérios de aceitação e resultado dos testes

Verificação executada em 30/09/2026, em Linux, com Node.js 22.22, PostgreSQL 16 e Redis 7 reais
(sem dublês de banco).

## Resumo

| Verificação                        | Comando                           | Resultado                      |
| ---------------------------------- | --------------------------------- | ------------------------------ |
| Lint (ESLint)                      | `pnpm lint`                       | ✅ 0 erros, 0 avisos           |
| Formatação (Prettier)              | `pnpm format:check`               | ✅                             |
| Tipos (TypeScript estrito)         | `pnpm typecheck`                  | ✅ 4 pacotes                   |
| Contratos compartilhados           | `pnpm --filter @efed/shared test` | ✅ 12 testes                   |
| API — unitários e integração       | `pnpm --filter @efed/api test`    | ✅ 107 testes (13 arquivos)    |
| Web — unitários e componentes      | `pnpm --filter @efed/web test`    | ✅ 17 testes                   |
| End-to-end no navegador (Chromium) | `pnpm test:e2e`                   | ✅ 10 cenários                 |
| Serviço de OCR                     | `pytest` · `ruff check`           | ✅ 3 testes · sem apontamentos |
| Build de produção                  | `pnpm build`                      | ✅ API, web e contratos        |
| Sintaxe dos arquivos Compose       | `docker compose config`           | ✅ desenvolvimento e produção  |

**149 testes automatizados, todos passando.**

## O que não pôde ser verificado

Limitações do ambiente em que a fase foi desenvolvida — não do código. Precisam ser executadas uma
vez na máquina de desenvolvimento:

| Item                                    | Por quê                                             | Como conferir                                              |
| --------------------------------------- | --------------------------------------------------- | ---------------------------------------------------------- |
| Subida dos contêineres (dev e produção) | Não havia daemon do Docker                          | `pnpm infra:up`; depois `docker compose up -d --build`     |
| Build das imagens (`Dockerfile`)        | Idem                                                | Incluído no comando acima                                  |
| `prisma migrate deploy` / `migrate dev` | Download do motor de migrations bloqueado pela rede | `pnpm db:deploy` e `pnpm db:migrate` — ver ADR 0007        |
| Envio real por SMTP externo             | Sem provedor configurado                            | Em desenvolvimento, conferir no Mailpit (`localhost:8025`) |
| Nginx com TLS                           | Depende do Docker e de certificado                  | `infrastructure/nginx/certs/README.md`                     |
| Execução no Windows                     | Desenvolvido em Linux                               | Os scripts `pnpm` não usam comandos específicos de shell   |

O que foi feito para reduzir esse risco: o pacote de produção da API (`pnpm deploy`) e o build
autocontido do web foram montados e executados fora do Docker com a mesma estrutura que os
`Dockerfile` usam; a API em modo produção foi conferida (cookie `__Host-` com `Secure`, HSTS,
documentação desligada, recusa de segredos de exemplo); a migration foi aplicada em PostgreSQL 16 e
é exercitada por todos os testes de integração; o adaptador SMTP é exercitado nos end-to-end contra
um servidor SMTP local.

## Critérios de aceitação da Fase 1

### Fundação

| Critério                                                                         | Evidência                                             | Situação                                     |
| -------------------------------------------------------------------------------- | ----------------------------------------------------- | -------------------------------------------- |
| Monorepositório com API, web, contratos e serviço de OCR                         | Estrutura em `03`                                     | ✅                                           |
| Ambiente de desenvolvimento reproduzível e documentado                           | `README.md`, `.env.example`, `docker-compose.dev.yml` | ✅ ⚠️ subida do Docker não executada         |
| Pilha de produção com health checks, volumes, redes internas, reinício e backups | `docker-compose.yml`, `infrastructure/`               | ✅ ⚠️ idem                                   |
| Banco alterado somente por migrations versionadas                                | `apps/api/prisma/migrations`                          | ✅ ⚠️ ADR 0007                               |
| Nenhuma credencial no código; configuração insegura barrada em produção          | `env.spec.ts`                                         | ✅                                           |
| API REST versionada, com erros e respostas consistentes, e documentada (OpenAPI) | `07`, `docs/openapi.json`, `health.test.ts`           | ✅                                           |
| Logs estruturados com identificador de requisição                                | `app.module.ts`, `health.test.ts`                     | ✅                                           |
| Documentação de arquitetura, dados, regras, contratos e decisões; `CLAUDE.md`    | `docs/`, `CLAUDE.md`                                  | ✅                                           |
| Integração contínua                                                              | `.github/workflows/ci.yml`                            | ✅ ⚠️ não executada (sem repositório remoto) |

### Autenticação e permissões

| Critério                                                                   | Evidência (teste)                                     | Situação |
| -------------------------------------------------------------------------- | ----------------------------------------------------- | -------- |
| Cadastro com verificação de e-mail; login bloqueado até verificar          | `registration.test.ts`, e2e `01-conta`                | ✅       |
| Senhas com Argon2id; nunca em texto puro                                   | `crypto.spec.ts`, `registration.test.ts`              | ✅       |
| Cookie HttpOnly, SameSite, Secure em produção; token só como hash no banco | `sessions.test.ts`, `env.spec.ts`                     | ✅       |
| Recuperação de senha com token de uso único; sessões encerradas            | `password.test.ts`, e2e `01-conta`                    | ✅       |
| Encerramento de sessões (uma, as outras, por expiração)                    | `sessions.test.ts`                                    | ✅       |
| MFA (TOTP) obrigatório para administradores; códigos de recuperação        | `mfa.test.ts`, `totp.spec.ts`, e2e `02-administracao` | ✅       |
| Sem enumeração de contas; bloqueio progressivo; limite por IP              | `registration`, `sessions`, `password`, `rate-limit`  | ✅       |
| Proteção contra CSRF                                                       | `csrf.test.ts`                                        | ✅       |
| Permissões verificadas no backend; dados de permissão do cliente ignorados | `rbac.test.ts`                                        | ✅       |
| RBAC + políticas por recurso                                               | `rbac.test.ts`, `user-admin.policy.spec.ts`           | ✅       |
| Ações administrativas auditadas; auditoria imutável                        | `rbac.test.ts`, `audit-integrity.test.ts`             | ✅       |

### Design system e ambientes

| Critério                                                                               | Evidência                                     | Situação                |
| -------------------------------------------------------------------------------------- | --------------------------------------------- | ----------------------- |
| Paleta definida em tokens semânticos; nenhum hexadecimal em componente                 | `globals.css`                                 | ✅                      |
| Componentes reutilizáveis com estados (carregando, vazio, erro, desabilitado, foco)    | `components/ui`, testes de componente         | ✅                      |
| Três ambientes com estruturas próprias: portal, área do jogador, painel administrativo | `06`; conferência visual em 1440 px e 390 px  | ✅                      |
| Dashboard administrativo com indicadores reais do banco                                | `rbac.test.ts` ("calcula os indicadores…")    | ✅                      |
| Nenhum botão sem função; nenhum dado simulado fora de seed e testes                    | Revisão do código; menu lista só o que existe | ✅                      |
| Responsivo; navegável por teclado; rótulos e erros associados aos campos               | Conferência visual; `form-field.test.tsx`     | ✅ parcial — ver abaixo |

## O que os testes cobrem

| Conjunto                         | Testes | Destaques                                                                                   |
| -------------------------------- | ------ | ------------------------------------------------------------------------------------------- |
| `shared` — papéis e schemas      | 12     | Mapa papel→permissão; normalização de e-mail/usuário; limites de paginação                  |
| API — TOTP                       | 8      | Vetores das RFCs 4226 e 6238; janela de tolerância; recusa de reuso                         |
| API — criptografia               | 10     | Argon2id; cifra autenticada (chave, contexto e adulteração); tokens; códigos de recuperação |
| API — configuração               | 5      | Recusa de segredos de exemplo e de origens sem HTTPS em produção                            |
| API — políticas de administração | 7      | Quem pode administrar quem; quem concede o quê                                              |
| API — saúde e erros              | 5      | Readiness; problem details; JSON malformado; corpo acima do limite                          |
| API — cadastro                   | 11     | Verificação, reuso e expiração de token, enumeração, validação, auditoria                   |
| API — sessões                    | 10     | Cookie, bloqueio, logout, expiração, encerramento, isolamento entre contas                  |
| API — CSRF                       | 7      | Token ausente, de outra sessão, origem estranha, origem ausente                             |
| API — senha                      | 9      | Redefinição, uso único, **concorrência**, tipo de token, desbloqueio, troca                 |
| API — MFA                        | 10     | Cadastro, sessão provisória, troca de token, reuso, recuperação, bloqueio                   |
| API — permissões e administração | 20     | Acesso, listagem, papéis, suspensão, auditoria, indicadores                                 |
| API — integridade                | 4      | Auditoria imutável; sem exclusão física; CHECKs; ausência de segredos nos metadados         |
| API — limite de requisições      | 1      | Limite por IP nas rotas de autenticação, com `Retry-After`                                  |
| Web — unitários e componentes    | 17     | Formatação, erros da API, redirecionamento seguro, acessibilidade de campo e botão          |
| End-to-end                       | 10     | Cadastro→e-mail→login; redefinição de senha; MFA; suspensão; auditoria                      |
| OCR                              | 3      | Saúde; documentação desligada; nenhuma rota de reconhecimento                               |

## Problemas encontrados durante a fase (e corrigidos)

| Problema                                                                                        | Correção                                                     |
| ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| O erro do gatilho da auditoria era apresentado pelo Prisma como "violação de chave estrangeira" | Trocado o código SQLSTATE do gatilho                         |
| Classes `text-display`/`text-eyebrow` eram descartadas pelo `tailwind-merge`                    | Renomeadas para `type-*`                                     |
| O endereço da API nos _rewrites_ do Next.js era fixado no build                                 | Encaminhamento movido para `proxy.ts`, resolvido em execução |
| `Retry-After` saía como `Retry-After-auth` no limite de autenticação                            | Cabeçalho padrão publicado pelo filtro de erros              |
| JSON malformado e corpo grande respondiam `500`                                                 | Tratados como erro do cliente (`400`/`413`), com teste       |
| Modal de MFA piscava ao trocar de passo                                                         | Um único modal para todos os passos                          |
| Tabela de usuários ilegível em 390 px                                                           | Colunas secundárias viram selos na primeira coluna           |

## Pendências conhecidas

Nenhuma é falha crítica; todas estão atribuídas a uma fase.

| Pendência                                                                                                                   | Fase                      |
| --------------------------------------------------------------------------------------------------------------------------- | ------------------------- |
| Executar as verificações listadas em "O que não pôde ser verificado"                                                        | agora                     |
| Auditoria de acessibilidade automatizada (axe) e teste com leitor de tela; hoje a verificação é por construção e amostragem | 6                         |
| Páginas do portal além do início e do aviso de privacidade (dependem dos módulos)                                           | 2–5                       |
| Organizador e árbitro ainda sem permissões próprias e sem escopo por competição                                             | 3, 5                      |
| Envio de e-mail sem fila: uma falha de SMTP é registrada em log, e o usuário precisa pedir reenvio                          | 5                         |
| Texto jurídico do Aviso de Privacidade; controlador e encarregado                                                           | antes de abrir ao público |
| CSP do web com `'unsafe-inline'`; demais itens de `09` (pendências de segurança)                                            | 6                         |
| Imagem de produção da API com ~380 MB de dependências (o `@prisma/client` traz o CLI como par)                              | 6                         |
| Sem expurgo de sessões e tokens antigos                                                                                     | 6                         |
| Renovação automática de TLS; backup externo; métricas e alertas                                                             | 6                         |

## Etapa A — ambiente e saúde (19/10/2026)

Executada na máquina de desenvolvimento (WSL 2 + Docker Desktop), cobrindo as verificações que
dependiam do Docker. Decisões em `adr/0009-minio-no-readiness.md`.

| Verificação                                 | Resultado                                       |
| ------------------------------------------- | ----------------------------------------------- |
| `pnpm infra:up` (PostgreSQL, Redis, MinIO…) | ✅ todos saudáveis                              |
| `prisma migrate deploy` em banco vazio      | ✅ 2 migrations aplicadas; seed em seguida      |
| `prisma migrate deploy` em banco já semeado | ✅ nada pendente; seed repetido não duplica     |
| `pnpm verify`                               | ✅ 158 testes (shared 12 · web 21 · API 125)    |
| `pnpm build`                                | ✅                                              |
| `pnpm test:e2e`                             | ✅ 16 cenários                                  |
| `/api/health/ready` com o MinIO fora do ar  | ✅ `503`, `storage: down` (teste de integração) |

Entrou nesta etapa: sonda do MinIO e limite de 2 s por sonda no readiness; variável `S3_ENDPOINT`;
imagem do MinIO fixada; MinIO na CI; `playwright install --with-deps` no README.

Problemas encontrados: o `.env` não existia (a subida falha com mensagem clara, e o README já manda
copiar o `.env.example`); `minio/minio:latest` não é mais publicada; o Chromium do Playwright
precisava das bibliotecas do sistema (`install-deps`, com sudo).

Não verificado: a CI (não há repositório remoto) e a pilha de produção (`docker compose up` com
`docker-compose.yml`).

Observação: durante os e2e, o servidor web registra `The destination stream closed early` quando o
navegador abandona uma página ainda em streaming. Nenhum teste falha por isso; revisar na Etapa F,
junto com o critério "sem erro de console".

## Situação

**Fase 1 concluída**, sem falhas críticas abertas. A Fase 2 pode começar depois que as verificações
dependentes de Docker forem executadas e as decisões D2, D3 e D10 (`01`, §6) estiverem fechadas.
