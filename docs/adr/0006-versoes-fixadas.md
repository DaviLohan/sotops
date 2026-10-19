# ADR 0006 — Versões fixadas por compatibilidade

**Situação:** aceita · 2026-09-30 · revisitar a cada fase

Todas as dependências são instaladas em versão exata (`save-exact`). Três merecem registro porque
**não** são a versão mais recente, de propósito:

| Pacote        | Fixado em | Mais recente na data | Motivo                                                                                                                                     |
| ------------- | --------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `typescript`  | 6.0.3     | 7.0.2                | `typescript-eslint` aceita `<6.1.0` e `@nestjs/swagger` aceita `^5.5 \|\| ^6.0`. Atualizar quando ambos suportarem o 7.                    |
| `prisma`      | 7.10.0    | 8.0.0-rc.19          | A etiqueta `latest` do CLI aponta para um _release candidate_; o `@prisma/client` estável é 7.10.0. CLI e client precisam da mesma versão. |
| `@types/node` | 22.x      | 26.x                 | Acompanha a versão do Node.js em uso (22 LTS).                                                                                             |

Outras observações de compatibilidade verificadas:

- **NestJS 12 é ESM.** A API usa `"type": "module"` e importações relativas com `.js`.
- **`@nest-lab/throttler-storage-redis`** não declara suporte ao NestJS 12; o armazenamento do limite
  de requisições no Redis é próprio (`redis-throttler.storage.ts`, um script Lua atômico).
- **Vitest 5** transpila decoradores com metadados nativamente; não foi preciso SWC.
- **TanStack Table 9** mudou a API (`useTable`, `tableFeatures`); exemplos da versão 8 não servem.
- **Next.js 16**: `middleware.ts` passou a se chamar `proxy.ts`.
