import type { Metadata } from "next";
import { listCountryPacks } from "@medisync/country-packs";
import { PatientHubWorkspace } from "@/features/patient-hub";
import { resolvePublicApiUrl } from "@/shared/config/deployment";
import { WorkspaceShell } from "@/shared/ui/WorkspaceShell";

export const metadata: Metadata = {
  title: "My Care Hub & Medical File — MediSync Global",
  description:
    "Track scheduled consultations and prescriptions, manage allergies and insurance policies, and open live emergency dispatch.",
};

export const dynamic = "force-dynamic";

export default function PatientCareHubPage() {
  const packs = [...listCountryPacks()];
  const apiBaseUrl = resolvePublicApiUrl();

  return (
    <WorkspaceShell activeRoute="/patient">
      <PatientHubWorkspace packs={packs} apiBaseUrl={apiBaseUrl} />
    </WorkspaceShell>
  );
}
