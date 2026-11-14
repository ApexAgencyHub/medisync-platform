import { listCountryPacks } from "@medisync/country-packs";
import {
  CountryPackExplorer,
  EcosystemSlicesGrid,
  HomeCareLaunchpad,
} from "@/features/platform-overview";
import { AppHeader } from "@/shared/ui/AppHeader";
import { ZoomableHeroImage } from "@/shared/ui/ZoomableHeroImage";

export default function HomePage() {
  const packs = listCountryPacks();

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <AppHeader
        activeRoute="/"
        statusPill={`${packs.length} Regions · 24/7 Care Network`}
      />

      <main className="mx-auto max-w-7xl space-y-8 px-4 py-7 sm:px-6 lg:px-8">
        {/* Hero Band */}
        <section className="grid items-center gap-8 lg:grid-cols-12">
          <HomeCareLaunchpad />

          <div className="lg:col-span-6">
            <ZoomableHeroImage
              src="/media/clinical-map-hero.webp"
              alt="Isometric medical district coordination map connecting hospital, clinic, pharmacy, and ambulances"
              title="Connected Medical Care District Overview"
              subtitle="Hospital Intake · Specialty Clinics · 24/7 Pharmacies · Emergency Dispatch"
            />
          </div>
        </section>

        <CountryPackExplorer packs={packs} />
        <EcosystemSlicesGrid />
      </main>
    </div>
  );
}
