# MediSync Global — System Specification (`SPEC.md`)

## 1. Vision & Scope
Global, multi-jurisdiction medical coordination ecosystem uniting **Patients & Caregivers**, **Doctors**, **Clinics**, **Hospitals & ERs**, **Medical Transport Drivers**, **Pharmacies**, **Diagnostic Labs**, and **Platform Operations Admins** across Web, iOS, and Android.

Built generically for any country or government health authority via pluggable **CountryPack** adapters (`@medisync/country-packs`) and sovereign regional deployment isolation.

## 2. Stack & Monorepo Architecture
- **Workspace**: `pnpm` monorepo (`packages/` + `apps/`)
- **Shared Contracts**: `@medisync/contracts` (Zod schemas, RBAC enums, geospatial queries, audit schema)
- **Localization & Jurisdiction Engine**: `@medisync/country-packs` (country config, RTL/LTR locale flags, emergency numbers, license formats, currency/units)
- **Design System**: `@medisync/design-tokens` (shared Web CSS tokens + React Native iOS/Android tokens)
- **Backend API (`apps/api`)**: Node.js + TypeScript Strict + Fastify (moving to PostgreSQL/PostGIS + Redis Geo + S3 presigned media in feature slices)
- **Web (`apps/web`)**: Next.js App Router + Tailwind CSS + Radix primitives + Playwright E2E
- **Mobile (`apps/mobile`)**: Expo / React Native (iOS & Android) sharing `@medisync/contracts`, `@medisync/country-packs`, and `@medisync/design-tokens`

## 3. Core Vertical Slices Roadmap
| Phase / Slice | Scope | Primary Acceptance Criteria |
| :--- | :--- | :--- |
| **Phase 0 (`skeleton`)** | Monorepo contracts, `CountryPack` engine, Design Tokens, brand assets, CI, health/overview Web + API + Mobile shell | `typecheck`, `lint`, `test`, `build`, and multi-viewport Playwright smoke pass |
| **Slice 1 (`foundation`)** | Multi-tenant Auth, RBAC across all 8 actor roles + super admin, Postgres schema + migrations + audit log | Server-enforced `facilityId` & `countryCode` scoping; role tests pass |
| **Slice 2 (`maps-dispatch`)** | PostGIS clinic/hospital/pharmacy/lab viewport search + Redis Geo live driver GPS & SSE dispatch | Spatial queries < 50ms p95 on indexed datasets; zero client full-table loads |
| **Slice 3 (`booking`)** | Doctor multi-clinic schedules, slot generation, transactional double-booking locks | Concurrent booking race tests pass cleanly |
| **Slice 4 (`clinical-pharmacy-labs`)** | Visit notes, QR e-prescriptions, pharmacy dispensing, lab orders, presigned S3/R2 scan uploads | Strict MIME/byte caps; zero heavy files buffered in API memory |
| **Slice 5 (`admin-ops`)** | Master Operations Admin Portal: license verification, manual dispatch override, disputes, audit inspection | Full immutable audit log coverage on every admin mutation |

## 4. Sovereign & Security Boundaries
- Every private query and mutation requires authenticated session + explicit role/tenant/country scope check on the server.
- Regional deployments isolate PostgreSQL and object storage per jurisdiction so governments retain patient data within national borders.
