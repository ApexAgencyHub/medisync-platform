# MediSync Global (`medisync-platform`)

Universal, multi-jurisdiction medical coordination ecosystem across **Web** (`apps/web`), **iOS & Android** (`apps/mobile`), and **API** (`apps/api`), built using **ApexAgencyHub/Agency-Brain** Vertical Slice Architecture.

## Workspaces

- `packages/contracts` — Shared Zod schemas, RBAC roles, geospatial bounds, and audit contracts
- `packages/country-packs` — Pluggable per-country compliance, localization (RTL/LTR), currency, and emergency hotline packs
- `packages/design-tokens` — Unified "Clinical Trust" palette, typography, and spacing tokens for Web and Mobile
- `apps/api` — Fastify + TypeScript strict backend service
- `apps/web` — Next.js App Router web application
- `apps/mobile` — Expo / React Native iOS & Android app shell

## Verification Commands

```bash
pnpm install
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm test:e2e
```
