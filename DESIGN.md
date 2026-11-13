# MediSync Global — Design System (`DESIGN.md`)

## 1. Visual Identity: "Clinical Trust"
Every interface across **Web** (`apps/web`), **iOS**, and **Android** (`apps/mobile`) uses the shared `@medisync/design-tokens` package while adapting layout ergonomics to each device form factor.

- **Canvas & Surfaces**: Warm alabaster (`#F8FAFC`) canvas, crisp white (`#FFFFFF`) elevated panels, subtle slate borders (`#E2E8F0`).
- **Ink Hierarchy**: Deep clinical slate (`#0F172A`) primary ink, muted slate (`#475569`) secondary text.
- **Brand & Status Accents**: Deep medical teal (`#0D7377`) primary brand action, precision emerald (`#059669`) verified/open, amber (`#D97706`) triage warning, crimson (`#DC2626`) emergency/critical.
- **Typography**: `Plus Jakarta Sans` for crisp UI legibility + `JetBrains Mono` (`tabular-nums`) for clinical IDs, timestamps, distances, and vitals.

## 2. Explicit Anti-Slop Bans
- Zero dark-mode purple/cyan neon hero gradients or glowing decorative blobs.
- Zero generic placeholder emoji icons in production UI—always use the custom transparent **MediSync Global** brand mark (`public/brand/`) and semantic vector icons.
- Zero horizontal scroll overflow at Mobile (`390x844`) or Desktop (`1440x900`).

## 3. Multi-Interface Parity Rules
- **Web (`apps/web`)**: Dense operational dashboards, split-pane map + facility drawer, keyboard-friendly data tables.
- **Mobile (`apps/mobile` — iOS & Android)**: Bottom-sheet map explorer, thumb-zone emergency & booking actions, native GPS tracking hooks for drivers, localized RTL/LTR layouts.
