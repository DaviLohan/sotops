# 12 · Auditoria técnica e visual (antes da HOME do prompt master v2)

Data: 30/09/2026. Base: commit `0122e21`. Auditoria feita **lendo o código**; as telas não foram
renderizadas nesta passada (pendente: capturas em 360/390/768/1024/1440/1920).

## 1. Técnica

**Sólido (manter):** autenticação, sessões, CSRF, MFA, RBAC, auditoria append-only, contratos Zod
únicos, Docker/Nginx/CI, 149 testes. Nada disso deve ser refatorado.

**Lacuna central:** o banco só tem identidade/acesso/auditoria (User, Role, UserRole, Session,
UserToken, UserTotp, MfaRecoveryCode, AuditLog). Não existem: perfis de jogador, clubes, temporadas,
competições, rodadas, partidas, classificação, ranking, notícias, banners. Logo **não há de onde a
HOME dinâmica (§46) ler** competição em destaque, próximas partidas, resultados, tabela, ranking,
estatísticas e notícias.

**Conflitos entre o prompt v2 e o repositório:**

| Tema               | Prompt v2                                                                                 | Repositório                                                                               |
| ------------------ | ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Ordem das fases    | HOME na Fase 2, motor na 3, OCR na 5                                                      | Gestão(2) → Competições(3) → OCR(4) → Resultados(5) (`docs/10`)                           |
| Dados na HOME      | Nunca hardcoded; API                                                                      | `CLAUDE.md` regra 7: sem dados simulados fora de seed/testes (compatível, se houver seed) |
| Tabela de partidas | `AVAILABLE`, `AWAITING_RESULT`, `AWAITING_CONFIRMATION`…                                  | Máquina de estados ainda não modelada (Fase 3)                                            |
| Fila OCR           | BullMQ na API/worker                                                                      | ADR 0005: fila na API, OCR sem estado (compatível)                                        |
| Paleta             | brand `#2445FF`, azul `#246BFD`, amarelo `#F4F600`, superfícies `#0D122B/#121936/#171F42` | brand `#172D91`, amarelo `#F5F500`, superfícies `#111936/#18234A` — divergentes           |
| Rotas              | `/jogadores/[nickname]`, `/clubes/[slug]`                                                 | docs/06 usa `[username]` e `[tag]`                                                        |
| Busca              | campo de busca no header                                                                  | não existe endpoint de busca                                                              |

Pendências herdadas (Fase 1, não verificadas): subida dos contêineres e `db:deploy`/`db:migrate`
(ADR 0007).

## 2. Visual (pelo código)

**Acertos:** tokens em duas camadas, sem hexadecimal em componente, Saira Condensed para títulos,
foco visível, `prefers-reduced-motion`, amarelo contido.

**Distância até o prompt v2:**

- Sem escala tipográfica nomeada (Display XXL 64 → Caption 11) nem estilo de placar/estatística;
  só `type-display` e `type-eyebrow`.
- Header: apenas logo + Entrar/Criar conta; sem navegação, busca nem modo transparente sobre o hero.
- Home atual: hero textual sem imagem, bloco "como um resultado vira oficial" (4 colunas iguais com
  ícone — exatamente o padrão que o prompt rejeita) e uma seção de competições em estado vazio.
  Sem live strip, resultados, tabela, destaques, números, calendário, notícias, CTA final.
- Não há imagens/ativos esportivos no repositório (`apps/web/public` só tem `robots.txt`).
  Direito de imagem do hero é decisão pendente (não copiar assets da Konami nem da FDT Arena).
- Componentes do §43 inexistentes: Scoreboard, MatchRow, StandingsTable, RankingRow, ClubBadge,
  CompetitionCard, CalendarStrip, FilterBar etc.; `StatCard` e `Card` atuais são o padrão "tudo card".
- Raios: `rounded-xl` usado em seções da home; revisar para o tom mais seco pedido.

## 3. Consequência para a HOME

Implementar a HOME como o prompt descreve exige uma fatia vertical mínima dos domínios de
competição (leitura): migrations + seed realista separado + endpoints públicos paginados + contratos
em `shared`. Isso antecipa partes das Fases 2, 3 e 5.

## 4. O que foi feito a partir desta auditoria (30/09/2026)

Decisões da federação: **fatia mínima + HOME** (ADR 0008) e **paleta do prompt v2**.

- **Banco/API:** migration `20260930180000_competition_read_model`, contratos em
  `packages/shared/src/schemas/public.ts`, `GET /public/home` e `GET /public/matches/upcoming`,
  cálculo de classificação/ranking em `modules/public/standings.ts`. Seed do portal separado em
  `prisma/seed-portal.ts` (datas relativas a "agora").
- **Design system:** tokens da paleta v2, escala tipográfica (`type-xxl` … `type-caption`,
  `type-score`, `type-stat`), cantos secos, componentes em `components/sport` e `components/portal`.
- **HOME:** hero (número da rodada como elemento gráfico), faixa da temporada, competições,
  resultados, próximos confrontos com filtro, classificação, destaques, números, calendário,
  notícias, CTA final, cabeçalho transparente→sólido, menu em gaveta no celular.
- **Desvios conscientes do prompt:** ver seção 5.

## 5. Desvios do prompt v2 e pendências

| Item do prompt                                                                                  | Situação                                  | Motivo                                                                                                                    |
| ----------------------------------------------------------------------------------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Busca no cabeçalho                                                                              | Não incluída                              | Não há endpoint de busca; botão sem ação é proibido (§50). Entra com Jogadores/Clubes.                                    |
| Menu: Clubes, Jogadores                                                                         | Não incluídos                             | As páginas ainda não existem (regra: só aparece o que existe).                                                            |
| "AO VIVO" na faixa                                                                              | Substituído por "Último resultado"        | Partida 1x1 só tem placar depois de jogada e conferida; não há dado ao vivo.                                              |
| Botões `[VER PARTIDA]`, `[ACOMPANHAR]`, "Ver classificação completa", "Ver todos os resultados" | Trocados por âncoras/estados reais        | `/partidas/[id]`, `/competicoes/*` ainda não existem.                                                                     |
| Footer: Sobre, Regulamento, Contato, Central de ajuda, Termos, redes                            | Só links existentes                       | Páginas e URLs das redes não definidos.                                                                                   |
| Hero com foto de jogador                                                                        | Composição gráfica própria                | Sem imagem licenciada no repositório; foto entra via banner (`image_url` local) quando houver.                            |
| Texto terciário `#6F7891`                                                                       | Usado `#7C86A2`                           | O original dá 3,6:1 sobre a superfície elevada (abaixo de AA). O valor original ficou em `--fg-faint`, só para decoração. |
| Admin define destaque, banner e notícia                                                         | Campos prontos; telas de gestão pendentes | Painel de conteúdo vem na fase do CMS (Fase 2/4 do plano).                                                                |
| Mata-mata na Copa                                                                               | Só inscrições                             | O motor de confrontos é da Fase 3.                                                                                        |
| Estados de erro `offline` e `permissão negada` na HOME                                          | Erro genérico (`error.tsx`)               | HOME é pública; offline dedicado entra com PWA/Fase 6.                                                                    |

Verificação: `pnpm verify` (shared 12, web 21, api 124 testes), 16 cenários end-to-end (6 novos),
`axe` sem violações WCAG 2.1 AA na HOME em 1440 e 390, sem rolagem horizontal em 360, 390, 768, 1024,
1440 e 1920. Não verificado: subida em Docker e `prisma migrate` (ver ADR 0007).
