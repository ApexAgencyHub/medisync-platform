import type { Metadata } from "next";
import { listCountryPacks } from "@medisync/country-packs";
import { BookingWorkspace } from "@/features/booking";
import { resolvePublicApiUrl } from "@/shared/config/deployment";
import { WorkspaceShell } from "@/shared/ui/WorkspaceShell";

export const metadata: Metadata = {
  title: "Doctor Appointments & Clinic Hours — MediSync Global",
  description:
    "Compare open specialist hours and book verified in-person clinic or video teleconsultation appointments.",
};

export const dynamic = "force-dynamic";

export default function BookingPage() {
  const packs = [...listCountryPacks()];
  const apiBaseUrl = resolvePublicApiUrl();

  return (
    <WorkspaceShell activeRoute="/booking">
      <BookingWorkspace packs={packs} apiBaseUrl={apiBaseUrl} />
    </WorkspaceShell>
  );
}
