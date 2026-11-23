import type { Metadata } from "next";
import { listCountryPacks } from "@medisync/country-packs";
import { ProPortalWorkspace } from "@/features/auth-portal";
import { resolvePublicApiUrl } from "@/shared/config/deployment";
import { WorkspaceShell } from "@/shared/ui/WorkspaceShell";

export const metadata: Metadata = {
  title: "MediSync Pro — Staff, Clinic, Pharmacy & Fleet Portal",
  description:
    "Dedicated enterprise portal for physicians, nurses, pharmacists, diagnostic labs, medical drivers, and healthcare facility licensing.",
};

export const dynamic = "force-dynamic";

export default function ProPortalPage() {
  const packs = [...listCountryPacks()];
  const apiBaseUrl = resolvePublicApiUrl();

  return (
    <WorkspaceShell activeRoute="/pro">
      <ProPortalWorkspace packs={packs} apiBaseUrl={apiBaseUrl} />
    </WorkspaceShell>
  );
}
