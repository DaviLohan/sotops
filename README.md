# Federação eFootball 1x1

Plataforma web para administrar uma federação de eFootball 1 contra 1: cadastro de participantes,
campeonatos, confrontos, resultados conferidos por OCR e confirmação do adversário, classificação e
histórico competitivo.

> **Estado do projeto: Fase 1 de 6 concluída** — fundação técnica, autenticação e permissões,
> design system e a estrutura dos três ambientes (portal, área do jogador, painel administrativo).
> Competições, partidas e OCR ainda não existem. O plano completo está em
> [`docs/10-plano-de-fases.md`](docs/10-plano-de-fases.md).

## O que já funciona

- Cadastro com verificação de e-mail, login, recuperação e troca de senha.
- Sessões em cookie HttpOnly, com listagem e encerramento por dispositivo.
- Verificação em duas etapas (TOTP) com códigos de recuperação — obrigatória para administradores.
- Papéis (superadministrador, administrador, organizador, árbitro, jogador) e permissões verificadas
  no backend.
- Painel administrativo: indicadores calculados do banco, gestão de usuários (papéis, suspensão) e
  trilha de auditoria somente de inserção.
- API REST versionada e documentada (OpenAPI).

## Requisitos

- Node.js 22.12+ e pnpm 10 (`corepack enable`)
- Docker com Docker Compose
- Python 3.11+ (apenas para o serviço de OCR)

## Primeiros passos (desenvolvimento)

```bash
cp .env.example .env            # Windows (PowerShell): Copy-Item .env.example .env
pnpm install
pnpm bootstrap                  # compila os contratos e gera o client do Prisma
pnpm infra:up                   # PostgreSQL, Redis, MinIO e Mailpit
pnpm db:deploy                  # aplica as migrations
pnpm db:seed                    # contas de demonstração
pnpm dev
```

| Endereço                       | O quê                                         |
| ------------------------------ | --------------------------------------------- |
| http://localhost:3000          | Aplicação                                     |
| http://localhost:3001/api/docs | Documentação interativa da API                |
| http://localhost:8025          | Mailpit — e-mails enviados em desenvolvimento |
| http://localhost:9001          | Console do MinIO                              |

### Contas de demonstração

Criadas pelo `pnpm db:seed`, todas com a senha `desenvolvimento-123`:

| Usuário       | Papéis               |
| ------------- | -------------------- |
| `superadmin`  | Superadministrador   |
| `admin`       | Administrador        |
| `organizador` | Organizador, Jogador |
| `arbitro`     | Árbitro              |
| `jogador1`    | Jogador              |
| `jogador2`    | Jogador              |

Contas administrativas precisam ativar a verificação em duas etapas no primeiro acesso (qualquer
aplicativo autenticador serve).

## Verificações

```bash
pnpm verify                     # lint, formatação, tipos e testes (unitários e de integração)
pnpm build && pnpm test:e2e     # testes end-to-end no navegador

# Primeira vez nos end-to-end (o --with-deps instala as bibliotecas do sistema e pede sudo):
pnpm --filter @efed/e2e exec playwright install --with-deps chromium
```

Os testes de integração e end-to-end usam bancos próprios (`efed_test` e `efed_e2e`), criados pelo
`pnpm infra:up` e recriados a cada execução. Eles nunca tocam no banco de desenvolvimento.

Serviço de OCR: veja [`services/ocr-service/README.md`](services/ocr-service/README.md).

## Produção

```bash
cp .env.example .env            # troque TODOS os segredos e defina PUBLIC_HOSTNAME
# coloque o certificado em infrastructure/nginx/certs (instruções na própria pasta)
docker compose up -d --build

# Primeiro superadministrador (a senha é pedida no terminal):
docker compose exec api node dist/scripts/create-super-admin.js \
  --email voce@dominio.com --username seu_usuario --name "Seu Nome"
```

A API se recusa a iniciar em produção com segredos de exemplo ou origens sem HTTPS. Somente o proxy
reverso publica portas; bancos e armazenamento ficam em uma rede interna. Backups:
[`infrastructure/backup/README.md`](infrastructure/backup/README.md).

## Documentação

| Documento                                                               | Conteúdo                                      |
| ----------------------------------------------------------------------- | --------------------------------------------- |
| [01 · Análise de requisitos](docs/01-analise-de-requisitos.md)          | Escopo, atores, riscos e decisões em aberto   |
| [02 · Arquitetura](docs/02-arquitetura.md)                              | Visão geral, fluxos e implantação             |
| [03 · Monorepositório](docs/03-monorepositorio.md)                      | Organização e dependências entre pacotes      |
| [04 · Módulos](docs/04-modulos.md)                                      | Diagrama e responsabilidades                  |
| [05 · Modelo de dados](docs/05-modelo-de-dados.md)                      | Entidades, relacionamentos e decisões         |
| [06 · Rotas do frontend](docs/06-rotas-frontend.md)                     | Mapa de telas por ambiente                    |
| [07 · Contratos da API](docs/07-contratos-api.md)                       | Convenções e endpoints                        |
| [08 · Estratégia de OCR](docs/08-estrategia-ocr.md)                     | Pipeline, confiança e antifraude              |
| [09 · Autenticação e segurança](docs/09-autenticacao-e-seguranca.md)    | Controles implementados e planejados          |
| [10 · Plano de fases](docs/10-plano-de-fases.md)                        | As seis fases e seus critérios de saída       |
| [11 · Fase 1: aceitação e testes](docs/11-fase-1-aceitacao-e-testes.md) | O que foi verificado e o que ficou pendente   |
| [Regras de negócio](docs/regras-de-negocio.md)                          | Regras implementadas, em linguagem de negócio |
| [Decisões (ADRs)](docs/adr)                                             | Registro das decisões técnicas                |

## Aviso

Projeto independente, sem vínculo com a Konami. eFootball é marca de sua respectiva titular; a
identidade visual da federação é original.
