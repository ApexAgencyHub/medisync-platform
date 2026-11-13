import Image from "next/image";
import { UserRoleSchema } from "@medisync/contracts";
import { listCountryPacks } from "@medisync/country-packs";
import {
  CountryPackExplorer,
  EcosystemSlicesGrid,
} from "@/features/platform-overview";
import { AppHeader } from "@/shared/ui/AppHeader";

export default function HomePage() {
  const packs = listCountryPacks();
  const roleCount = UserRoleSchema.options.length;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <AppHeader
        activeRoute="/"
        statusPill={`${packs.length} CountryPacks · ${roleCount} RBAC Roles`}
      />

      <main className="mx-auto max-w-6xl space-y-10 px-4 py-8 sm:px-6 sm:py-12">
        <section className="grid items-center gap-8 lg:grid-cols-12">
          <div className="space-y-4 lg:col-span-6">
            <p className="font-mono-tabular text-xs font-semibold uppercase tracking-wider text-teal-800">
              Clinical Trust Design System · Vertical Slice Monorepo
            </p>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              Global medical coordination built for clinics, hospitals, drivers, and patients.
            </h1>
            <p className="text-base leading-relaxed text-slate-600">
              Engineered on isolated vertical slices with strict Zod contracts, PostGIS viewport
              discovery, Redis Geo dispatch, and sovereign CountryPack localization ready for any
              national health authority.
            </p>
            <div className="grid grid-cols-3 gap-3 pt-2">
              <div className="rounded-xl border border-slate-200 bg-white p-3">
                <div className="font-mono-tabular text-lg font-bold text-slate-900">
                  PostGIS
                </div>
                <div className="text-xs text-slate-500">Static facility map</div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-3">
                <div className="font-mono-tabular text-lg font-bold text-teal-800">
                  Redis Geo
                </div>
                <div className="text-xs text-slate-500">Live driver stream</div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-3">
                <div className="font-mono-tabular text-lg font-bold text-slate-900">
                  S3 Direct
                </div>
                <div className="text-xs text-slate-500">Presigned scans</div>
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 shadow-xs lg:col-span-6">
            <Image
              src="/media/clinical-map-hero.webp"
              alt="Isometric medical district coordination map connecting hospital, clinic, pharmacy, and ambulances"
              width={1408}
              height={768}
              priority
              className="h-auto w-full rounded-xl object-cover"
            />
          </div>
        </section>

        <CountryPackExplorer packs={packs} />
        <EcosystemSlicesGrid />
      </main>
    </div>
  );
}
