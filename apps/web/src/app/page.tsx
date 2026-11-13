import Image from "next/image";
import { listCountryPacks } from "@medisync/country-packs";
import {
  CountryPackExplorer,
  EcosystemSlicesGrid,
  HomeCareLaunchpad,
} from "@/features/platform-overview";
import { AppHeader } from "@/shared/ui/AppHeader";

export default function HomePage() {
  const packs = listCountryPacks();

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <AppHeader
        activeRoute="/"
        statusPill={`${packs.length} Regions · 24/7 Care Network`}
      />

      <main className="mx-auto max-w-6xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
        {/* Hero Band */}
        <section className="grid items-center gap-8 lg:grid-cols-12">
          <HomeCareLaunchpad />

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
