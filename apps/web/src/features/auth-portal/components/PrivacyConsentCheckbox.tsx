"use client";

import type { LocaleCode } from "@medisync/contracts";
import { ShieldCheck } from "lucide-react";
import { useLocale } from "@/shared/i18n/locale-store";

interface PrivacyConsentCheckboxProps {
  id: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  scope?: "PATIENT" | "STAFF";
}

const CONSENT_COPY: Record<
  LocaleCode,
  {
    patientText: string;
    staffText: string;
    regulationTag: string;
  }
> = {
  en: {
    patientText:
      "I accept the Terms of Service, Health Data Processing Policy (Moroccan CNDP Law 09-08), and Teleconsultation Informed Notice (Decree 2-18-378).",
    staffText:
      "I accept the Medical Partner Code of Conduct, Moroccan Medical Confidentiality Obligations (CNDP Law 09-08 & Law 131-13), and Platform Terms.",
    regulationTag: "CNDP Law 09-08 · Law 131-13",
  },
  fr: {
    patientText:
      "J'accepte les Conditions d'Utilisation, la Politique de Données de Santé (Loi CNDP 09-08) et la notice de téléconsultation (Décret 2-18-378).",
    staffText:
      "J'accepte la Charte Praticien & Partenaire, le Secret Médical Marocain (Loi CNDP 09-08 & Loi 131-13) et les Conditions de la plateforme.",
    regulationTag: "Loi 09-08 · Loi 131-13",
  },
  ar: {
    patientText:
      "أوافق على شروط الاستخدام وسياسة حماية المعطيات الصحية (القانون المغربي 08-09) وإشعار التطبيب عن بُعد (المرسوم 2-18-378).",
    staffText:
      "أوافق على ميثاق الشريك الصحي والسر الطبي المهني وحماية معطيات المرضى (القانون 08-09 والقانون 131-13) وشروط المنصة.",
    regulationTag: "قانون 09-08 · قانون 131-13",
  },
};

export function PrivacyConsentCheckbox({
  id,
  checked,
  onChange,
  scope = "PATIENT",
}: PrivacyConsentCheckboxProps) {
  const { locale } = useLocale();
  const copy = CONSENT_COPY[locale] ?? CONSENT_COPY.en;

  return (
    <label
      htmlFor={id}
      className="flex cursor-pointer items-start gap-2.5 rounded-xl bg-[#F3F8FD] border border-[#D7E4F2] p-3 text-xs text-slate-700 ring-1 ring-slate-900/[0.06]"
    >
      <input
        id={id}
        type="checkbox"
        required
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-[#0066CC] focus:ring-emerald-700"
      />
      <span className="min-w-0 flex-1 leading-relaxed">
        <span className="mb-1 inline-flex items-center gap-1 rounded-xl bg-white px-2 py-0.5 font-mono-tabular text-[10px] font-semibold text-[#0066CC] shadow-2xs">
          <ShieldCheck className="h-3 w-3" aria-hidden="true" />
          {copy.regulationTag}
        </span>{" "}
        <span className="block font-medium text-slate-800">
          {scope === "STAFF" ? copy.staffText : copy.patientText}
        </span>
      </span>
    </label>
  );
}
