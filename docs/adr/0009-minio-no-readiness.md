# ADR 0009 — MinIO no readiness e imagem fixada

**Situação:** aceita · 2026-10-19

## Contexto

A Etapa A (`13`) pede um `/health/ready` que confira banco, Redis **e** MinIO. O MinIO é usado a
partir da Etapa B (avatares e escudos), mas uma API que responde "pronta" sem o armazenamento falha
no primeiro upload, e não no deploy.

Os compose usavam `minio/minio:latest`. A MinIO deixou de publicar imagens novas em `minio/minio`;
`latest` aponta para uma versão antiga e não é reproduzível.

## Decisão

1. Nova variável obrigatória `S3_ENDPOINT`. O readiness consulta `GET {S3_ENDPOINT}/minio/health/live`,
   rota do MinIO que não exige credencial. A API não precisa de chave de acesso só para isso.
2. Toda sonda do readiness tem limite de 2 s. Uma dependência travada vira `down` e `503`, sem
   pendurar a requisição do balanceador.
3. Imagem fixada em `pgsty/minio:RELEASE.2026-08-04T00-00-00Z` (fork comunitário mantido, mesmo
   binário e mesmo `mc`), nos dois compose e na CI.
4. Cliente S3, buckets e credenciais da API ficam para a Etapa B, junto do primeiro uso real.

## Consequências

- Ambientes de teste, e2e e CI precisam de um MinIO no ar (`TEST_S3_ENDPOINT` e `E2E_S3_ENDPOINT`
  apontam para outra instância).
- Trocar o MinIO por outro provedor S3 exige outra sonda: `/minio/health/live` é específica do MinIO.
- Ao atualizar a imagem, conferir se o fork segue ativo; a alternativa é a imagem oficial paga ou
  compilar o binário.
