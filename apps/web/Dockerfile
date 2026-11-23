# Production multi-stage standalone Next.js build for MediSync Global Web
FROM node:22-alpine AS builder
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@11.24.0 --activate

ARG NEXT_PUBLIC_API_URL=https://api.medisync.example.com
ARG NEXT_PUBLIC_DEFAULT_COUNTRY=MA
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
ENV NEXT_PUBLIC_DEFAULT_COUNTRY=${NEXT_PUBLIC_DEFAULT_COUNTRY}
ENV NEXT_STANDALONE=1

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/contracts/package.json ./packages/contracts/package.json
COPY packages/country-packs/package.json ./packages/country-packs/package.json
COPY packages/design-tokens/package.json ./packages/design-tokens/package.json
COPY apps/api/package.json ./apps/api/package.json
COPY apps/mobile/package.json ./apps/mobile/package.json
COPY apps/web/package.json ./apps/web/package.json

RUN pnpm install --frozen-lockfile --filter @medisync/web...

COPY packages ./packages
COPY apps/web ./apps/web

RUN pnpm --filter @medisync/contracts build \
  && pnpm --filter @medisync/country-packs build \
  && pnpm --filter @medisync/web build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001
USER nextjs

COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/public ./apps/web/public

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT:-3000}/" || exit 1

CMD ["node", "apps/web/server.js"]
