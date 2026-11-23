import type { Metadata } from "next";
import { listCountryPacks } from "@medisync/country-packs";
import { ProfilesDirectory } from "@/features/directory";
import { resolvePublicApiUrl } from "@/shared/config/deployment";
import { WorkspaceShell } from "@/shared/ui/WorkspaceShell";

export const metadata: Metadata = {
  title: "Care Providers & Verified Facilities — MediSync Global",
  description:
    "Browse verified doctors, home nurses, licensed medical centers, and active ambulance transport vehicles.",
};

export const dynamic = "force-dynamic";

export default function ProfilesPage() {
  const packs = [...listCountryPacks()];
  const apiBaseUrl = resolvePublicApiUrl();

  return (
    <WorkspaceShell activeRoute="/profiles">
      <ProfilesDirectory packs={packs} apiBaseUrl={apiBaseUrl} />
    </WorkspaceShell>
  );
}
