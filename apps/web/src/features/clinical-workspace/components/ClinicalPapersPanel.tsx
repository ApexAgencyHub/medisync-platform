"use client";

import { useState, type FormEvent } from "react";
import type {
  AuthenticatedUser,
  FacilityKind,
  FacilityMediaDocument,
  LocaleCode,
  UserMediaDocument,
} from "@medisync/contracts";
import { CheckCircle2, ShieldCheck } from "lucide-react";
import { ProfileCredentialsPanel } from "@/features/auth-portal";
import { FacilityPapersCard } from "@/features/media-certifications";
import {
  MOROCCAN_SPECIALTY_CHIPS,
  MOROCCAN_TARIFF_PRESETS_MAD,
} from "@/shared/config/morocco-standards";
import { useLocale } from "@/shared/i18n/locale-store";
import { UiButton, UiInput } from "@/shared/ui/primitives";
import {
  ClinicalStepper,
  MoroccanComplianceBadge,
} from "@/shared/ui/TactileControls";

const MA_LICENSE_REGEX = /^MA-[A-Z]{2,4}-[0-9]{4,8}$/;

const NURSE_SPECIALTY_CHIPS: readonly {
  value: string;
  labels: Record<LocaleCode, string>;
}[] = [
  {
    value: "Home Nursing & Wound Care",
    labels: { en: "Home Nursing & Wound Care", fr: "Soins à domicile & Pansements", ar: "تمريض منزلي وتضميد" },
  },
  {
    value: "Post-Op & Injections",
    labels: { en: "Post-Op & Injections", fr: "Post-opératoire & Injections", ar: "ما بعد الجراحة والحقن" },
  },
  {
    value: "Chronic Care & Vitals",
    labels: { en: "Chronic Care & Vitals", fr: "Suivi Chronique & Constantes", ar: "متابعة الأمراض المزمنة" },
  },
  {
    value: "Pediatric Nursing",
    labels: { en: "Pediatric Nursing", fr: "Soins Pédiatriques", ar: "تمريض الأطفال" },
  },
];

const PAPERS_COPY: Record<
  LocaleCode,
  {
    profileTitle: string;
    profileSubtitle: string;
    specialtyLabel: string;
    licenseLabel: string;
    feeLabel: (currency: string) => string;
    saveProfileBtn: string;
    pendingHint: string;
  }
> = {
  en: {
    profileTitle: "Practitioner Registry & Credentials",
    profileSubtitle:
      "Update your clinical specialty, national council license ID, consultation fee, and official verification documents.",
    specialtyLabel: "Clinical Specialty / Scope",
    licenseLabel: "Practitioner Council License ID",
    feeLabel: (currency) => `Consultation Fee (${currency})`,
    saveProfileBtn: "Save Practice Details",
    pendingHint:
      "Upload your practitioner license, degree, and ID below. Administrators review documents before unlocking live patient records.",
  },
  fr: {
    profileTitle: "Registre Praticien & Justificatifs",
    profileSubtitle:
      "Mettez à jour votre spécialité, numéro d'ordre professionnel, tarif de consultation et vos justificatifs officiels.",
    specialtyLabel: "Spécialité / Domaine clinique",
    licenseLabel: "N° d'inscription à l'Ordre",
    feeLabel: (currency) => `Tarif consultation (${currency})`,
    saveProfileBtn: "Enregistrer la fiche",
    pendingHint:
      "Déposez votre attestation d'exercice, diplôme et pièce d'identité ci-dessous pour validation par l'administration.",
  },
  ar: {
    profileTitle: "ملف الممارس والوثائق المهنية",
    profileSubtitle:
      "قم بتحديث التخصص الطبي، رقم الترخيص المهني، تعريفة الاستشارة ورفع الشهادات والتراخيص الرسمية.",
    specialtyLabel: "التخصص أو المجال الطبي",
    licenseLabel: "رقم الترخيص المهني",
    feeLabel: (currency) => `تعريفة الاستشارة (${currency})`,
    saveProfileBtn: "حفظ بيانات المزاولة",
    pendingHint:
      "ارفع رخصة المزاولة والشهادة وبطاقة الهوية أدناه ليتم تفعيل حسابك المهني بعد مراجعة الإدارة.",
  },
};

interface ClinicalPapersPanelProps {
  apiBaseUrl: string;
  token: string;
  user: AuthenticatedUser;
  currencyCode: string;
  isPendingStaff: boolean;
  facilityName?: string | null | undefined;
  facilityKind?: FacilityKind | undefined;
  userDocs: readonly UserMediaDocument[];
  facilityDocs: readonly FacilityMediaDocument[];
  specialtyInput: string;
  mdLicenseInput: string;
  feeMinorInput: string;
  busy: boolean;
  onSpecialtyChange: (value: string) => void;
  onLicenseChange: (value: string) => void;
  onFeeChange: (value: string) => void;
  onSavePracticeProfile: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onBusyChange: (busy: boolean) => void;
  onDocumentsUpdated: () => Promise<void>;
  onFeedback: (tone: "success" | "error" | "info", text: string) => void;
}

/** Clinical credentials, practice registry & linked clinic/lab permits panel (accessible even while PENDING_APPROVAL). */
export function ClinicalPapersPanel({
  apiBaseUrl,
  token,
  user,
  currencyCode,
  isPendingStaff,
  facilityName,
  facilityKind,
  userDocs,
  facilityDocs,
  specialtyInput,
  mdLicenseInput,
  feeMinorInput,
  busy,
  onSpecialtyChange,
  onLicenseChange,
  onFeeChange,
  onSavePracticeProfile,
  onBusyChange,
  onDocumentsUpdated,
  onFeedback,
}: ClinicalPapersPanelProps) {
  const { locale } = useLocale();
  const c = PAPERS_COPY[locale];
  const isPractitioner = user.role === "DOCTOR" || user.role === "NURSE";
  const isNurse = user.role === "NURSE";
  const specialtyChips = isNurse ? NURSE_SPECIALTY_CHIPS : MOROCCAN_SPECIALTY_CHIPS;
  const licenseValid = MA_LICENSE_REGEX.test(mdLicenseInput.trim());
  const formatMinorToMajor = (minorStr: string) => {
    if (minorStr === "") return "";
    const num = Number(minorStr);
    if (!Number.isFinite(num)) return "";
    const major = num / 100;
    return Number.isInteger(major) ? String(major) : major.toFixed(2);
  };
  const [feeMajorDraft, setFeeMajorDraft] = useState<string>(() =>
    formatMinorToMajor(feeMinorInput),
  );
  const [lastSyncedMinor, setLastSyncedMinor] = useState<string>(feeMinorInput);
  if (feeMinorInput !== lastSyncedMinor) {
    setLastSyncedMinor(feeMinorInput);
    setFeeMajorDraft(formatMinorToMajor(feeMinorInput));
  }

  return (
    <div className="space-y-6">
      {isPractitioner && !isPendingStaff ? (
        <section className="rounded-2xl border border-[#D7E4F2] bg-white p-5">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#D7E4F2] pb-3">
            <h2 className="flex items-center gap-2 text-base font-bold text-[#0F243E]">
              <ShieldCheck
                className="h-4 w-4 text-[#0066CC]"
                aria-hidden="true"
              />
              <span>{c.profileTitle}</span>
            </h2>
            <MoroccanComplianceBadge
              domain={isNurse ? "nurse" : "doctor"}
              locale={locale}
            />
          </div>

          <form
            onSubmit={(e) => void onSavePracticeProfile(e)}
            className="mt-4 space-y-4"
          >
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-[#0F243E]">
                  {c.specialtyLabel}
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {specialtyChips.map((chip) => {
                    const active =
                      specialtyInput.trim().toLowerCase() ===
                      chip.value.toLowerCase();
                    return (
                      <button
                        key={chip.value}
                        type="button"
                        onClick={() => onSpecialtyChange(chip.value)}
                        className={`min-h-[32px] rounded-xl border px-3 text-xs font-semibold transition active:scale-[0.98] ${
                          active
                            ? "border-[#0066CC] bg-[#0066CC] text-white shadow-xs"
                            : "border-[#D7E4F2] bg-[#F3F8FD] text-[#2F4661] hover:border-[#0066CC] hover:bg-white"
                        }`}
                      >
                        {chip.labels[locale]}
                      </button>
                    );
                  })}
                </div>
                <UiInput
                  type="text"
                  value={specialtyInput}
                  onChange={(e) => onSpecialtyChange(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5 rounded-xl border border-[#D7E4F2] bg-[#F3F8FD] p-3">
                  <div className="flex items-center justify-between gap-2">
                    <label className="block text-xs font-semibold text-[#0F243E]">
                      {c.licenseLabel}
                    </label>
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono-tabular text-[10px] font-bold ${
                        licenseValid
                          ? "bg-[#E6F7F4] text-[#0B6B5C]"
                          : "bg-white text-[#6B829D]"
                      }`}
                    >
                      {licenseValid ? (
                        <CheckCircle2 className="h-3 w-3 text-[#0F9D88]" aria-hidden="true" />
                      ) : null}
                      <span>{isNurse ? "MA-RN-XXXXX" : "MA-MD-XXXXX"}</span>
                    </span>
                  </div>
                  <UiInput
                    type="text"
                    dir="ltr"
                    value={mdLicenseInput}
                    onChange={(e) => onLicenseChange(e.target.value.toUpperCase())}
                    placeholder={isNurse ? "MA-RN-20418" : "MA-MD-48210"}
                    className="h-9 font-mono-tabular text-xs font-bold"
                  />
                </div>

                <ClinicalStepper
                  id="clinical-practice-fee"
                  label={c.feeLabel(currencyCode)}
                  value={feeMajorDraft}
                  onChange={(next) => {
                    setFeeMajorDraft(next);
                    const raw = next.trim().replace(",", ".");
                    if (raw === "") {
                      setLastSyncedMinor("");
                      onFeeChange("");
                      return;
                    }
                    const parsed = Number.parseFloat(raw);
                    if (Number.isFinite(parsed) && parsed >= 0) {
                      const nextMinor = String(Math.round(parsed * 100));
                      setLastSyncedMinor(nextMinor);
                      onFeeChange(nextMinor);
                    }
                  }}
                  step={50}
                  min={0}
                  max={5000}
                  unit={currencyCode}
                  presets={MOROCCAN_TARIFF_PRESETS_MAD.map((amt) => ({
                    label: `${amt}`,
                    value: String(amt),
                  }))}
                />
              </div>

              <div className="flex justify-end">
                <UiButton type="submit" size="sm" disabled={busy}>
                  {c.saveProfileBtn}
                </UiButton>
              </div>
            </form>
        </section>
      ) : null}

      <ProfileCredentialsPanel
        apiBaseUrl={apiBaseUrl}
        token={token}
        userRole={user.role}
        documents={userDocs}
        busy={busy}
        onBusyChange={onBusyChange}
        onDocumentsUpdated={onDocumentsUpdated}
        onFeedback={onFeedback}
      />

      <FacilityPapersCard
        apiBaseUrl={apiBaseUrl}
        token={token}
        facilityId={user.facilityId ?? null}
        facilityName={facilityName ?? null}
        {...(facilityKind ? { facilityKind } : {})}
        documents={facilityDocs}
        busy={busy}
        onBusyChange={onBusyChange}
        onDocumentsUpdated={onDocumentsUpdated}
        onFeedback={onFeedback}
      />
    </div>
  );
}
