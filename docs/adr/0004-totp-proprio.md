# ADR 0004 — TOTP implementado sobre `node:crypto`

**Situação:** aceita · 2026-09-30

## Contexto

O MFA dos administradores usa TOTP. As bibliotecas disponíveis mudaram de API entre versões
maiores recentes, e o algoritmo (RFC 6238) cabe em poucas dezenas de linhas sobre HMAC-SHA1.

## Decisão

Implementação própria em `apps/api/src/infra/crypto/totp.ts`, usando apenas primitivas do Node.js
(HMAC, comparação em tempo constante, gerador aleatório). Nenhuma criptografia é inventada.

## Consequências

- Uma dependência de segurança a menos para acompanhar.
- Correção demonstrada pelos vetores de teste das RFCs 4226 e 6238, pela janela de tolerância e
  pela recusa de códigos reutilizados (testes unitários e de integração).
- Parâmetros fixos no perfil aceito por todos os aplicativos autenticadores: SHA-1, 6 dígitos, 30 s.
