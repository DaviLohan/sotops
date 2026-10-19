# ADR 0002 — Schemas Zod como fonte única dos contratos

**Situação:** aceita · 2026-09-30

## Contexto

API e frontend precisam concordar sobre formatos e validações, e a API precisa ser documentada.
O caminho habitual no NestJS (classes com `class-validator`) não é reaproveitável no frontend.

## Decisão

Entradas e saídas são schemas Zod em `packages/shared`. A API valida com `ZodValidationPipe`; os
formulários usam os mesmos schemas com React Hook Form; o OpenAPI é gerado com `z.toJSONSchema`.

## Consequências

- Uma regra de validação muda em um lugar e vale nas duas pontas, com as mesmas mensagens.
- Tipos do frontend são inferidos dos schemas: contrato e tipo não divergem.
- Sem `class-validator`, `class-transformer` ou bibliotecas de ponte: menos dependências.
- O Swagger é alimentado por decoradores próprios (`ApiZodBody`, `ApiZodResponse`), que precisam
  ser lembrados em cada rota — coberto pela convenção descrita no `CLAUDE.md`.
