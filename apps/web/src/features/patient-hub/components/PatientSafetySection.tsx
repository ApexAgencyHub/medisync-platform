"use client";

import { useRef, useState, type FormEvent } from "react";
import {
  AllergySeveritySchema,
  BloodTypeSchema,
  type AllergySeverity,
  type BloodType,
  type LocaleCode,
  type PatientAllergyItem,
  type PatientInsurancePolicy,
  type PatientMedicalProfile,
} from "@medisync/contracts";
import {
  createMyPatientInsurance,
  updateMyPatientProfile,
} from "@/features/clinical-workspace";
import {
  MOROCCAN_CHRONIC_CONDITION_PRESETS,
  MOROCCAN_INSURERS,
} from "@/shared/config/morocco-standards";
import { CreditCard, Plus, ShieldCheck, X } from "lucide-react";
import {
  UiBadge,
  UiButton,
  UiInput,
  useToastSetter,
} from "@/shared/ui/primitives";
import { MoroccanComplianceBadge } from "@/shared/ui/TactileControls";
import {
  formatPlainBloodType,
  formatPlainInsuranceStatus,
  type PatientUiCopy,
} from "../patient-copy";

interface PatientSafetySectionProps {
  copy: PatientUiCopy;
  locale: LocaleCode;
  apiBaseUrl: string;
  token: string;
  medicalProfile: PatientMedicalProfile | null;
  insurancePolicies: PatientInsurancePolicy[];
  onProfileUpdated: (next: PatientMedicalProfile) => void;
  onPolicyAdded: (next: PatientInsurancePolicy) => void;
}

const COVERAGE_PCT_PILLS = ["70", "80", "85", "90", "100"] as const;

const COMMON_ALLERGEN_CHIPS: ReadonlyArray<{
  canonical: string;
  labels: Record<LocaleCode, string>;
}> = [
  { canonical: "Penicillin", labels: { en: "Penicillin", fr: "Pénicilline", ar: "بنسلين" } },
  { canonical: "Aspirin", labels: { en: "Aspirin", fr: "Aspirine", ar: "أسبرين" } },
  { canonical: "Latex", labels: { en: "Latex", fr: "Latex", ar: "لاتكس" } },
  { canonical: "Sulfa", labels: { en: "Sulfa", fr: "Sulfamides", ar: "سلفوناميد" } },
  { canonical: "Peanuts", labels: { en: "Peanuts", fr: "Arachides", ar: "فول سوداني" } },
];

const QUICK_BLOOD_TYPES: readonly BloodType[] = [
  "O+",
  "O-",
  "A+",
  "A-",
  "B+",
  "B-",
  "AB+",
  "AB-",
];

function formatAllergySeverity(
  severity: AllergySeverity,
  locale: LocaleCode,
): string {
  if (locale === "fr") {
    switch (severity) {
      case "MILD":
        return "Légère";
      case "MODERATE":
        return "Modérée";
      case "SEVERE":
        return "Sévère";
      case "LIFE_THREATENING":
        return "Vitale";
    }
  }
  if (locale === "ar") {
    switch (severity) {
      case "MILD":
        return "خفيفة";
      case "MODERATE":
        return "متوسطة";
      case "SEVERE":
        return "شديدة";
      case "LIFE_THREATENING":
        return "خطيرة";
    }
  }
  switch (severity) {
    case "MILD":
      return "Mild";
    case "MODERATE":
      return "Moderate";
    case "SEVERE":
      return "Severe";
    case "LIFE_THREATENING":
      return "Life-Threatening";
  }
}

/** Plain-language Emergency Card (blood type, allergies, emergency contact) + Visual Health Insurance Cards. */
export function PatientSafetySection({
  copy,
  locale,
  apiBaseUrl,
  token,
  medicalProfile,
  insurancePolicies,
  onProfileUpdated,
  onPolicyAdded,
}: PatientSafetySectionProps) {
  const setBanner = useToastSetter();

  const [profileBloodType, setProfileBloodType] = useState<BloodType>(
    medicalProfile?.bloodType ?? "UNKNOWN",
  );
  const [emergencyContactName, setEmergencyContactName] = useState(
    medicalProfile?.emergencyContactName ?? "",
  );
  const [emergencyContactPhone, setEmergencyContactPhone] = useState(
    medicalProfile?.emergencyContactPhone ?? "",
  );
  const [allergiesDraft, setAllergiesDraft] = useState<PatientAllergyItem[]>(
    medicalProfile?.allergies ?? [],
  );
  const [newAllergenName, setNewAllergenName] = useState("");
  const [newAllergenSeverity, setNewAllergenSeverity] =
    useState<AllergySeverity>("MODERATE");
  const [chronicInput, setChronicInput] = useState(
    medicalProfile?.chronicConditions.join(", ") ?? "",
  );
  const [profileBusy, setProfileBusy] = useState(false);
  const profileLockRef = useRef(false);

  const [insProvider, setInsProvider] = useState("");
  const [insPolicyNum, setInsPolicyNum] = useState("");
  const [insMemberId, setInsMemberId] = useState("");
  const [insPlan, setInsPlan] = useState("CNSS / AMO");
  const [insPct, setInsPct] = useState("70");
  const [insBusy, setInsBusy] = useState(false);
  const insLockRef = useRef(false);

  return (
    <section
      id="patient-safety-profile"
      className="grid grid-cols-1 gap-4 lg:grid-cols-2"
    >
      <div className="space-y-3 rounded-2xl border border-[#D7E4F2] bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-2 pb-1">
          <div className="flex items-start gap-2.5">
            <img
              src="/media/icons/icon-ehr.webp"
              alt=""
              className="h-10 w-10 shrink-0 rounded-xl border border-[#D7E4F2] bg-[#F3F8FD] object-contain p-1.5 "
            />
            <div>
              <h2 className="flex items-center gap-1.5 text-sm font-bold text-slate-950">
                <ShieldCheck
                  className="h-4 w-4 text-[#0066CC]"
                  aria-hidden="true"
                />
                <span>{copy.safetyTitle}</span>
              </h2>
              <p className="text-xs text-slate-600">{copy.safetySubtitle}</p>
            </div>
          </div>

          <UiBadge tone="emerald">
            {copy.bloodTypeBadgePrefix}{" "}
            <span dir="ltr" className="ms-1 font-mono-tabular">
              {formatPlainBloodType(
                medicalProfile?.bloodType ?? profileBloodType,
                locale,
              )}
            </span>
          </UiBadge>
        </div>

        <form
          onSubmit={async (e: FormEvent<HTMLFormElement>) => {
            e.preventDefault();
            if (profileLockRef.current) return;
            profileLockRef.current = true;
            setProfileBusy(true);
            try {
              const res = await updateMyPatientProfile(apiBaseUrl, token, {
                bloodType: profileBloodType,
                biologicalSex: medicalProfile?.biologicalSex ?? "UNSPECIFIED",
                dateOfBirth: medicalProfile?.dateOfBirth ?? null,
                nationalHealthId: medicalProfile?.nationalHealthId ?? null,
                emergencyContactName: emergencyContactName.trim() || null,
                emergencyContactPhone: emergencyContactPhone.trim() || null,
                heightCm: medicalProfile?.heightCm ?? null,
                weightKg: medicalProfile?.weightKg ?? null,
                allergies: allergiesDraft,
                chronicConditions: chronicInput
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean),
                currentMedications: medicalProfile?.currentMedications ?? [],
                primaryDoctorUserId:
                  medicalProfile?.primaryDoctorUserId ?? null,
                preferredFacilityId:
                  medicalProfile?.preferredFacilityId ?? null,
                dataSharingConsent:
                  medicalProfile?.dataSharingConsent ?? true,
                telehealthConsent: medicalProfile?.telehealthConsent ?? true,
              });
              if (!res.ok) {
                setBanner({
                  tone: "error",
                  text:
                    locale === "fr"
                      ? `Échec de l'enregistrement du profil de sécurité (${res.error}).`
                      : locale === "ar"
                        ? `تعذر حفظ ملف السلامة الطبية (${res.error}).`
                        : `Failed to save safety profile (${res.error}).`,
                });
                return;
              }
              onProfileUpdated(res.data.profile);
              setBanner({
                tone: "success",
                text: copy.safetySavedToast,
              });
            } finally {
              setProfileBusy(false);
              profileLockRef.current = false;
            }
          }}
          className="space-y-3"
        >
          <div className="relative space-y-2">
            {/* Synchronized native select preserves label & automation compatibility without clunky visual dropdown */}
            <select
              id="patient-blood-type"
              tabIndex={-1}
              aria-label={copy.bloodGroupLabel}
              value={profileBloodType}
              onChange={(e) =>
                setProfileBloodType(BloodTypeSchema.parse(e.target.value))
              }
              className="pointer-events-none absolute inset-0 h-full w-full opacity-0"
            >
              {BloodTypeSchema.options.map((bt) => (
                <option key={bt} value={bt}>
                  {formatPlainBloodType(bt, locale)}
                </option>
              ))}
            </select>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label
                htmlFor="patient-blood-type"
                className="text-xs font-semibold text-slate-700"
              >
                {copy.bloodGroupLabel}
              </label>
              <button
                type="button"
                aria-pressed={profileBloodType === "UNKNOWN"}
                onClick={() => setProfileBloodType("UNKNOWN")}
                className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold transition ${
                  profileBloodType === "UNKNOWN"
                    ? "border-[#0F243E] bg-[#0F243E] text-white"
                    : "border-[#D7E4F2] bg-white text-[#556E89] hover:border-[#0066CC]"
                }`}
              >
                {formatPlainBloodType("UNKNOWN", locale)}
              </button>
            </div>
            <div
              role="group"
              aria-label={copy.bloodGroupLabel}
              className="grid grid-cols-4 gap-1.5 sm:grid-cols-8"
            >
              {QUICK_BLOOD_TYPES.map((bt) => {
                const selected = profileBloodType === bt;
                return (
                  <button
                    key={bt}
                    type="button"
                    dir="ltr"
                    aria-pressed={selected}
                    onClick={() => setProfileBloodType(bt)}
                    className={`min-h-[34px] rounded-xl border font-mono-tabular text-xs font-bold transition-colors active:scale-95 ${
                      selected
                        ? "border-[#0066CC] bg-[#0066CC] text-white shadow-xs"
                        : "border-[#D7E4F2] bg-[#F3F8FD] text-[#0F243E] hover:border-[#0066CC] hover:bg-[#EBF4FF]"
                    }`}
                  >
                    {bt}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            <div>
              <label
                htmlFor="patient-emg-name"
                className="mb-1 block text-xs font-semibold text-slate-700"
              >
                {copy.emergencyNameLabel}
              </label>
              <UiInput
                id="patient-emg-name"
                type="text"
                placeholder={copy.emergencyNamePlaceholder}
                value={emergencyContactName}
                onChange={(e) => setEmergencyContactName(e.target.value)}
                className="h-9 text-xs"
              />
            </div>
            <div>
              <label
                htmlFor="patient-emg-phone"
                className="mb-1 block text-xs font-semibold text-slate-700"
              >
                {copy.emergencyPhoneLabel}
              </label>
              <UiInput
                id="patient-emg-phone"
                type="tel"
                dir="ltr"
                placeholder="+212600112233"
                value={emergencyContactPhone}
                onChange={(e) => setEmergencyContactPhone(e.target.value)}
                className="h-9 text-xs"
              />
            </div>
          </div>

          <div className="space-y-2.5 rounded-2xl border border-[#D7E4F2] bg-[#F3F8FD] p-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-bold text-slate-800">
                {copy.allergiesHeading}{" "}
                <span dir="ltr" className="font-mono-tabular text-slate-500">
                  ({allergiesDraft.length})
                </span>
              </p>
              <div className="flex flex-wrap items-center gap-1">
                {COMMON_ALLERGEN_CHIPS.map((chip) => {
                  const chipLabel = chip.labels[locale];
                  const alreadyAdded = allergiesDraft.some(
                    (a) =>
                      a.allergen.toLowerCase() === chip.canonical.toLowerCase() ||
                      a.allergen.toLowerCase() === chipLabel.toLowerCase(),
                  );
                  return (
                    <button
                      key={chip.canonical}
                      type="button"
                      disabled={alreadyAdded}
                      onClick={() => {
                        if (alreadyAdded) return;
                        setAllergiesDraft((prev) => [
                          ...prev,
                          { allergen: chipLabel, severity: newAllergenSeverity },
                        ]);
                      }}
                      className={`rounded-full border px-2 py-0.5 text-[10.5px] font-semibold transition-colors ${
                        alreadyAdded
                          ? "border-rose-200 bg-rose-50 text-rose-700 opacity-65"
                          : "border-[#D7E4F2] bg-white text-[#0052A3] hover:border-[#0066CC] hover:bg-[#EBF4FF]"
                      }`}
                    >
                      + {chipLabel}
                    </button>
                  );
                })}
              </div>
            </div>
            {allergiesDraft.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {allergiesDraft.map((item, idx) => (
                  <span
                    key={`${item.allergen}-${idx}`}
                    className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2.5 py-0.5 text-[11px] font-semibold text-red-900"
                  >
                    <span>
                      <bdi dir="auto">{item.allergen}</bdi> (
                      {formatAllergySeverity(item.severity, locale)})
                    </span>
                    <button
                      type="button"
                      aria-label={`Remove allergy ${item.allergen}`}
                      onClick={() =>
                        setAllergiesDraft((prev) =>
                          prev.filter((_, i) => i !== idx),
                        )
                      }
                      className="rounded-full p-0.5 hover:bg-red-100"
                    >
                      <X className="h-3 w-3" aria-hidden="true" />
                    </button>
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-[11px] text-slate-500">{copy.allergiesEmpty}</p>
            )}

            <div className="space-y-2">
              <div
                role="radiogroup"
                aria-label="Allergy severity"
                className="flex flex-wrap gap-1.5"
              >
                {AllergySeveritySchema.options.map((sev) => {
                  const selected = newAllergenSeverity === sev;
                  const activeTone =
                    sev === "LIFE_THREATENING"
                      ? "border-[#DC2626] bg-[#DC2626] text-white"
                      : sev === "SEVERE"
                        ? "border-rose-600 bg-rose-600 text-white"
                        : sev === "MODERATE"
                          ? "border-amber-600 bg-amber-500 text-white"
                          : "border-[#0066CC] bg-[#0066CC] text-white";
                  return (
                    <button
                      key={sev}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => setNewAllergenSeverity(sev)}
                      className={`min-h-[30px] rounded-full border px-2.5 text-[11px] font-semibold transition active:scale-95 ${
                        selected
                          ? activeTone
                          : "border-[#D7E4F2] bg-white text-[#2F4661] hover:border-[#0066CC]"
                      }`}
                    >
                      {formatAllergySeverity(sev, locale)}
                    </button>
                  );
                })}
              </div>

              <div className="flex gap-2">
                <div className="min-w-0 flex-1">
                  <UiInput
                    type="text"
                    aria-label="New allergen name"
                    placeholder={copy.allergenPlaceholder}
                    value={newAllergenName}
                    onChange={(e) => setNewAllergenName(e.target.value)}
                    className="h-9 text-xs"
                  />
                </div>
                <UiButton
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="h-9 shrink-0"
                  onClick={() => {
                    const clean = newAllergenName.trim();
                    if (!clean) return;
                    setAllergiesDraft((prev) => [
                      ...prev,
                      { allergen: clean, severity: newAllergenSeverity },
                    ]);
                    setNewAllergenName("");
                  }}
                >
                  <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>{copy.addAllergenLabel}</span>
                </UiButton>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <label
              htmlFor="patient-chronic-list"
              className="block text-xs font-semibold text-slate-700"
            >
              {copy.chronicLabel}
            </label>
            <div className="flex flex-wrap gap-1.5">
              {MOROCCAN_CHRONIC_CONDITION_PRESETS.map((cond) => {
                const list = chronicInput
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean);
                const selected = list.some(
                  (c) => c.toLowerCase() === cond.canonical.toLowerCase(),
                );
                return (
                  <button
                    key={cond.canonical}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => {
                      if (selected) {
                        setChronicInput(
                          list
                            .filter(
                              (c) =>
                                c.toLowerCase() !== cond.canonical.toLowerCase(),
                            )
                            .join(", "),
                        );
                      } else {
                        setChronicInput([...list, cond.canonical].join(", "));
                      }
                    }}
                    className={`min-h-[28px] rounded-full border px-2.5 text-[11px] font-semibold transition active:scale-95 ${
                      selected
                        ? "border-[#0066CC] bg-[#0066CC] text-white"
                        : "border-[#D7E4F2] bg-[#F3F8FD] text-[#2F4661] hover:border-[#0066CC] hover:bg-white"
                    }`}
                  >
                    {selected ? "✓ " : "+ "}
                    {cond.labels[locale]}
                  </button>
                );
              })}
            </div>
            <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
              <UiInput
                id="patient-chronic-list"
                type="text"
                placeholder={copy.chronicPlaceholder}
                value={chronicInput}
                onChange={(e) => setChronicInput(e.target.value)}
                className="h-9 flex-1 text-xs"
              />
              <UiButton
                type="submit"
                size="sm"
                disabled={profileBusy}
                className="h-9 shrink-0 rounded-xl px-4"
              >
                {profileBusy ? copy.savingCta : copy.saveSafetyCta}
              </UiButton>
            </div>
          </div>
        </form>
      </div>

      <div className="space-y-3 rounded-2xl border border-[#D7E4F2] bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-2 pb-1">
          <div className="flex items-start gap-2.5">
            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#D7E4F2] bg-[#F3F8FD] text-[#0066CC] ">
              <CreditCard className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <h2 className="text-sm font-bold text-slate-950">
                {copy.insuranceTitle}{" "}
                <span dir="ltr" className="font-mono-tabular text-slate-500">
                  ({insurancePolicies.length})
                </span>
              </h2>
              <p className="text-xs text-slate-600">{copy.insuranceSubtitle}</p>
            </div>
          </div>
          <MoroccanComplianceBadge domain="patient" locale={locale} />
        </div>

        {insurancePolicies.length === 0 ? (
          <p className="rounded-xl bg-white p-3.5 text-xs text-slate-600">
            {copy.insuranceEmpty}
          </p>
        ) : (
          <ul className="space-y-2">
            {insurancePolicies.map((pol) => (
              <li
                key={pol.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#D7E4F2] bg-[#F3F8FD] p-3 text-xs "
              >
                <div className="min-w-0">
                  <p className="truncate font-bold text-slate-900">
                    <bdi dir="auto">{pol.providerName}</bdi> ·{" "}
                    <bdi dir="auto">{pol.coveragePlan}</bdi> (
                    <span dir="ltr" className="font-mono-tabular">
                      {pol.coveragePercent}%
                    </span>
                    )
                  </p>
                  <p
                    dir="ltr"
                    className="font-mono-tabular text-[11px] text-slate-600"
                  >
                    #{pol.policyNumber} · ID {pol.memberId}
                  </p>
                </div>
                <UiBadge
                  tone={
                    pol.verificationStatus === "VERIFIED"
                      ? "emerald"
                      : pol.verificationStatus === "REJECTED"
                        ? "red"
                        : "amber"
                  }
                >
                  {formatPlainInsuranceStatus(pol.verificationStatus, locale)}
                </UiBadge>
              </li>
            ))}
          </ul>
        )}

        <form
          onSubmit={async (e: FormEvent<HTMLFormElement>) => {
            e.preventDefault();
            if (insLockRef.current) return;
            if (!insProvider.trim() || !insPolicyNum.trim() || !insMemberId.trim()) {
              return;
            }
            insLockRef.current = true;
            setInsBusy(true);
            try {
              const res = await createMyPatientInsurance(apiBaseUrl, token, {
                providerName: insProvider.trim(),
                policyNumber: insPolicyNum.trim(),
                memberId: insMemberId.trim(),
                coveragePlan: insPlan.trim() || "STANDARD",
                coveragePercent: Number(insPct) || 70,
                isPrimary: insurancePolicies.length === 0,
              });
              if (!res.ok) {
                setBanner({
                  tone: "error",
                  text:
                    locale === "fr"
                      ? `Échec d'enregistrement de l'assurance (${res.error}).`
                      : locale === "ar"
                        ? `تعذر حفظ بطاقة التأمين (${res.error}).`
                        : `Insurance save failed (${res.error}).`,
                });
                return;
              }
              onPolicyAdded(res.data.policy);
              setInsProvider("");
              setInsPolicyNum("");
              setInsMemberId("");
              setBanner({
                tone: "success",
                text:
                  locale === "fr"
                    ? `Contrat d'assurance ${res.data.policy.providerName} enregistré.`
                    : locale === "ar"
                      ? `تم حفظ تأمين ${res.data.policy.providerName} بنجاح.`
                      : `Insurance policy ${res.data.policy.providerName} saved.`,
              });
            } finally {
              setInsBusy(false);
              insLockRef.current = false;
            }
          }}
          className="space-y-2.5 pt-2"
        >
          <div className="space-y-1.5">
            <p className="text-xs font-bold text-slate-800">
              {copy.addInsuranceHeading}
            </p>
            <div className="flex flex-wrap items-center gap-1.5">
              {MOROCCAN_INSURERS.map((preset) => {
                const selected = insProvider === preset.providerName;
                return (
                  <button
                    key={preset.code}
                    type="button"
                    onClick={() => {
                      setInsProvider(preset.providerName);
                      setInsPlan(
                        preset.planType === "AMO_CNSS"
                          ? "CNSS / AMO"
                          : preset.planType === "MUTUELLE"
                            ? locale === "ar"
                              ? "تعاضدية Mutuelle"
                              : locale === "fr"
                                ? "Mutuelle"
                                : "Mutual Coverage"
                            : locale === "ar"
                              ? "تأمين خاص"
                              : locale === "fr"
                                ? "Assurance Privée"
                                : "Private Insurance",
                      );
                      setInsPct(String(preset.defaultCoveragePercent));
                    }}
                    className={`rounded-xl border px-2.5 py-1 text-[11px] font-semibold transition active:scale-95 ${
                      selected
                        ? "border-[#0066CC] bg-[#0066CC] text-white"
                        : "border-[#D7E4F2] bg-[#F3F8FD] text-[#0052A3] hover:border-[#0066CC] hover:bg-white"
                    }`}
                  >
                    {preset.labels[locale]}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <UiInput
              type="text"
              required
              placeholder={copy.insurerPlaceholder}
              aria-label="Insurance provider name"
              value={insProvider}
              onChange={(e) => setInsProvider(e.target.value)}
              className="h-9 text-xs"
            />
            <UiInput
              type="text"
              required
              placeholder={copy.policyPlaceholder}
              aria-label="Insurance policy number"
              value={insPolicyNum}
              onChange={(e) => setInsPolicyNum(e.target.value)}
              className="h-9 text-xs"
            />
            <UiInput
              type="text"
              required
              placeholder={copy.memberIdPlaceholder}
              aria-label="Insurance member ID"
              value={insMemberId}
              onChange={(e) => setInsMemberId(e.target.value)}
              className="h-9 text-xs"
            />
            <UiInput
              type="text"
              placeholder={copy.planPlaceholder}
              aria-label="Coverage plan"
              value={insPlan}
              onChange={(e) => setInsPlan(e.target.value)}
              className="h-9 text-xs"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div
              role="radiogroup"
              aria-label="Coverage percentage"
              className="flex flex-wrap items-center gap-1"
            >
              {COVERAGE_PCT_PILLS.map((pct) => (
                <button
                  key={pct}
                  type="button"
                  role="radio"
                  aria-checked={insPct === pct}
                  onClick={() => setInsPct(pct)}
                  className={`h-8 rounded-lg border px-2.5 font-mono-tabular text-[11px] font-bold transition ${
                    insPct === pct
                      ? "border-[#0F9D88] bg-[#0F9D88] text-white"
                      : "border-[#D7E4F2] bg-[#F3F8FD] text-[#2F4661] hover:border-[#0066CC]"
                  }`}
                >
                  {pct}%
                </button>
              ))}
            </div>
            <UiButton
              type="submit"
              size="sm"
              variant="secondary"
              disabled={insBusy}
              className="h-9 rounded-xl px-4"
            >
              {insBusy ? copy.savingInsuranceCta : copy.saveInsuranceCta}
            </UiButton>
          </div>
        </form>
      </div>
    </section>
  );
}
