import type { Metadata } from "next";
import { listCountryPacks } from "@medisync/country-packs";
import { ClinicalWorkspace } from "@/features/clinical-workspace";
import { resolvePublicApiUrl } from "@/shared/config/deployment";
import { WorkspaceShell } from "@/shared/ui/WorkspaceShell";

export const metadata: Metadata = {
  title: "Clinical Care, QR Prescriptions & Labs — MediSync Global",
  description:
    "Review scheduled consultations, record visit notes, issue verified QR prescriptions, and manage diagnostic lab orders.",
};

export const dynamic = "force-dynamic";

export default function ClinicalPage() {
  const packs = [...listCountryPacks()];
  const apiBaseUrl = resolvePublicApiUrl();

  return (
    <WorkspaceShell activeRoute="/clinical" maxWidthClass="max-w-[1560px]">
      <ClinicalWorkspace packs={packs} apiBaseUrl={apiBaseUrl} />
    </WorkspaceShell>
  );
}
