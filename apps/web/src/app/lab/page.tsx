import type { Metadata } from "next";
import { listCountryPacks } from "@medisync/country-packs";
import { LabWorkbench } from "@/features/lab-workbench";
import { resolvePublicApiUrl } from "@/shared/config/deployment";
import { WorkspaceShell } from "@/shared/ui/WorkspaceShell";

export const metadata: Metadata = {
  title: "Diagnostic Lab Workbench — MediSync Global",
  description:
    "Process laboratory orders, track specimen collection, and upload certified lab reports and imaging scans.",
};

export const dynamic = "force-dynamic";

export default function LabWorkspacePage() {
  const packs = [...listCountryPacks()];
  const apiBaseUrl = resolvePublicApiUrl();

  return (
    <WorkspaceShell activeRoute="/lab" statusPill="nav.lab">
      <LabWorkbench packs={packs} apiBaseUrl={apiBaseUrl} />
    </WorkspaceShell>
  );
}
