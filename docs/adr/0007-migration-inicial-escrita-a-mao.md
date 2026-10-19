# ADR 0007 — Migration inicial escrita à mão

**Situação:** aceita · 2026-09-30 · **exige uma conferência na primeira execução local**

## Contexto

A Fase 1 foi desenvolvida em um ambiente cuja política de rede bloqueia `binaries.prisma.sh`, de
onde o Prisma baixa o motor de migrations. `prisma generate` funcionou (com o motor apontado para um
arquivo local); `prisma migrate dev` e `prisma migrate deploy` não puderam ser executados.

## Decisão

`prisma/migrations/20260930150000_init_identity_access_audit/migration.sql` foi escrita manualmente,
seguindo as convenções de nomes e tipos do Prisma, e aplicada diretamente no PostgreSQL 16 usado
pelos testes. Os testes de integração e end-to-end recriam o banco a partir desse arquivo, então o
SQL e o client gerado estão comprovadamente compatíveis.

## O que conferir

Na primeira vez, em uma máquina com acesso normal à internet:

```bash
pnpm infra:up
pnpm db:deploy        # deve aplicar 1 migration sem erro
pnpm db:migrate       # deve responder que não há alterações pendentes
```

Se o `db:migrate` propuser uma nova migration, há uma diferença de nomenclatura entre o SQL manual
e o que o Prisma geraria (por exemplo, o nome de um índice). Nesse caso, aceite a migration de
ajuste — ela não altera dados.

As partes do SQL que o Prisma não modela (CHECKs, triggers da auditoria, carga dos papéis) são
manuais por natureza e não entram nessa comparação.

## Consequência duradoura

Os testes aplicam as migrations pelo SQL (`test/support/global-setup.ts`), sem depender do CLI do
Prisma. Isso se mantém: é mais rápido e testa exatamente os arquivos que vão para produção.
