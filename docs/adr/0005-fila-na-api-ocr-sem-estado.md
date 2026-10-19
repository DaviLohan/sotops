# ADR 0005 — Fila e worker na API; serviço de OCR sem estado, por HTTP interno

**Situação:** proposta para a Fase 4 · 2026-09-30

## Contexto

O requisito cita BullMQ entre as tecnologias do OCR, mas BullMQ é uma biblioteca Node.js. O serviço
de OCR é Python e não deve homologar nem tocar em dados oficiais.

## Decisão

A API publica e consome a fila (BullMQ sobre Redis). O worker chama o serviço de OCR por HTTP na
rede interna, passando uma URL temporária da imagem, e grava o resultado. O serviço de OCR não tem
credenciais de banco nem de Redis.

## Consequências

- Menor privilégio: comprometer o OCR não dá acesso a dados nem a filas.
- Estados e persistência em um só lugar (TypeScript), sob as mesmas transações e auditoria.
- Escala horizontal do OCR por réplicas atrás do nome do serviço.
- Se o volume exigir, o consumo direto da fila pelo Python pode ser adotado depois sem mudar o
  contrato de dados do resultado.
