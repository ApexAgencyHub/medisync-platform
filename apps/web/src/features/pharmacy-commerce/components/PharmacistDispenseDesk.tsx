"use client";

import { useEffect, useState, type FormEvent } from "react";
import { AlertTriangle, CheckCircle2, Printer, QrCode, Search } from "lucide-react";
import type { AllergyWarning, PrescriptionSummary } from "@medisync/contracts";
import { useLocale } from "@/shared/i18n/locale-store";
import { QrPrescriptionCard } from "@/shared/ui/QrPrescriptionCard";
import {
  formatPractitionerDisplayName,
  UiBadge,
  UiButton,
  UiInput,
  UiSwitch,
} from "@/shared/ui/primitives";
import { MoroccanComplianceBadge } from "@/shared/ui/TactileControls";
import { PHARMA_COPY } from "../pharmacy-i18n";

interface PharmacistDispenseDeskProps {
  qrInput: string;
  verifiedRx: PrescriptionSummary | null;
  allergyWarnings?: readonly AllergyWarning[] | undefined;
  dispenseNote: string;
  staffRxQueue: readonly PrescriptionSummary[];
  busy: boolean;
  onQrInputChange: (next: string) => void;
  onDispenseNoteChange: (next: string) => void;
  onVerifyQr: (e: FormEvent<HTMLFormElement>) => void;
  onDispenseRx: (prescriptionId: string) => void;
}

/** Clinical Pharmacist E-Prescription verification scanner & active script queue. */
export function PharmacistDispenseDesk({
  qrInput,
  verifiedRx,
  allergyWarnings = [],
  dispenseNote,
  staffRxQueue,
  busy,
  onQrInputChange,
  onDispenseNoteChange,
  onVerifyQr,
  onDispenseRx,
}: PharmacistDispenseDeskProps) {
  const { locale } = useLocale();
  const copy = PHARMA_COPY[locale];
  const [queueFilter, setQueueFilter] = useState<"ALL" | "ISSUED" | "DISPENSED">(
    "ALL",
  );
  const [queueSearch, setQueueSearch] = useState("");
  const [allergyOverrideAck, setAllergyOverrideAck] = useState(false);

  useEffect(() => {
    setAllergyOverrideAck(false);
  }, [verifiedRx?.id]);

  const issuedCount = staffRxQueue.filter((r) => r.status === "ISSUED").length;
  const dispensedCount = staffRxQueue.filter(
    (r) => r.status === "DISPENSED",
  ).length;

  const visibleQueue = staffRxQueue.filter((rx) => {
    if (queueFilter !== "ALL" && rx.status !== queueFilter) return false;
    if (queueSearch.trim()) {
      const q = queueSearch.trim().toLowerCase();
      const hay = `${rx.patientName} ${rx.doctorName} ${rx.qrToken} ${rx.medications.map((m) => m.name).join(" ")}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const nextReadyRx = staffRxQueue.find((r) => r.status === "ISSUED") ?? null;
  const activeStep =
    verifiedRx?.status === "DISPENSED"
      ? 2
      : verifiedRx
        ? 1
        : 0;

  const ui =
    locale === "fr"
      ? {
          loadNextQr: "Charger le QR suivant",
          steps: ["1. Scanner QR", "2. Contrôle Allergies", "3. Délivrer (Loi 17-04)"] as const,
          allergyTitle: "Contre-indication Allergique Détectée",
          allergyAck: "Dérogation clinique : prescripteur confirmé",
          printLabel: "Étiquette",
          notePresets: [
            "Identité patient vérifiée au comptoir (Loi 17-04)",
            "Posologie expliquée & substitution DCI validée",
            "Chaîne du froid 2-8°C scellée",
          ] as const,
        }
      : locale === "ar"
        ? {
            loadNextQr: "تحميل رمز QR التالي",
            steps: ["1. مسح QR", "2. فحص الحساسية", "3. صرف بالصيدلية (17-04)"] as const,
            allergyTitle: "تحذير: تعارض حساسية دوائية",
            allergyAck: "تجاوز سريري: تأكيد الطبيب الواصف",
            printLabel: "طباعة الملصق",
            notePresets: [
              "تم التحقق من هوية المريض بالصيدلية (قانون 17-04)",
              "تم شرح الجرعة والموافقة على الدواء الجنيس",
              "تم تأمين سلسلة التبريد 2-8°C",
            ] as const,
          }
        : {
            loadNextQr: "Load Next QR",
            steps: ["1. Scan / Load QR", "2. Allergy Check", "3. Dispense & Sign"] as const,
            allergyTitle: "Allergy Contraindication Detected",
            allergyAck: "Clinical override: prescriber confirmed safe to dispense",
            printLabel: "Print Label",
            notePresets: [
              "Verified patient ID at counter (Law 17-04)",
              "Dosage & DCI generic counselled with patient",
              "Cold-chain thermal pack sealed",
            ] as const,
          };

  return (
    <div className="space-y-4">
      {/* Live Smart Pharmacist Counter Reminder Strip */}
      {issuedCount > 0 && !verifiedRx ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#BFDBFE] bg-gradient-to-r from-[#EBF4FF] via-white to-[#F3F8FD] px-4 py-3 text-xs">
          <div className="flex items-center gap-2.5">
            <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#0066CC] text-white">
              <QrCode className="h-4 w-4" aria-hidden="true" />
            </span>
            <div>
              <p className="font-bold text-[#0F243E]">
                {issuedCount} {copy.readyToDispenseWord}
              </p>
              <p className="text-[#4A627D]">
                {nextReadyRx
                  ? `${nextReadyRx.patientName} · ${nextReadyRx.medications[0]?.name ?? ""}`
                  : copy.activeQueueHeading}
              </p>
            </div>
          </div>
          {nextReadyRx ? (
            <UiButton
              type="button"
              size="sm"
              variant="primary"
              onClick={() => onQrInputChange(nextReadyRx.qrToken)}
            >
              {ui.loadNextQr}
            </UiButton>
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-12">
      <section className="space-y-4 rounded-2xl border border-[#D7E4F2] bg-white p-5 shadow-[0_6px_22px_-12px_rgba(15,36,62,0.08)] lg:col-span-6">
        <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-[#E8F1FA] pb-3">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#BFDBFE] bg-[#EBF4FF] text-[#0066CC]">
              <QrCode className="h-4 w-4" aria-hidden="true" />
            </span>
            <h2 className="font-editorial text-base font-bold text-[#0F243E]">
              {copy.dispenseDeskTitle}
            </h2>
          </div>
          <MoroccanComplianceBadge domain="pharmacy" locale={locale} />
        </div>

        {/* Visual 3-Step Dispense Workflow Indicator */}
        <div className="grid grid-cols-3 gap-2">
          {ui.steps.map(
            (stepLabel, idx) => (
              <div key={stepLabel} className="space-y-1">
                <div
                  className={`h-1.5 rounded-full ${
                    idx <= activeStep
                      ? activeStep === 2
                        ? "bg-[#0F9D88]"
                        : "bg-[#0066CC]"
                      : "bg-[#D7E4F2]"
                  }`}
                />
                <span
                  className={`block truncate text-[10.5px] font-semibold ${
                    idx <= activeStep ? "text-[#0F243E]" : "text-[#87A0BC]"
                  }`}
                >
                  {stepLabel}
                </span>
              </div>
            ),
          )}
        </div>

        <form onSubmit={onVerifyQr} className="space-y-3">
          <div>
            <label
              htmlFor="pharma-qr-input"
              className="block text-xs font-semibold text-slate-700"
            >
              {copy.qrTokenLabel}
            </label>
            <UiInput
              id="pharma-qr-input"
              type="text"
              required
              placeholder="MEDISYNC-RX-..."
              value={qrInput}
              onChange={(e) => onQrInputChange(e.target.value)}
              className="mt-1 bg-white font-mono-tabular text-xs shadow-2xs"
            />
          </div>
          <UiButton type="submit" disabled={busy || !qrInput.trim()}>
            <QrCode className="h-4 w-4" aria-hidden="true" />
            <span>{copy.verifyQrBtn}</span>
          </UiButton>
        </form>

        {verifiedRx ? (
          <div className="space-y-3 rounded-xl border border-[#B2E5DC] bg-white p-4 text-xs shadow-xs ring-2 ring-[#0F9D88]/20">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="space-y-1.5">
                <p className="text-sm font-bold text-[#0F243E]">
                  {copy.patientLabel} <bdi dir="auto">{verifiedRx.patientName}</bdi>{" "}
                  · {copy.prescriberLabel}{" "}
                  <bdi dir="auto">
                    {formatPractitionerDisplayName(verifiedRx.doctorName)}
                  </bdi>
                </p>
                <ul className="space-y-1.5 rounded-xl border border-[#D7E4F2] bg-[#F8FBFE] p-3 text-slate-700">
                  {verifiedRx.medications.map((med, idx) => (
                    <li key={`${med.name}-${idx}`}>
                      <strong>{med.name}</strong> ({med.dosage}) · {med.frequency}{" "}
                      · {med.durationDays} {copy.daysWord}
                      {med.instructions ? ` — ${med.instructions}` : ""}
                    </li>
                  ))}
                </ul>
                {allergyWarnings.length > 0 ? (
                  <div className="space-y-2 rounded-xl border border-rose-300 bg-rose-50 px-3 py-2.5 text-xs font-medium text-rose-950">
                    <p className="flex items-center gap-1.5 font-bold text-rose-800">
                      <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
                      <span>{ui.allergyTitle}</span>
                    </p>
                    {allergyWarnings.map((w, idx) => (
                      <p key={`${w.allergen}-${idx}`}>{w.message}</p>
                    ))}
                    {verifiedRx.status === "ISSUED" ? (
                      <UiSwitch
                        checked={allergyOverrideAck}
                        onChange={setAllergyOverrideAck}
                        label={ui.allergyAck}
                      />
                    ) : null}
                  </div>
                ) : null}

                {verifiedRx.notes ? (
                  <p className="text-slate-600">
                    {copy.clinicalNotePrefix} <strong>{verifiedRx.notes}</strong>
                  </p>
                ) : null}
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex h-7 items-center gap-1 rounded-lg border border-[#CBDDF0] bg-[#F3F8FD] px-2.5 text-[11px] font-semibold text-[#0F243E] hover:bg-white hover:text-[#0066CC]"
                >
                  <Printer className="h-3 w-3" aria-hidden="true" />
                  <span>{ui.printLabel}</span>
                </button>
                <UiBadge
                  tone={
                    verifiedRx.status === "DISPENSED"
                      ? "emerald"
                      : verifiedRx.status === "CANCELLED"
                        ? "red"
                        : "teal"
                  }
                >
                  {verifiedRx.status}
                </UiBadge>
              </div>
            </div>

            {verifiedRx.status === "ISSUED" ? (
              <div className="space-y-2 border-t border-[#D7E4F2] pt-3">
                <label
                  htmlFor="pharma-dispense-note"
                  className="block text-xs font-semibold text-[#2F4661]"
                >
                  {copy.dispensingNoteLabel}
                </label>
                <div className="flex flex-wrap gap-1">
                  {ui.notePresets.map((notePreset) => (
                    <button
                      key={notePreset}
                      type="button"
                      onClick={() => onDispenseNoteChange(notePreset)}
                      className="rounded-full border border-[#BFDBFE] bg-[#EBF4FF] px-2.5 py-0.5 text-[10.5px] font-semibold text-[#0052A3] hover:bg-[#0066CC] hover:text-white"
                    >
                      {notePreset}
                    </button>
                  ))}
                </div>
                <UiInput
                  id="pharma-dispense-note"
                  type="text"
                  placeholder={copy.dispensingNotePlaceholder}
                  value={dispenseNote}
                  onChange={(e) => onDispenseNoteChange(e.target.value)}
                  className="text-xs"
                />
                <UiButton
                  type="button"
                  disabled={
                    busy || (allergyWarnings.length > 0 && !allergyOverrideAck)
                  }
                  onClick={() => {
                    if (allergyWarnings.length > 0 && !allergyOverrideAck) return;
                    onDispenseRx(verifiedRx.id);
                  }}
                  className="w-full"
                >
                  <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                  <span>{copy.confirmDispenseBtn}</span>
                </UiButton>
              </div>
            ) : verifiedRx.dispensingNote ? (
              <p className="border-t border-[#D7E4F2] pt-2 text-slate-600">
                {copy.dispensingRecordPrefix}{" "}
                <strong>{verifiedRx.dispensingNote}</strong>
              </p>
            ) : null}
          </div>
        ) : null}
      </section>

      <section className="space-y-3 rounded-2xl border border-[#D7E4F2] bg-white p-5 shadow-[0_6px_22px_-12px_rgba(15,36,62,0.08)] lg:col-span-6">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#D7E4F2] pb-3">
          <div>
            <h2 className="text-base font-bold text-[#0F243E]">
              {copy.activeQueueHeading} ({staffRxQueue.length})
            </h2>
            <p className="font-mono-tabular text-[11px] text-slate-500">
              {issuedCount} {copy.readyToDispenseWord} · {dispensedCount}{" "}
              {copy.completedWord}
            </p>
          </div>
          <div className="flex gap-1">
            {(["ALL", "ISSUED", "DISPENSED"] as const).map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setQueueFilter(st)}
                className={`h-7 rounded-lg px-2.5 text-[11px] font-semibold transition ${
                  queueFilter === st
                    ? "bg-[#0F243E] text-white"
                    : "border border-[#CBDDF0] bg-[#F3F8FD] text-slate-600 hover:bg-white hover:text-[#0F243E]"
                }`}
              >
                {st === "ALL"
                  ? copy.queueFilterAll
                  : st === "ISSUED"
                    ? copy.queueFilterReady
                    : copy.queueFilterDispensed}
              </button>
            ))}
          </div>
        </div>

        {staffRxQueue.length > 0 ? (
          <div className="flex h-9 items-center gap-2 rounded-lg border border-[#D8DFDC] bg-[#F3F8FD] px-3 focus-within:border-[#0066CC] focus-within:bg-white">
            <Search className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
            <input
              type="search"
              value={queueSearch}
              onChange={(e) => setQueueSearch(e.target.value)}
              placeholder={copy.queueSearchPlaceholder}
              className="min-w-0 flex-1 bg-transparent text-xs text-[#0F243E] placeholder:text-slate-400 focus:outline-none"
            />
          </div>
        ) : null}

        {visibleQueue.length === 0 ? (
          <p className="rounded-lg border border-[#D7E4F2] bg-[#F3F8FD] p-4 text-xs text-slate-600">
            {staffRxQueue.length === 0
              ? copy.queueEmptyNone
              : copy.queueEmptyFiltered}
          </p>
        ) : (
          <div className="max-h-[460px] space-y-3 overflow-y-auto pe-1 [scrollbar-width:thin]">
            {visibleQueue.map((rx) => (
              <QrPrescriptionCard
                key={rx.id}
                prescription={rx}
                onUseForDispense={(token) => onQrInputChange(token)}
              />
            ))}
          </div>
        )}
      </section>
      </div>
    </div>
  );
}
