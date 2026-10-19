# ADR 0003 — Design system dentro de `apps/web`, sem `packages/ui`

**Situação:** aceita · 2026-09-30 · revisitar quando houver um segundo consumidor

## Contexto

A estrutura sugerida previa `packages/ui`. Hoje só existe uma aplicação de interface.

## Decisão

Os componentes ficam em `apps/web/src/components/ui` e os tokens em `globals.css`. Seguem o modelo
do shadcn/ui (código do componente no projeto, sobre primitivos Radix), escritos à mão porque o
gerador do shadcn depende de um registro externo.

## Consequências

- Sem etapa de build nem configuração de transpilação para um pacote com um único consumidor.
- O Tailwind v4 enxerga as classes sem configuração adicional de _sources_.
- Se surgir outra aplicação de interface, a pasta é movida para `packages/ui` — os componentes não
  importam nada específico das rotas.
