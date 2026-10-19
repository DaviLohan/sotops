# syntax=docker/dockerfile:1.7
# Contexto de build: a raiz do monorepositório.
#   docker build -f apps/api/Dockerfile -t efed-api .

FROM node:22-bookworm-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
# O motor de migrations do Prisma depende do OpenSSL.
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/* \
  && corepack enable
WORKDIR /repo

# ---------------------------------------------------------------------------
# build: dependências completas + compilação. Também é a imagem do serviço
# `migrate`, que aplica as migrations antes de a API subir.
# ---------------------------------------------------------------------------
FROM base AS build
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY packages/config/package.json packages/config/
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
  pnpm install --frozen-lockfile --filter @efed/api...

COPY packages packages
COPY apps/api apps/api
RUN pnpm --filter @efed/shared build \
  && pnpm --filter @efed/api build \
  && pnpm --filter @efed/api deploy --prod --legacy /out

# ---------------------------------------------------------------------------
# runtime: somente dependências de produção e o código compilado.
# ---------------------------------------------------------------------------
FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build --chown=node:node /out/node_modules ./node_modules
COPY --from=build --chown=node:node /out/package.json ./package.json
COPY --from=build --chown=node:node /out/dist ./dist

USER node
EXPOSE 3001
HEALTHCHECK --interval=15s --timeout=3s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3001/api/health').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", "dist/main.js"]
