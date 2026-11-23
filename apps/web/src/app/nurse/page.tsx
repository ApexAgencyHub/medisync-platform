import type { Metadata } from "next";
import { listCountryPacks } from "@medisync/country-packs";
import { NurseWorkspace } from "@/features/nurse-station";
import { resolvePublicApiUrl } from "@/shared/config/deployment";
import { WorkspaceShell } from "@/shared/ui/WorkspaceShell";

export const metadata: Metadata = {
  title: "Nursing & Home Care Station — MediSync Global",
  description:
    "Manage nurse bedside and home-care rounds, vital signs monitoring, care continuation notes, and home-visit rosters.",
};

export const dynamic = "force-dynamic";

export default function NurseWorkspacePage() {
  const packs = [...listCountryPacks()];
  const apiBaseUrl = resolvePublicApiUrl();

  return (
    <WorkspaceShell
      activeRoute="/nurse"
      statusPill="nav.nurse"
      maxWidthClass="max-w-[1560px]"
    >
      <NurseWorkspace packs={packs} apiBaseUrl={apiBaseUrl} />
    </WorkspaceShell>
  );
}
