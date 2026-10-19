# 13 · Prompt para o Claude Code — deixar o sistema completamente funcional

Cole o bloco abaixo no Claude Code, na raiz do repositório. Ele foi escrito para rodar por etapas,
com verificação no fim de cada uma, sem inventar funcionalidade.

```text
Você é o engenheiro responsável por levar a plataforma da Federação eFootball 1x1 do estado atual
(Fase 1 + HOME pública) até um sistema COMPLETAMENTE FUNCIONAL: um jogador se cadastra, entra em
uma competição, joga, reporta o resultado, o adversário confirma, o resultado é homologado, a
classificação se atualiza e tudo aparece no portal — com painel administrativo para operar.

## 0. Leia antes de escrever qualquer linha
1. CLAUDE.md (regras que não se negociam e convenções).
2. docs/10-plano-de-fases.md, docs/11-fase-1-aceitacao-e-testes.md, docs/12-auditoria-pre-home.md
   (seção 5: pendências e desvios).
3. docs/regras-de-negocio.md, docs/05-modelo-de-dados.md, docs/07-contratos-api.md,
   docs/08-estrategia-ocr.md, docs/09-autenticacao-e-seguranca.md e os ADRs (principalmente 0007 e
   0008).
4. Rode `pnpm install && pnpm bootstrap && pnpm infra:up && pnpm db:deploy && pnpm db:seed &&
   pnpm verify`. Se algo falhar, conserte ANTES de avançar e registre a causa.

## 1. Regras de execução
- Qualidade acima de quantidade. Nada de funcionalidade falsa, botão sem ação, número fixo ou lista
  fictícia fora de seed e testes. Módulo que não existe não aparece no menu.
- Ordem em cada entrega: migration + schemas Zod em packages/shared → regra de negócio com testes →
  endpoint (@Public/@RequirePermissions, ZodValidationPipe, ApiZod*) → tela → teste e2e.
- Banco só muda por migration escrita à mão (ADR 0007). Nunca edite migration aplicada. Sem
  exclusão física de histórico. Operações críticas: transacionais, idempotentes, UPDATE condicional
  conferindo a contagem, auditoria na mesma transação.
- Autorização é do backend. O frontend só esconde o que a API já nega.
- OCR não homologa: só devolve dados e confiança.
- Segredos nunca em texto puro nem em log. Cores só por tokens semânticos; nenhum hexadecimal em
  componente. Interface em português; identificadores em inglês.
- Decisões da federação que ainda não foram tomadas (docs/01 §6: D1–D10): NÃO invente. Use o valor
  padrão mais conservador, deixe configurável em `system_settings`, registre em um ADR e liste na
  seção "Decisões pendentes" do relatório final.
- A cada etapa: `pnpm verify` verde, e2e verde quando tocar fluxo de usuário, docs atualizadas, um
  commit por etapa (mensagem descrevendo o que entrou). Não avance com falha crítica aberta. Diga
  claramente o que NÃO pôde ser verificado.
- Antes de codar cada etapa, escreva em 5–10 linhas o que vai fazer e o que está fora de escopo.

## 2. Etapas (faça nesta ordem; só passe à seguinte com a atual verde)

### Etapa A — Ambiente e saúde do sistema
- Garantir que a subida do zero funciona em máquina limpa: Docker (PostgreSQL 16, Redis, MinIO,
  Mailpit), `pnpm db:deploy`, seed, `pnpm dev`. Se `prisma migrate deploy` for usado, valide as
  migrations escritas à mão contra um banco vazio e contra um banco já semeado.
- Healthchecks reais (`/health` com banco, Redis e MinIO), variáveis de ambiente documentadas em
  `.env.example` (sem segredos), README de 10 linhas para rodar.
- Corrigir tudo que `pnpm verify` ou os 16 cenários e2e atuais apontarem.
- Saída: uma pessoa nova sobe o projeto seguindo só o README.

### Etapa B — Gestão (Fase 2)
- Perfil de jogador (identificação no eFootball, plataforma, país/região, avatar via MinIO com
  validação de conteúdo, não de extensão).
- Clubes (cadastro, escudo, responsável, situação), vínculos com histórico (um ativo por jogador —
  já existe o índice parcial), pedido e aprovação de transferência sem alterar vínculos passados.
- Páginas públicas `/jogadores`, `/jogadores/[slug]`, `/clubes`, `/clubes/[slug]`; só então entram
  no menu e no rodapé, e ganham a busca do cabeçalho (com endpoint real de busca).
- Painel: gestão de jogadores, clubes e notícias; telas para banner e competição em destaque.
- Testes: permissão negada, validação, upload malicioso recusado, transferência preserva histórico.

### Etapa C — Competições (Fase 3)
- Temporadas e campeonatos com ciclo de vida, regulamento versionado, pontuação e desempates
  configuráveis (hoje fixos em standings.ts: pontos, vitórias, saldo, gols pró, apelido).
- Inscrições (prazo, vagas, plataforma, aprovação), equipe da competição (organizador/árbitro).
- Motor de confrontos: round-robin (método do círculo), grupos, mata-mata com byes, ida e volta,
  melhor de 3/5. Pré-visualização e publicação idempotente.
- Máquina de estados formal de partida com transições inválidas recusadas e prazos.
- Testes de propriedade: todo par se enfrenta exatamente uma vez; ninguém joga duas vezes na
  mesma rodada; chave com byes correta.
- Páginas públicas `/competicoes` e `/competicoes/[slug]` (tabela, rodadas, chave, inscrição).

### Etapa D — Reporte e resultados (Fases 5 e 4, nesta ordem)
1. Fluxo com placar digitado + evidência anexada: reporte pelo celular, confirmação pelo adversário
   no prazo, contestação, tratamento de não resposta conforme o regulamento, W.O.
2. Homologação transacional e idempotente, resultado versionado, revisão auditável. Duas
   homologações simultâneas produzem UM resultado (teste de concorrência). Classificação
   reconstruída do zero idêntica à incremental.
3. Upload de evidências: validação por conteúdo, hash, nome gerado, URL temporária.
4. Fila (BullMQ + outbox, novas tentativas, fila de falhas) e notificações na plataforma e por
   e-mail, sem duplicidade.
5. OCR como ASSISTENTE: services/ocr-service com layouts versionados e confiança; central de
   revisão; alertas antifraude. Sem capturas reais com gabarito (D1), entregue o fluxo e a
   infraestrutura, NÃO declare precisão — publique só as métricas que conseguir medir.
6. Páginas `/partidas/[id]`, histórico de temporadas, rankings e estatísticas por jogador/clube.
7. Justiça desportiva básica: processo, decisão, penalidade, recurso.

### Etapa E — Propagar o design system
- Aplicar o padrão da HOME (tokens, `type-*`, MatchRow, StandingsTable, ClubBadge, estados de
  carregamento/vazio/erro) a todas as páginas novas e às áreas do jogador e do admin.
- Acessibilidade WCAG 2.1 AA com axe em cada página pública; sem rolagem horizontal em 360–1920.

### Etapa F — Qualidade e produção (Fase 6)
- e2e dos fluxos principais (cadastro → inscrição → partida → reporte → confirmação →
  homologação → classificação no portal), carga nas rotas públicas e críticas, revisão de índices
  com dados volumosos, cache das páginas públicas.
- Segurança: itens pendentes de docs/09, rate limiting, revisão de dependências, cabeçalhos/CSP
  (hoje `img-src 'self' data: blob:` — ajuste só o necessário para o MinIO).
- Operação: logs estruturados, métricas, backup com restauração ensaiada, LGPD (exportação e
  anonimização), manual de operação e de administração.

## 3. Critério de pronto do sistema
Um roteiro end-to-end automatizado prova: visitante vê o portal → cadastra e confirma e-mail →
completa o perfil → entra em um clube → inscreve-se em uma competição → admin aprova e publica os
confrontos → jogador reporta placar com evidência → adversário confirma → admin/árbitro homologa →
a classificação, o ranking, a HOME e o perfil do jogador refletem o resultado. Todas as telas sem
erro de console, sem dado simulado, sem botão morto.

## 4. Relatório final (obrigatório)
Entregue `docs/14-aceitacao-sistema-funcional.md` com: o que foi feito por etapa; testes e
resultados (números reais); o que NÃO foi verificado e por quê; decisões pendentes da federação
(D1–D10) com o padrão adotado; riscos conhecidos; próximos passos. Se uma etapa não puder ser
concluída com qualidade, PARE nela, explique o bloqueio e não simule o resultado.

Comece pela Etapa A agora.
```

## Como usar

- Rode a Etapa A e confira o resultado antes de liberar as seguintes; cada etapa é um commit.
- As decisões D1–D10 (em `docs/01-analise-de-requisitos.md`, §6) dependem da federação. A mais
  importante é a D1, as capturas reais com gabarito: sem elas o OCR entrega o fluxo, não o
  reconhecimento.
