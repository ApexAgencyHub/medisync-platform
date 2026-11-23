import type { Metadata } from "next";
import { listCountryPacks } from "@medisync/country-packs";
import { PharmacyStorefront } from "@/features/pharmacy-commerce";
import { resolvePublicApiUrl } from "@/shared/config/deployment";
import { WorkspaceShell } from "@/shared/ui/WorkspaceShell";

export const metadata: Metadata = {
  title: "24/7 Duty Pharmacy, Parapharmacy & QR Dispensing — MediSync Morocco",
  description:
    "Browse licensed Moroccan pharmacies (Law 17-04), verify digital QR prescriptions for in-person counter dispensing, and order parapharmacy & OTC essentials.",
};

export const dynamic = "force-dynamic";

export default function PharmacyPage() {
  const apiBaseUrl = resolvePublicApiUrl();

  return (
    <WorkspaceShell activeRoute="/pharmacy">
      <PharmacyStorefront
        packs={listCountryPacks()}
        apiBaseUrl={apiBaseUrl}
      />
    </WorkspaceShell>
  );
}
