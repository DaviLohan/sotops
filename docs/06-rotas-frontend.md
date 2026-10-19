# 06 · Mapa de rotas do frontend

Next.js (App Router). Três ambientes com estruturas visuais próprias:

| Ambiente              | Grupo de rotas | Estrutura                                         | Acesso                        |
| --------------------- | -------------- | ------------------------------------------------- | ----------------------------- |
| Portal público        | `(site)`       | Cabeçalho e rodapé do portal                      | Livre                         |
| Acesso                | `(auth)`       | Tela dividida: identidade + formulário            | Livre                         |
| Área do jogador       | `/painel`      | Menu lateral (gaveta no celular) + barra superior | Sessão                        |
| Painel administrativo | `/admin`       | Mesma estrutura, navegação própria                | Sessão + `admin.access` + MFA |

Legenda: ✅ implementada · ⏳ planejada (fase).

## Portal público

| Rota                                  | Tela                                                                                                                     | Estado                           |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | -------------------------------- |
| `/`                                   | HOME: hero, faixa da temporada, competições, resultados, agenda, classificação, destaques, números, calendário, notícias | ✅ (dados de `GET /public/home`) |
| `/privacidade`                        | Aviso de Privacidade                                                                                                     | ✅                               |
| `/sobre`                              | Apresentação da federação                                                                                                | ⏳ 2                             |
| `/noticias`, `/noticias/[slug]`       | Notícias e comunicados                                                                                                   | ⏳ 2                             |
| `/jogadores/[username]`               | Perfil público do jogador                                                                                                | ⏳ 2                             |
| `/clubes`, `/clubes/[tag]`            | Clubes                                                                                                                   | ⏳ 2                             |
| `/competicoes`, `/competicoes/[slug]` | Competições, tabela, jogos, regulamento                                                                                  | ⏳ 3                             |
| `/calendario`                         | Calendário de competições e partidas                                                                                     | ⏳ 3                             |
| `/partidas/[id]`                      | Partida: placar oficial e histórico                                                                                      | ⏳ 5                             |
| `/rankings`                           | Rankings de jogadores e de clubes                                                                                        | ⏳ 5                             |
| `/temporadas`, `/temporadas/[slug]`   | Histórico das temporadas e campeões                                                                                      | ⏳ 5                             |
| `/contato`                            | Contato                                                                                                                  | ⏳ 2                             |

## Acesso

| Rota                      | Tela                                                                  | Estado |
| ------------------------- | --------------------------------------------------------------------- | ------ |
| `/entrar`                 | Login; segundo passo para MFA (autenticador ou código de recuperação) | ✅     |
| `/cadastro`               | Criação de conta + confirmação de envio do e-mail                     | ✅     |
| `/verificar-email?token=` | Confirmação do e-mail (por clique) e reenvio do link                  | ✅     |
| `/recuperar-senha`        | Pedido de redefinição                                                 | ✅     |
| `/redefinir-senha?token=` | Nova senha                                                            | ✅     |

`?next=` em `/entrar` aceita apenas caminhos internos.

## Área do jogador (`/painel`)

| Rota                                                              | Tela                                                   | Estado |
| ----------------------------------------------------------------- | ------------------------------------------------------ | ------ |
| `/painel`                                                         | Visão geral: conta, segurança, acessos recentes        | ✅     |
| `/painel/conta`                                                   | Dados da conta                                         | ✅     |
| `/painel/seguranca`                                               | Senha, verificação em duas etapas, sessões             | ✅     |
| `/painel/perfil`                                                  | Perfil de jogador: eFootball, plataforma, país, avatar | ⏳ 2   |
| `/painel/clube`                                                   | Meu clube, vínculo e transferências                    | ⏳ 2   |
| `/painel/inscricoes`                                              | Minhas inscrições e campeonatos abertos                | ⏳ 3   |
| `/painel/partidas`, `/painel/calendario`                          | Próximas partidas e calendário                         | ⏳ 3   |
| `/painel/partidas/[id]/reportar`                                  | Envio da captura e acompanhamento do OCR               | ⏳ 4   |
| `/painel/partidas/[id]`                                           | Confirmar ou contestar o resultado                     | ⏳ 5   |
| `/painel/estatisticas`, `/painel/historico`, `/painel/conquistas` | Desempenho pessoal                                     | ⏳ 5   |
| `/painel/notificacoes`                                            | Central de notificações                                | ⏳ 5   |

## Painel administrativo (`/admin`)

| Rota                                                       | Tela                                        | Permissão                   | Estado |
| ---------------------------------------------------------- | ------------------------------------------- | --------------------------- | ------ |
| `/admin`                                                   | Dashboard com indicadores do banco          | `dashboard.read`            | ✅     |
| `/admin/usuarios`                                          | Usuários: busca, filtros, papéis, suspensão | `users.read` (+ `manage_*`) | ✅     |
| `/admin/auditoria`                                         | Histórico de auditoria                      | `audit.read`                | ✅     |
| `/admin/jogadores`, `/admin/clubes`                        | Gestão de jogadores e clubes                | —                           | ⏳ 2   |
| `/admin/noticias`, `/admin/configuracoes`                  | Notícias e configurações gerais             | —                           | ⏳ 2   |
| `/admin/temporadas`, `/admin/campeonatos`                  | Temporadas e campeonatos                    | —                           | ⏳ 3   |
| `/admin/inscricoes`, `/admin/rodadas`, `/admin/confrontos` | Inscrições, rodadas e confrontos            | —                           | ⏳ 3   |
| `/admin/ocr`                                               | Central de OCR: fila, revisão, layouts      | —                           | ⏳ 4   |
| `/admin/resultados`                                        | Central de resultados e homologação         | —                           | ⏳ 5   |
| `/admin/contestacoes`, `/admin/penalidades`                | Justiça desportiva                          | —                           | ⏳ 5   |
| `/admin/notificacoes`, `/admin/relatorios`                 | Notificações e relatórios                   | —                           | ⏳ 5   |

## Regras de navegação

- **Só aparece no menu o que existe.** Os itens são declarados em `app-shell.tsx`; cada fase
  acrescenta os seus e o menu filtra pelo que a conta pode ver.
- **Sem sessão**, `/painel/*` e `/admin/*` redirecionam para `/entrar?next=…` (`proxy.ts`).
- **Sessão sem permissão** em `/admin` vê a tela "Acesso restrito"; administrador sem MFA vê a
  orientação para ativá-lo. Em ambos os casos a API nega os dados — a tela é só a explicação.
- **Estados obrigatórios em toda tela de dados**: carregando (esqueleto), vazio (com orientação),
  erro (com "tentar de novo") e sucesso.
