import { listCountryPacks } from "@medisync/country-packs";
import { DispatchConsole } from "@/features/maps-dispatch";
import { AppHeader } from "@/shared/ui/AppHeader";

export const dynamic = "force-dynamic";

export default function MapPage() {
  const packs = [...listCountryPacks()];
  const apiBaseUrl =
    process.env.API_URL ??
    process.env.NEXT_PUBLIC_API_URL ??
    "http://127.0.0.1:4000";

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <AppHeader activeRoute="/map" />

      <main className="mx-auto max-w-7xl px-4 py-7 sm:px-6 lg:px-8">
        <DispatchConsole packs={packs} apiBaseUrl={apiBaseUrl} />
      </main>
    </div>
  );
}
