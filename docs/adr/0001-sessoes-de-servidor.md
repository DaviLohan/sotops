# ADR 0001 — Sessões de servidor com token opaco, em vez de JWT

**Situação:** aceita · 2026-09-30

## Contexto

O requisito pede "estratégia segura para sessões, com cookies HttpOnly" e encerramento de sessões.
Suspender uma conta ou revogar um papel precisa valer imediatamente.

## Decisão

A sessão é uma linha no PostgreSQL. O cookie carrega um token aleatório de 256 bits; o banco guarda
apenas o SHA-256 dele. Cada requisição consulta a sessão e recalcula as permissões.

## Consequências

- Revogação imediata e listagem de sessões por dispositivo, sem lista de bloqueio paralela.
- Nada sensível no navegador além de um identificador opaco; não há chave de assinatura para vazar.
- Custo: uma consulta indexada por requisição — irrelevante na escala de uma federação. Se um dia
  pesar, o Redis já está disponível para cache.
- JWT ficaria mais barato por requisição, mas exigiria rotação de _refresh tokens_ e uma lista de
  revogação para atender aos mesmos requisitos, isto é, estado de servidor de qualquer forma.
