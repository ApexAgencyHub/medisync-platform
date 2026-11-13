# Multi-stage production Dockerfile for @medisync/api
FROM node:22-alpine AS builder
RUN corepack enable pnpm
WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/contracts/package.json ./packages/contracts/
COPY packages/country-packs/package.json ./packages/country-packs/
COPY apps/api/package.json ./apps/api/

RUN pnpm install --frozen-lockfile --filter @medisync/api...

COPY packages/contracts ./packages/contracts
COPY packages/country-packs ./packages/country-packs
COPY apps/api ./apps/api

RUN pnpm --filter "./packages/*" build && pnpm --filter @medisync/api build

FROM node:22-alpine AS runner
RUN corepack enable pnpm && apk add --no-cache curl
WORKDIR /app
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=4200

COPY --from=builder /app/package.json /app/pnpm-workspace.yaml /app/pnpm-lock.yaml ./
COPY --from=builder /app/packages/contracts/package.json ./packages/contracts/
COPY --from=builder /app/packages/contracts/dist ./packages/contracts/dist
COPY --from=builder /app/packages/country-packs/package.json ./packages/country-packs/
COPY --from=builder /app/packages/country-packs/dist ./packages/country-packs/dist
COPY --from=builder /app/apps/api/package.json ./apps/api/
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/contracts/node_modules ./packages/contracts/node_modules
COPY --from=builder /app/packages/country-packs/node_modules ./packages/country-packs/node_modules
COPY --from=builder /app/apps/api/node_modules ./apps/api/node_modules

USER node
EXPOSE 4200

HEALTHCHECK --interval=15s --timeout=5s --start-period=15s --retries=3 \
  CMD curl -fsS http://127.0.0.1:4200/health || exit 1

CMD ["node", "apps/api/dist/main.js"]
