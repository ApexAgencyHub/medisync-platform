import type { Metadata } from "next";
import { listCountryPacks } from "@medisync/country-packs";
import { DispatchConsole } from "@/features/maps-dispatch";
import { resolvePublicApiUrl } from "@/shared/config/deployment";
import { AppHeader } from "@/shared/ui/AppHeader";

export const metadata: Metadata = {
  title: "Live Care Map & Dispatch — MediSync Global",
  description:
    "Discover verified hospitals, clinics, pharmacies, and nearby ambulances with real-time emergency pickup dispatch.",
};

export const dynamic = "force-dynamic";

export default function MapPage() {
  const packs = [...listCountryPacks()];
  const apiBaseUrl = resolvePublicApiUrl();

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-[#F3F8FD] text-[#0F243E]">
      <AppHeader activeRoute="/map" />

      <main className="relative min-h-0 flex-1 overflow-hidden">
        <DispatchConsole
          packs={packs}
          apiBaseUrl={apiBaseUrl}
          workspaceMode="public"
        />
      </main>
    </div>
  );
}
