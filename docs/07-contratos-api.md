# 07 · Contratos da API

API REST em `/api/v1`. O contrato completo e sempre atualizado é o **OpenAPI**:

- Interativo, em desenvolvimento: http://localhost:3001/api/docs
- Arquivo versionado: [`openapi.json`](openapi.json) — gerado por
  `pnpm --filter @efed/api build && pnpm --filter @efed/api openapi:export`
  (o comando inicializa a aplicação: precisa do `.env` e da infraestrutura no ar).

Os formatos de entrada e saída são schemas Zod em `packages/shared`; o OpenAPI é derivado deles.

## Convenções

| Tema            | Regra                                                                                                        |
| --------------- | ------------------------------------------------------------------------------------------------------------ |
| Versão          | Na URL: `/api/v1/...`. Mudança incompatível cria `/v2`; `/health` não é versionado.                          |
| Autenticação    | Cookie de sessão HttpOnly (`efed_session`; em produção `__Host-efed_session`). Não há token no JavaScript.   |
| CSRF            | Alterações autenticadas enviam `X-CSRF-Token` (recebido no login e em `GET /auth/me`). A origem é conferida. |
| Sucesso         | `{ "data": ... }`; listas paginadas: `{ "data": [...], "meta": { page, pageSize, total, totalPages } }`.     |
| Erro            | `application/problem+json`: `{ status, code, title, detail?, errors?, requestId }`.                          |
| Validação       | `400` com `code: "VALIDATION_FAILED"` e `errors: [{ path, message }]` por campo.                             |
| Paginação       | `page` (≥ 1) e `pageSize` (1–100, padrão 20).                                                                |
| Ordenação       | `sortBy` (lista fechada por recurso) e `sortDir` (`asc` \| `desc`).                                          |
| Datas           | ISO 8601 em UTC.                                                                                             |
| Identificadores | UUID. Identificador malformado responde `404`, como recurso inexistente.                                     |
| Rastreamento    | Toda resposta traz `X-Request-Id`, repetido em `requestId` nos erros e gravado na auditoria.                 |
| Limites         | Cabeçalhos `X-RateLimit-*`; ao exceder, `429` com `Retry-After`.                                             |

O frontend decide comportamento pelo **`code`**, nunca pelo texto.

### Códigos de erro

| `code`                                    | HTTP | Quando                                                     |
| ----------------------------------------- | ---- | ---------------------------------------------------------- |
| `VALIDATION_FAILED`                       | 400  | Entrada inválida                                           |
| `TOKEN_INVALID`                           | 400  | Link de e-mail inválido, usado ou expirado                 |
| `UNAUTHENTICATED`                         | 401  | Sem sessão válida                                          |
| `INVALID_CREDENTIALS`                     | 401  | Login ou senha atual incorretos                            |
| `MFA_INVALID_CODE`                        | 401  | Código TOTP ou de recuperação incorreto ou reutilizado     |
| `FORBIDDEN`                               | 403  | Sem permissão para a ação ou para o recurso                |
| `CSRF_REJECTED`                           | 403  | Origem não autorizada ou token anti-CSRF ausente/incorreto |
| `ACCOUNT_SUSPENDED`                       | 403  | Conta suspensa                                             |
| `EMAIL_NOT_VERIFIED`                      | 403  | Senha correta, e-mail ainda não confirmado                 |
| `MFA_CHALLENGE_REQUIRED`                  | 403  | Sessão aguardando o segundo fator                          |
| `MFA_ENROLLMENT_REQUIRED`                 | 403  | Papel exige MFA e ele ainda não foi ativado                |
| `NOT_FOUND`                               | 404  | Recurso inexistente                                        |
| `CONFLICT`                                | 409  | Estado atual não permite a operação                        |
| `USERNAME_TAKEN`                          | 409  | Nome de usuário em uso                                     |
| `MFA_ALREADY_ENABLED` / `MFA_NOT_ENABLED` | 409  | Operação de MFA incompatível com o estado                  |
| `ACCOUNT_LOCKED`                          | 429  | Bloqueio temporário por tentativas (`Retry-After`)         |
| `RATE_LIMITED`                            | 429  | Limite de requisições por IP                               |
| `INTERNAL_ERROR`                          | 500  | Erro inesperado (detalhes só no log)                       |

## Endpoints implementados (Fase 1)

🔓 pública · 🔐 sessão · 🛡️ permissão indicada · ⏱️ limite reduzido de autenticação

### Autenticação

| Método e rota                       | Acesso | Descrição                                                                                |
| ----------------------------------- | ------ | ---------------------------------------------------------------------------------------- |
| `POST /auth/register`               | 🔓⏱️   | Cria conta pendente e envia verificação. Resposta `202` idêntica se o e-mail já existir. |
| `POST /auth/verify-email`           | 🔓⏱️   | Confirma o e-mail com o token e ativa a conta.                                           |
| `POST /auth/verify-email/resend`    | 🔓⏱️   | Reenvia a verificação (resposta sempre igual).                                           |
| `POST /auth/login`                  | 🔓⏱️   | Abre sessão. `data.status`: `AUTHENTICATED` ou `MFA_REQUIRED`.                           |
| `POST /auth/mfa/challenge`          | 🔐⏱️   | Conclui o login com TOTP ou código de recuperação; troca o token da sessão.              |
| `POST /auth/logout`                 | 🔓     | Encerra a sessão atual e remove o cookie.                                                |
| `GET /auth/me`                      | 🔐     | Conta, papéis, permissões e token anti-CSRF.                                             |
| `POST /auth/password/forgot`        | 🔓⏱️   | Envia o link de redefinição (resposta sempre igual).                                     |
| `POST /auth/password/reset`         | 🔓⏱️   | Define nova senha e encerra todas as sessões.                                            |
| `POST /auth/password/change`        | 🔐⏱️   | Troca a senha (exige a atual) e encerra as demais sessões.                               |
| `GET /auth/sessions`                | 🔐     | Sessões ativas da conta.                                                                 |
| `DELETE /auth/sessions`             | 🔐     | Encerra as outras sessões.                                                               |
| `DELETE /auth/sessions/{id}`        | 🔐     | Encerra uma sessão da própria conta.                                                     |
| `GET /auth/mfa`                     | 🔐     | Situação do MFA.                                                                         |
| `POST /auth/mfa/enrollment`         | 🔐⏱️   | Inicia o cadastro do TOTP (exige senha).                                                 |
| `POST /auth/mfa/enrollment/confirm` | 🔐⏱️   | Confirma com um código; devolve os códigos de recuperação (uma única vez).               |
| `POST /auth/mfa/recovery-codes`     | 🔐⏱️   | Gera novos códigos de recuperação (exige senha).                                         |
| `POST /auth/mfa/disable`            | 🔐⏱️   | Desativa o MFA (exige senha; vedado a papéis administrativos).                           |

### Conta

| Método e rota            | Acesso | Descrição                    |
| ------------------------ | ------ | ---------------------------- |
| `PATCH /account/profile` | 🔐     | Atualiza o nome de exibição. |

### Administração

| Método e rota                    | Acesso                   | Descrição                                                  |
| -------------------------------- | ------------------------ | ---------------------------------------------------------- |
| `GET /admin/dashboard/summary`   | 🛡️ `dashboard.read`      | Indicadores calculados do banco.                           |
| `GET /admin/users`               | 🛡️ `users.read`          | Busca, filtros (`status`, `role`), ordenação e paginação.  |
| `GET /admin/users/{id}`          | 🛡️ `users.read`          | Um usuário.                                                |
| `PATCH /admin/users/{id}/status` | 🛡️ `users.manage_status` | Suspende ou reativa, com motivo obrigatório.               |
| `PUT /admin/users/{id}/roles`    | 🛡️ `users.manage_roles`  | Define os papéis, respeitando o que o autor pode conceder. |
| `GET /admin/audit-logs`          | 🛡️ `audit.read`          | Eventos de auditoria, com filtros e paginação.             |

### Portal público

| Método e rota                                                     | Acesso | Descrição                                                                                                                                                    |
| ----------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `GET /public/home`                                                | 🔓     | Tudo o que a HOME exibe: banner, competições, próxima partida, resultados, agenda de hoje, classificação (top 5), destaques, números, calendário e notícias. |
| `GET /public/matches/upcoming?scope=today\|tomorrow\|week&limit=` | 🔓     | Confrontos ainda não decididos no período (fuso `America/Sao_Paulo`). `limit` 1–30, padrão 8. Placar só é devolvido quando o resultado é oficial.            |

Respostas com `Cache-Control: public, max-age=10, stale-while-revalidate=50`. Nenhum campo de conta (e-mail,
usuário, identificadores de usuário) sai dessas rotas; o jogador é identificado por `nickname` e `slug`.

### Saúde

| Método e rota           | Descrição                                            |
| ----------------------- | ---------------------------------------------------- |
| `GET /api/health`       | Processo respondendo.                                |
| `GET /api/health/ready` | PostgreSQL, Redis e MinIO acessíveis (`503` se não). |

## Exemplo

```http
POST /api/v1/auth/login
Origin: http://localhost:3000
Content-Type: application/json

{ "identifier": "jogador1", "password": "desenvolvimento-123" }
```

```http
HTTP/1.1 200 OK
Set-Cookie: efed_session=…; Path=/; HttpOnly; SameSite=Lax
X-Request-Id: 0a8c…

{
  "data": {
    "status": "AUTHENTICATED",
    "csrfToken": "…",
    "account": {
      "id": "…", "username": "jogador1", "displayName": "Jogador Um",
      "roles": ["PLAYER"], "permissions": [], "mfaEnabled": false,
      "mfaEnrollmentRequired": false, "status": "ACTIVE", "email": "…", "createdAt": "…"
    }
  }
}
```

## Contratos planejados (principais)

Desenho de referência para as próximas fases; os formatos serão fixados em `packages/shared` quando
cada módulo for implementado.

| Fase | Recursos                                                                                                                                                                                                                   |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2    | `/players`, `/players/{username}`, `/me/player-profile`, `/clubs`, `/clubs/{id}/memberships`, `/transfers`, `/admin/settings`, `/posts`                                                                                    |
| 3    | `/seasons`, `/competitions`, `/competitions/{id}/rules`, `/competitions/{id}/entries`, `/competitions/{id}/fixtures:generate`, `/competitions/{id}/fixtures:publish`, `/matches`, `/me/matches`                            |
| 4    | `POST /matches/{id}/reports` (multipart, com `Idempotency-Key`), `GET /reports/{id}` (situação do OCR), `GET /evidence/{id}/url` (URL temporária), `/admin/ocr/*`                                                          |
| 5    | `POST /reports/{id}/confirm` · `/contest`, `POST /admin/reports/{id}/homologate` (idempotente), `POST /admin/matches/{id}/result-revisions`, `/competitions/{id}/standings`, `/rankings`, `/disputes`, `/me/notifications` |

Ações que não são CRUD usam subrecurso verbal (`/confirm`, `/homologate`, `:generate`) e são
idempotentes: repetir a chamada não repete o efeito.
