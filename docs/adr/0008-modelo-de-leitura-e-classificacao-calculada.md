# ADR 0008 — Modelo de leitura do portal e classificação calculada

**Situação:** aceita · 2026-09-30 · revisitar na Fase 5

## Contexto

A HOME do portal precisa mostrar competições, partidas, resultados, classificação, ranking e
notícias **sem dados fixos no código**. O repositório só tinha identidade, acesso e auditoria. O plano
(`docs/10`) previa essas tabelas nas Fases 2, 3 e 5.

## Decisão

1. Criar já o **subconjunto mínimo** de tabelas (ver `05`) e os endpoints públicos de leitura, sem
   motor de competição: partidas e resultados entram por seed até a Fase 3/5.
2. **Não criar tabelas de classificação, ranking ou estatística.** Elas são calculadas na hora, a
   partir de partidas com `status IN (HOMOLOGATED, WALKOVER)`, por funções puras e testadas
   (`modules/public/standings.ts`). Assim a tabela nunca diverge do resultado oficial.
3. **Placar só sai da API em resultado oficial.** Partida em confirmação ou análise aparece sem placar.
4. Critérios de desempate desta etapa: pontos, vitórias, saldo, gols pró, apelido. Confronto direto
   e critério administrativo (configuráveis por competição) ficam para o motor da Fase 5.
5. "Hoje", "amanhã" e "semana" usam o fuso `America/Sao_Paulo` (UTC-03:00, sem horário de verão).
6. Sem fotografia de banco de imagens no hero: a composição usa marcações do campo e o número da
   rodada em curso. Imagens de notícia e banner só são exibidas se forem caminhos do próprio site.

## Consequências

- Custo de leitura cresce com o número de partidas homologadas da temporada (uma consulta por bloco da
  HOME, com índices em `status`, `competition_id` e `homologated_at`). Quando isso pesar, a Fase 5
  materializa `standings`/`player_statistics`, mantidas de forma idempotente na homologação, e
  estas funções passam a servir de conferência ("reconstruir do zero deve bater com o incremental").
- Migration escrita à mão (ADR 0007) — conferir com `pnpm db:migrate` numa máquina com acesso ao motor.
