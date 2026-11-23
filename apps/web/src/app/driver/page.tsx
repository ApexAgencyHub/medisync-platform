import type { Metadata } from "next";
import { listCountryPacks } from "@medisync/country-packs";
import { DispatchConsole } from "@/features/maps-dispatch";
import { resolvePublicApiUrl } from "@/shared/config/deployment";
import { AppHeader } from "@/shared/ui/AppHeader";

export const metadata: Metadata = {
  title: "Ambulance & Medical Transport Dispatch — MediSync Global",
  description:
    "Accept nearby emergency pickups, share live vehicle status, and coordinate direct hospital transfers.",
};

export const dynamic = "force-dynamic";

export default function DriverWorkspacePage() {
  const packs = [...listCountryPacks()];
  const apiBaseUrl = resolvePublicApiUrl();

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-[#F3F8FD] text-[#0F243E]">
      <AppHeader activeRoute="/driver" />

      <main className="relative min-h-0 flex-1 overflow-hidden">
        <DispatchConsole
          packs={packs}
          apiBaseUrl={apiBaseUrl}
          workspaceMode="driver"
        />
      </main>
    </div>
  );
}
