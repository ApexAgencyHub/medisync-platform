import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { listCountryPacks } from "@medisync/country-packs";
import { PatientPortalWorkspace } from "@/features/auth-portal";
import { resolvePublicApiUrl } from "@/shared/config/deployment";
import { WorkspaceShell } from "@/shared/ui/WorkspaceShell";

export const metadata: Metadata = {
  title: "Patient & Family Sign In — MediSync Global",
  description:
    "Sign in or register as a patient or family caregiver using SMS OTP, phone, email, or Google to book care and track visits.",
};

export const dynamic = "force-dynamic";

type SearchParamValue = string | string[] | undefined;

function firstParam(val: SearchParamValue): string | undefined {
  return Array.isArray(val) ? val[0] : val;
}

export default async function PortalPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, SearchParamValue>>;
}) {
  const resolved = searchParams ? await searchParams : {};
  const track = firstParam(resolved.track);
  const tab = firstParam(resolved.tab);
  const role = firstParam(resolved.role);

  if (track === "staff" || tab === "facility") {
    const query = new URLSearchParams();
    if (tab && tab !== "signin") query.set("tab", tab);
    if (role) query.set("role", role);
    const qs = query.toString();
    redirect(qs ? `/pro?${qs}` : "/pro");
  }

  const packs = [...listCountryPacks()];
  const apiBaseUrl = resolvePublicApiUrl();

  return (
    <WorkspaceShell activeRoute="/portal" maxWidthClass="max-w-5xl">
      <PatientPortalWorkspace packs={packs} apiBaseUrl={apiBaseUrl} />
    </WorkspaceShell>
  );
}
