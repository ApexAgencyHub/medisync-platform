import type { Metadata } from "next";
import { TelehealthConsultationRoom } from "@/features/telehealth";
import { resolvePublicApiUrl } from "@/shared/config/deployment";
import { WorkspaceShell } from "@/shared/ui/WorkspaceShell";

export const metadata: Metadata = {
  title: "Video Medical Consultation — MediSync Global",
  description:
    "Private encrypted doctor-patient video teleconsultation room with real-time clinical diagnosis and QR e-prescriptions.",
};

export const dynamic = "force-dynamic";

export default async function TelehealthConsultationPage({
  params,
}: {
  params: Promise<{ appointmentId: string }>;
}) {
  const { appointmentId } = await params;
  const apiBaseUrl = resolvePublicApiUrl();

  return (
    <WorkspaceShell activeRoute="/booking">
      <TelehealthConsultationRoom
        appointmentId={appointmentId}
        apiBaseUrl={apiBaseUrl}
      />
    </WorkspaceShell>
  );
}
