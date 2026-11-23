import type { Metadata } from "next";
import { listCountryPacks } from "@medisync/country-packs";
import { AuthenticatedProfileWorkspace } from "@/features/auth-portal";
import { resolvePublicApiUrl } from "@/shared/config/deployment";
import { WorkspaceShell } from "@/shared/ui/WorkspaceShell";

export const metadata: Metadata = {
  title: "My Profile & Account — MediSync Global",
  description:
    "Manage your verified contact details, profile photo, security password, active sessions, and professional licenses.",
};

export const dynamic = "force-dynamic";

export default function ProfilePage() {
  const packs = [...listCountryPacks()];
  const apiBaseUrl = resolvePublicApiUrl();

  return (
    <WorkspaceShell activeRoute="/profile" maxWidthClass="max-w-5xl">
      <AuthenticatedProfileWorkspace packs={packs} apiBaseUrl={apiBaseUrl} />
    </WorkspaceShell>
  );
}
