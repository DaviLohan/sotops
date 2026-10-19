# 14 · Sistema funcional — aceitação por etapa

Relatório das etapas de `13-prompt-claude-code-sistema-funcional.md`. A Etapa A (ambiente e saúde)
está registrada em `11-fase-1-aceitacao-e-testes.md`. Cada etapa traz o que entrou, os números reais
dos testes, o que não foi verificado e as decisões da federação usadas.

## Etapa B — Gestão (Fase 2) · 19/10/2026

Decisões D2, D3 e D10 confirmadas e registradas em `adr/0010`.

### O que entrou

| Entrega                   | Conteúdo                                                                                                                |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Perfil de jogador         | `/painel/perfil`: apelido, ID do eFootball único por plataforma, plataforma, país (ISO 3166), região, avatar            |
| Imagens                   | MinIO via API; conteúdo conferido e regravado em WebP 256×256 sem metadados; servidas em `/api/v1/media/…`              |
| Clubes                    | `/admin/clubes`: cadastro, sigla única, cores, fundação, situação, responsável, escudo                                  |
| Vínculos e transferências | `/painel/clube` e `/admin/transferencias`: jogador → responsável do clube → federação; sair do clube; histórico intacto |
| Portal                    | `/jogadores`, `/jogadores/[slug]`, `/clubes`, `/clubes/[slug]`, busca no cabeçalho; no menu e no rodapé                 |
| Painel                    | `/admin/jogadores` (correção com motivo, moderação do avatar), `/admin/noticias`, `/admin/configuracoes`                |
| Configurações             | Nome da federação em `system_settings` (portal e e-mails), banners do hero, competição em destaque                      |
| Banco                     | Migration `20261019120000_management` (validada em banco vazio e em banco semeado)                                      |

### Testes

| Verificação                             | Resultado                                              |
| --------------------------------------- | ------------------------------------------------------ |
| `pnpm verify` (lint, formatação, tipos) | ✅                                                     |
| Contratos (`shared`)                    | ✅ 12                                                  |
| Web — unitários e componentes           | ✅ 21                                                  |
| API — unitários e integração            | ✅ 167 (eram 125 na Etapa A)                           |
| End-to-end (`specs/04-gestao.spec.ts`)  | ✅ 3 novos; os 16 anteriores verdes na rodada completa |
| `pnpm build`                            | ✅                                                     |

Cobertura nova da API: permissão negada em todas as rotas novas; validação de cada formulário;
upload malicioso recusado (SVG com script e PHP disfarçados de PNG, HTML com extensão `.jpg`, arquivo
acima de 2 MB, sem token anti-CSRF); EXIF removido do avatar; ID do eFootball repetido com outra caixa;
transferência que preserva vínculos passados (comparação campo a campo); **cinco aprovações
simultâneas produzem um único vínculo e um único registro de auditoria**; aprovação recusada para
clube que ficou inativo (com rollback); recusa com motivo pelo clube e pela federação; jogador
suspenso fora do portal; nenhum e-mail, usuário ou ID do eFootball nas respostas públicas; nome da
federação nos e-mails; banner com destino `javascript:` recusado.

End-to-end novos: o jogador cria o perfil, envia o avatar (e um falso PNG é recusado) e vê a página
pública; listas, busca da lista e busca do cabeçalho; transferência pedida pelo jogador e aprovada
pelo administrador (que ativa o MFA no primeiro acesso), refletida no perfil e no elenco do clube.

### Problemas encontrados (e corrigidos)

| Problema                                                                                      | Correção                                                          |
| --------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Com o MinIO fora, a criação do bucket na subida travava a API                                 | Bucket criado no primeiro envio                                   |
| Listagens com `$transaction([...])` e relações geravam consultas simultâneas na mesma conexão | Leitura de página e total com `Promise.all`, fora de transação    |
| Nome da federação lido no layout raiz fazia o build consultar a API e travar                  | Nome lido só no layout do portal (já dinâmico), com limite de 2 s |
| `watch()` do react-hook-form incompatível com o React Compiler                                | `useWatch`                                                        |

### Não verificado

- CI (não há repositório remoto) e a pilha de produção com `docker-compose.yml` (a API agora depende
  do MinIO saudável e recebe `S3_*`).
- Conferência visual sistemática em 360–1920 px e axe nas páginas novas: fica para a Etapa E.
- Neste WSL, conexões a portas locais fechadas ficam penduradas em vez de recusadas; por isso cada
  rodada de e2e leva cerca de 7 minutos. É do ambiente, não da aplicação.

### Pendências

| Pendência                                                                              | Quando                        |
| -------------------------------------------------------------------------------------- | ----------------------------- |
| Imagem de notícia e de banner enviada pelo painel; páginas `/noticias`                 | junto das páginas de notícias |
| Usuário do MinIO só para a API (hoje a credencial raiz por padrão)                     | Etapa F                       |
| Logotipo com a marca definitiva (D10)                                                  | federação                     |
| Seletor de clube do pedido de transferência lista até 100 clubes                       | quando passar disso           |
| Aviso de Privacidade atualizado (versão 2026-10-19) segue pendente de revisão jurídica | antes de abrir ao público     |
