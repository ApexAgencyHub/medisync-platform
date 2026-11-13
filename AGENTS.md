# MediSync Global — AI Engineering Contract (`AGENTS.md`)

Inherited from `ApexAgencyHub/Agency-Brain`. Read `SPEC.md` and `DESIGN.md` before modifying or creating any vertical slice.

## 1. Architecture & Isolation Laws
- **Vertical Slice Architecture**: Every domain capability lives under `src/features/<slice>/` in `apps/api`, `apps/web`, and `apps/mobile`.
- **Public Barrel Only**: Cross-slice imports MUST go through `@/features/<slice>` (`index.ts`). Deep imports across slices are blocked by ESLint.
- **Contracts First**: Shared Zod schemas, RBAC roles, jurisdiction schemas, and error payloads live in `@medisync/contracts`. Backend, Web, and Mobile must derive types from `@medisync/contracts` (`z.infer`)—never duplicate manual DTOs.
- **Branch-Per-Slice Delivery**: Every new slice is developed and verified on its own `feat/<slice>` branch before merging into `main`.

## 2. Performance & Security Non-Negotiables
- **Zero `any`**: TypeScript `strict: true`, `noUncheckedIndexedAccess: true`, `exactOptionalPropertyTypes: true`.
- **Two-Tier Geospatial Split**: Static clinics/hospitals/pharmacies/labs use PostgreSQL + PostGIS viewport bounding-box queries with spatial indexes. Moving drivers/ambulances stream coordinates via Redis Geo + SSE/WebSockets; Postgres records dispatch state transitions only.
- **Heavy Media & Files**: Scans, lab PDFs, and clinical records upload directly to S3/R2 via presigned URLs with strict byte-size and MIME validation. Never buffer large files in Node server memory.
- **Server-First Web UI**: Initial loads happen in Next.js Server Components; never wrap primary page loads in `useEffect` fetch waterfalls. All lists/tables use bounded cursor pagination or virtualization.

## 3. Mandatory Verification Gate
Run after every slice before reporting completion or opening a PR:
```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm test:e2e
```
