# ADR 0010 — Gestão: identificação, clubes, transferências, imagens e nome da federação

**Situação:** aceita · 2026-10-19 · decisões D2, D3 e D10 confirmadas com o responsável pelo projeto

## Contexto

A Etapa B (Fase 2) precisava de três decisões da federação (`01`, §6) e de um caminho para as
primeiras imagens enviadas por usuários (avatar e escudo).

## Decisões

1. **D2 — identificação no eFootball:** ID do usuário do jogo, **único por plataforma**, sem diferenciar
   maiúsculas (índice único sobre `(platform, lower(efootball_id))`). Formato amplo
   (`[A-Za-z0-9_.-]{3,32}`), porque o formato exato varia por plataforma. O ID **não** sai nas rotas
   públicas. Fica em `player_profiles` (uma plataforma por perfil), e não em uma tabela
   `game_accounts`: ninguém pediu várias contas de jogo por pessoa.
2. **D3 — clubes:** um clube tem vários jogadores; jogar sem clube é permitido. Transferência em duas
   etapas: o jogador pede → o **responsável do clube de destino** aceita (pulado se o clube não tem
   responsável, ou se quem pede é o próprio responsável) → a **federação** aprova. Aprovar encerra o
   vínculo ativo (data de fim) e cria outro, na mesma transação; vínculos passados nunca mudam. Um
   pedido em aberto por jogador (índice único parcial). Cada decisão é um UPDATE condicional ao
   estado lido, e repetir não repete o efeito.
3. **D10 — nome:** provisório ("Federação eFootball 1x1") e editável em `system_settings`
   (`settings.manage`, só superadministrador). Alimenta o título das páginas do portal, o rodapé e a
   assinatura dos e-mails. O logotipo não muda: ele será redesenhado com a marca definitiva.
4. **Imagens enviadas:** conferidas pelos primeiros bytes (PNG, JPEG, WebP), decodificadas e
   **regravadas** em WebP 256×256 pelo `sharp`. O original nunca é guardado, o que elimina EXIF
   (localização) e conteúdo escondido. Nome gerado (`{pasta}/{uuid}.webp`), objetos privados no MinIO
   e servidos pela própria API em `/api/v1/media/{avatars|crests}/…` com cache imutável. O CSP
   continua `img-src 'self'`. O bucket é criado no primeiro envio, e não na subida, para a API subir
   mesmo com o MinIO fora.
5. **Permissões novas:** `player_profile.manage` (Jogador), `clubs.manage`, `transfers.decide`,
   `players.manage`, `content.manage` (Administrador) e `settings.manage` (só Superadministrador).

## Consequências

- Notícias e banners continuam sem imagem enviada pelo painel (formato largo e outro fluxo); entram
  com as páginas `/noticias`.
- A API usa a credencial raiz do MinIO por padrão (`S3_ACCESS_KEY`/`S3_SECRET_KEY`); em produção,
  criar um usuário só para a API é pendência da Etapa F.
- Clube sem responsável depende só da federação; a federação pode nomear um responsável a qualquer
  momento.
