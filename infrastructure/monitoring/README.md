# Monitoramento

**Estado atual (Fase 1)** — o que já existe para observar o sistema:

- `GET /api/health` (liveness) e `GET /api/health/ready` (PostgreSQL, Redis e MinIO), usados pelos
  health checks do Docker.
- Logs estruturados em JSON (API e Nginx), com o mesmo `X-Request-Id` do proxy até a auditoria.
- Indicadores de segurança no dashboard administrativo (falhas de login, administradores sem MFA).

**Previsto para a Fase 6**: métricas (Prometheus), painéis, alertas e coleta centralizada de logs.
Nada disso está implementado ainda; esta pasta receberá as configurações.
