# Federação eFootball 1x1 — guia para o Claude Code

Plataforma de gestão de uma federação de eFootball 1 contra 1: portal público, área do jogador,
painel administrativo, motor de competições e central de resultados por OCR.

**Estado:** Fase 1 (fundação) e Fase 2 (gestão: perfil, clubes, transferências, portal de jogadores
e clubes, conteúdo) concluídas, seguindo as etapas de `docs/13`. Próxima: **Etapa C (competições,
Fase 3)**. Antes de qualquer trabalho, leia `docs/10-plano-de-fases.md` e
`docs/14-aceitacao-sistema-funcional.md` (o que está verificado e o que ficou pendente por etapa).

## Mapa do repositório

| Caminho                | O que é                                                                        |
| ---------------------- | ------------------------------------------------------------------------------ |
| `apps/api`             | API REST (NestJS 12, ESM). Prisma 7 + PostgreSQL. Testes com Vitest.           |
| `apps/web`             | Next.js 16 (App Router), Tailwind v4, componentes próprios sobre Radix.        |
| `packages/shared`      | Contratos: papéis, permissões, schemas Zod (entrada e saída), códigos de erro. |
| `packages/config`      | `tsconfig` base.                                                               |
| `services/ocr-service` | FastAPI. Hoje só a fundação; o reconhecimento é da Fase 4.                     |
| `tests/e2e`            | Playwright contra os builds de produção.                                       |
| `infrastructure`       | Nginx, backup, init do PostgreSQL, monitoramento.                              |
| `docs`                 | Arquitetura, modelo de dados, contratos, regras e decisões (ADRs).             |

## Comandos

```bash
pnpm install && pnpm bootstrap   # instala, compila @efed/shared e gera o client Prisma
pnpm infra:up                    # PostgreSQL, Redis, MinIO e Mailpit (Docker)
pnpm db:deploy && pnpm db:seed   # aplica migrations e cria contas de demonstração
pnpm dev                         # API em :3001, web em :3000

pnpm verify                      # lint + formatação + tipos + testes (rode antes de concluir)
pnpm build && pnpm test:e2e      # end-to-end (exige infra no ar)
```

Testes da API usam o banco `efed_test`; os end-to-end usam `efed_e2e`. Ambos são recriados a cada
execução a partir de `apps/api/prisma/migrations`. Para apontar para outra instância:
`TEST_DATABASE_URL`, `TEST_REDIS_URL`, `E2E_DATABASE_URL`, `E2E_REDIS_URL`.

## Regras que não se negociam

1. **Autorização é do backend.** Toda rota é autenticada por padrão (`SessionGuard` global); rota
   pública exige `@Public()`. Permissões via `@RequirePermissions()`; regras por recurso ficam em
   funções de política puras (ex.: `user-admin.policy.ts`). O frontend só esconde o que a API já nega.
2. **Banco só muda por migration.** Nunca edite uma migration aplicada; crie outra. Restrições que o
   Prisma não expressa (CHECK, triggers) vão no SQL da migration, com comentário.
3. **Nada de exclusão física de histórico.** Usuários, resultados oficiais e auditoria não são
   apagados; FKs usam `ON DELETE RESTRICT`. `audit_logs` é somente de inserção (trigger).
4. **Operações críticas são transacionais e idempotentes.** Mudança de estado usa UPDATE condicional
   (`WHERE estado = anterior`) e confere a contagem; auditoria grava na mesma transação.
5. **Segredos nunca em texto puro nem em log.** Tokens e códigos: só o SHA-256 no banco. Senhas:
   Argon2id. Segredo TOTP: AES-256-GCM. Metadados de auditoria nunca carregam credenciais.
6. **Um contrato, uma fonte.** Entrada e saída da API são schemas Zod em `packages/shared`; a API
   valida com eles, o frontend tipa e valida formulários com eles, e o OpenAPI é gerado deles.
7. **Sem dados simulados fora de seed e testes.** Nenhuma tela mostra número fixo ou lista fictícia.
   Módulo que ainda não existe não aparece no menu.
8. **Sem atalhos para o verde.** Não desative guard, validação ou teste para fazer algo passar.
9. **OCR não homologa.** O serviço de OCR devolve dados e confiança; resultado oficial é decisão da API.

## Convenções

- **Idioma:** interface, mensagens de erro, comentários e documentação em português; identificadores
  de código em inglês.
- **API (ESM):** importações relativas terminam em `.js`. Classes injetadas pelo NestJS são
  importadas como valor (não `import type`). Erros de domínio: `throw new AppError('CODIGO')` — o
  status HTTP e o título saem do código (`app-error.ts`). Respostas: `{ data }` ou `{ data, meta }`.
- **Novo endpoint:** schema Zod em `shared` → `ZodValidationPipe` → decoradores `ApiZod*` →
  teste de integração (caminho feliz, permissão negada, validação).
- **Novo código de erro:** adicione em `packages/shared/src/errors.ts` e em `app-error.ts`.
- **Novo evento de auditoria:** adicione ao tipo `AuditAction` e ao mapa de rótulos em
  `apps/web/src/lib/labels.ts`.
- **Frontend:** Server Components buscam com `serverGet`; componentes cliente usam `useApi()` +
  TanStack Query. Cores apenas pelos tokens semânticos de `globals.css` (`bg-surface`, `text-fg-muted`…);
  nunca um hexadecimal em componente. O amarelo (`accent`) é só para a ação principal e destaques.
  Utilitários tipográficos próprios começam com `type-` (`type-display`, `type-eyebrow`) — o prefixo
  `text-` conflita com o `tailwind-merge`.
- **Portal:** componentes esportivos em `components/sport` (placar, linha de partida, classificação,
  emblema de clube) e blocos da HOME em `components/portal`. Escala tipográfica: `type-xxl`, `type-xl`,
  `type-h1`…`type-caption`, `type-score`, `type-stat` (tamanho) + `type-display` (família condensada).
  Datas do portal sempre pelo fuso da federação (`lib/portal.ts`). Dados públicos: `publicGet`.
  Classificação/ranking são **calculados** de partidas homologadas (`modules/public/standings.ts`).
- **Seeds:** `prisma/seed.ts` (contas) e `prisma/seed-portal.ts` (clubes, jogadores, competições,
  resultados e notícias fictícios, com datas relativas a "agora"). Só desenvolvimento e e2e.
- **Next.js 16:** o antigo `middleware.ts` chama-se `proxy.ts`. Consulte `apps/web/AGENTS.md` e a
  documentação em `node_modules/next/dist/docs/` antes de usar APIs de que não tenha certeza.
- **TanStack Table v9:** `useTable` + `tableFeatures`; há guias em
  `node_modules/@tanstack/react-table/skills/`.
- **Versões fixadas de propósito** (ver `docs/adr/0006-versoes-fixadas.md`): TypeScript 6.0.x e
  Prisma 7.10.0. Não atualize sem conferir as compatibilidades descritas lá.

## Ao terminar uma tarefa

Rode `pnpm verify` (e os end-to-end quando mexer em fluxo de usuário), atualize o documento
correspondente em `docs/` e registre decisões relevantes como um novo ADR em `docs/adr/`.
Não declare uma etapa concluída sem ter executado as verificações — e diga claramente o que não
pôde ser verificado.
