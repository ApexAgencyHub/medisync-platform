import type { Metadata } from "next";
import { listCountryPacks } from "@medisync/country-packs";
import { HospitalReceptionWorkspace } from "@/features/hospital-workspace";
import { resolvePublicApiUrl } from "@/shared/config/deployment";
import { WorkspaceShell } from "@/shared/ui/WorkspaceShell";

export const metadata: Metadata = {
  title: "Hospital & Clinic Reception Command — MediSync Global",
  description:
    "Update facility operational readiness, check in arriving patients, and coordinate incoming medical transport.",
};

export const dynamic = "force-dynamic";

export default function HospitalWorkspacePage() {
  const packs = [...listCountryPacks()];
  const apiBaseUrl = resolvePublicApiUrl();

  return (
    <WorkspaceShell activeRoute="/hospital">
      <HospitalReceptionWorkspace packs={packs} apiBaseUrl={apiBaseUrl} />
    </WorkspaceShell>
  );
}
