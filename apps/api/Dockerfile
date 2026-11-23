# Production multi-stage build for MediSync Global API (Fastify + PostgreSQL/PostGIS + Redis + S3)
FROM node:22-alpine AS builder
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@11.24.0 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/contracts/package.json ./packages/contracts/package.json
COPY packages/country-packs/package.json ./packages/country-packs/package.json
COPY packages/design-tokens/package.json ./packages/design-tokens/package.json
COPY apps/api/package.json ./apps/api/package.json
COPY apps/mobile/package.json ./apps/mobile/package.json
COPY apps/web/package.json ./apps/web/package.json

RUN pnpm install --frozen-lockfile --filter @medisync/api...

COPY packages ./packages
COPY apps/api ./apps/api

RUN pnpm --filter @medisync/contracts build \
  && pnpm --filter @medisync/country-packs build \
  && pnpm --filter @medisync/api build \
  && pnpm --filter @medisync/api --prod --legacy deploy /app/pruned

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=4000
ENV HOST=0.0.0.0

USER node
COPY --from=builder --chown=node:node /app/pruned ./
COPY --from=builder --chown=node:node /app/packages/contracts/dist ./node_modules/@medisync/contracts/dist
COPY --from=builder --chown=node:node /app/packages/country-packs/dist ./node_modules/@medisync/country-packs/dist

EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT:-4000}/health" || exit 1

CMD ["node", "dist/main.js"]
