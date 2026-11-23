import type { Metadata } from "next";
import { listCountryPacks } from "@medisync/country-packs";
import { AdminWorkspace } from "@/features/admin-ops";
import { resolvePublicApiUrl } from "@/shared/config/deployment";
import { WorkspaceShell } from "@/shared/ui/WorkspaceShell";

export const metadata: Metadata = {
  title: "Operations & Compliance Center — MediSync Global",
  description:
    "Review healthcare facility licenses and practitioner credentials, oversee live dispatch operations, and resolve service disputes.",
};

export const dynamic = "force-dynamic";

export default function AdminPage() {
  const packs = [...listCountryPacks()];
  const apiBaseUrl = resolvePublicApiUrl();

  return (
    <WorkspaceShell activeRoute="/admin">
      <AdminWorkspace packs={packs} apiBaseUrl={apiBaseUrl} />
    </WorkspaceShell>
  );
}
