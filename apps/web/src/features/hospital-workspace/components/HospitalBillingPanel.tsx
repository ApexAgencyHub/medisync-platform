"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  MedicalInvoiceSummarySchema,
  PatientInsuranceListResponseSchema,
  PatientInsuranceResponseSchema,
  type DirectoryPatientSummary,
  type LocaleCode,
  type MedicalInvoiceSummary,
  type PatientInsurancePolicy,
} from "@medisync/contracts";
import {
  Ambulance,
  CheckCircle2,
  CreditCard,
  FlaskConical,
  ReceiptText,
  ShieldCheck,
  Stethoscope,
  Syringe,
  XCircle,
} from "lucide-react";
import { fetchDirectoryPatients } from "@/shared/api/directory-client";
import { requestTyped } from "@/shared/api/http-client";
import { useLocale } from "@/shared/i18n/locale-store";
import { EntityPicker } from "@/shared/ui/EntityPicker";
import { UiBadge, UiButton, UiInput, useToastSetter } from "@/shared/ui/primitives";
import {
  ClinicalStepper,
  MoroccanComplianceBadge,
} from "@/shared/ui/TactileControls";

const InvoicesListResponseSchema = {
  safeParse(
    data: unknown,
  ):
    | { success: true; data: { invoices: MedicalInvoiceSummary[] } }
    | { success: false } {
    if (
      typeof data !== "object" ||
      data === null ||
      !("invoices" in data) ||
      !Array.isArray((data as { invoices: unknown }).invoices)
    ) {
      return { success: false };
    }
    const items: MedicalInvoiceSummary[] = [];
    for (const raw of (data as { invoices: unknown[] }).invoices) {
      const parsed = MedicalInvoiceSummarySchema.safeParse(raw);
      if (!parsed.success) return { success: false };
      items.push(parsed.data);
    }
    return { success: true, data: { invoices: items } };
  },
};

const InvoiceResponseSchema = {
  safeParse(
    data: unknown,
  ): { success: true; data: { invoice: MedicalInvoiceSummary } } | { success: false } {
    if (typeof data !== "object" || data === null || !("invoice" in data)) {
      return { success: false };
    }
    const parsed = MedicalInvoiceSummarySchema.safeParse(
      (data as { invoice: unknown }).invoice,
    );
    return parsed.success
      ? { success: true, data: { invoice: parsed.data } }
      : { success: false };
  },
};

interface HospitalBillingPanelProps {
  apiBaseUrl: string;
  token: string;
  countryCode: string;
  currencyCode: string;
  selectedFacilityId: string;
  busy: boolean;
  isLocked: boolean;
}

const BILLING_COPY: Record<
  LocaleCode,
  {
    title: string;
    subtitle: string;
    patientLabel: string;
    patientPlaceholder: string;
    patientEmpty: string;
    insuranceHeading: string;
    noInsurance: string;
    verifyBtn: string;
    rejectBtn: string;
    invoiceTitle: string;
    sourceLabel: string;
    descLabel: string;
    amountLabel: (curr: string) => string;
    issueBtn: string;
    recentTitle: (n: number) => string;
    noInvoices: string;
  }
> = {
  en: {
    title: "Insurance Verification & Reception Billing",
    subtitle:
      "Verify patient insurance cards (AMO / CNOPS / CNSS) and issue itemized consultation or ER invoices without accessing doctor clinical charts.",
    patientLabel: "Patient Account",
    patientPlaceholder: "Search arriving patient...",
    patientEmpty: "No patient found",
    insuranceHeading: "Patient Insurance Cards",
    noInsurance: "No insurance card linked for this patient.",
    verifyBtn: "Verify Card",
    rejectBtn: "Reject",
    invoiceTitle: "Issue Reception Invoice",
    sourceLabel: "Service Type",
    descLabel: "Billing Description",
    amountLabel: (c) => `Total Amount (${c})`,
    issueBtn: "Issue Itemized Invoice",
    recentTitle: (n) => `Recent Facility Invoices (${n})`,
    noInvoices: "No invoices issued yet for this region.",
  },
  fr: {
    title: "Vérification Assurance & Facturation Accueil",
    subtitle:
      "Contrôlez les cartes mutuelles (AMO / CNOPS / CNSS) et émettez les factures d'admission sans accès aux dossiers médicaux confidentiels.",
    patientLabel: "Dossier Administratif Patient",
    patientPlaceholder: "Rechercher un patient...",
    patientEmpty: "Aucun patient trouvé",
    insuranceHeading: "Cartes d'Assurance du Patient",
    noInsurance: "Aucune police d'assurance enregistrée.",
    verifyBtn: "Valider Carte",
    rejectBtn: "Rejeter",
    invoiceTitle: "Émettre une Facture",
    sourceLabel: "Prestation",
    descLabel: "Libellé de facturation",
    amountLabel: (c) => `Montant total (${c})`,
    issueBtn: "Émettre Facture",
    recentTitle: (n) => `Factures Récentes (${n})`,
    noInvoices: "Aucune facture émise dans cette zone.",
  },
  ar: {
    title: "التحقق من التأمين الصحي والفوترة",
    subtitle:
      "مراجعة بطاقات التأمين (AMO / CNOPS / CNSS) وإصدار فواتير الاستقبال دون الاطلاع على السجل السريري للطبيب.",
    patientLabel: "حساب المريض",
    patientPlaceholder: "ابحث عن مريض...",
    patientEmpty: "لا يوجد مريض مطابق",
    insuranceHeading: "بطاقات التأمين للمريض",
    noInsurance: "لا توجد بطاقة تأمين مسجلة لهذا المريض.",
    verifyBtn: "اعتماد البطاقة",
    rejectBtn: "رفض",
    invoiceTitle: "إصدار فاتورة الاستقبال",
    sourceLabel: "نوع الخدمة",
    descLabel: "بيان الفاتورة",
    amountLabel: (c) => `المبلغ الإجمالي (${c})`,
    issueBtn: "إصدار الفاتورة",
    recentTitle: (n) => `الفواتير الصادرة (${n})`,
    noInvoices: "لا توجد فواتير صادرة بعد.",
  },
};

export function HospitalBillingPanel({
  apiBaseUrl,
  token,
  countryCode,
  currencyCode,
  selectedFacilityId,
  busy,
  isLocked,
}: HospitalBillingPanelProps) {
  const { locale } = useLocale();
  const c = BILLING_COPY[locale] ?? BILLING_COPY.en;
  const setBanner = useToastSetter();

  const [patients, setPatients] = useState<DirectoryPatientSummary[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState("");
  const [policies, setPolicies] = useState<PatientInsurancePolicy[]>([]);
  const [invoices, setInvoices] = useState<MedicalInvoiceSummary[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const [sourceType, setSourceType] = useState<
    "APPOINTMENT" | "SERVICE" | "LAB_ORDER" | "DISPATCH"
  >("APPOINTMENT");
  const defaultBillingDescriptions: Readonly<Record<LocaleCode, string>> = {
    en: "Specialist clinic intake & consultation",
    fr: "Accueil & consultation spécialisée",
    ar: "استقبال واستشارة طبية متخصصة",
  };
  const [description, setDescription] = useState(
    defaultBillingDescriptions[locale] ?? defaultBillingDescriptions.en,
  );
  const [subtotalMajorInput, setSubtotalMajorInput] = useState("350");

  useEffect(() => {
    const knownDefaults = new Set<string>([
      "Specialist clinic intake & consultation",
      "Accueil & consultation spécialisée",
      "استقبال واستشارة طبية متخصصة",
      "Consultation spécialiste & admission",
      "Acte clinique ambulatoire & consommables",
      "Bilan biologique et imagerie diagnostique",
      "Transport sanitaire d'urgence & prise en charge",
      "استشارة طبية واستقبال بالعيادة",
      "إجراء علاجي ومستلزمات طبية",
      "فحوصات مخبرية وأشعة تشخيصية",
      "نقل طبي طارئ واستقبال مستعجلات",
      "Outpatient clinical procedure & supplies",
      "Laboratory panel & imaging workup",
      "Emergency medical transport & bay intake",
    ]);
    const localizedBySource: Record<
      "APPOINTMENT" | "SERVICE" | "LAB_ORDER" | "DISPATCH",
      Record<LocaleCode, string>
    > = {
      APPOINTMENT: {
        en: "Specialist clinic intake & consultation",
        fr: "Consultation spécialiste & admission",
        ar: "استشارة طبية واستقبال بالعيادة",
      },
      SERVICE: {
        en: "Outpatient clinical procedure & supplies",
        fr: "Acte clinique ambulatoire & consommables",
        ar: "إجراء علاجي ومستلزمات طبية",
      },
      LAB_ORDER: {
        en: "Laboratory panel & imaging workup",
        fr: "Bilan biologique et imagerie diagnostique",
        ar: "فحوصات مخبرية وأشعة تشخيصية",
      },
      DISPATCH: {
        en: "Emergency medical transport & bay intake",
        fr: "Transport sanitaire d'urgence & prise en charge",
        ar: "نقل طبي طارئ واستقبال مستعجلات",
      },
    };
    setDescription((prev) =>
      knownDefaults.has(prev) ? localizedBySource[sourceType][locale] : prev,
    );
  }, [locale, sourceType]);

  const loadBillingContext = useCallback(async () => {
    if (!token || isLocked) return;
    const [patRes, invRes] = await Promise.all([
      fetchDirectoryPatients(apiBaseUrl, token, { countryCode }),
      requestTyped(
        `${apiBaseUrl}/v1/billing/invoices?countryCode=${encodeURIComponent(countryCode)}&limit=15`,
        { method: "GET", headers: { authorization: `Bearer ${token}` } },
        InvoicesListResponseSchema,
      ),
    ]);
    if (patRes.ok) {
      setPatients(patRes.patients);
      if (patRes.patients[0]) {
        setSelectedPatientId((prev) => prev || patRes.patients[0]!.id);
      }
    }
    if (invRes.ok) {
      setInvoices(invRes.data.invoices);
    }
  }, [apiBaseUrl, countryCode, isLocked, token]);

  useEffect(() => {
    void loadBillingContext();
  }, [loadBillingContext]);

  useEffect(() => {
    if (!token || !selectedPatientId || isLocked) {
      setPolicies([]);
      return;
    }
    let active = true;
    void requestTyped(
      `${apiBaseUrl}/v1/clinical/patients/${encodeURIComponent(selectedPatientId)}/insurances`,
      { method: "GET", headers: { authorization: `Bearer ${token}` } },
      PatientInsuranceListResponseSchema,
    ).then((res) => {
      if (!active) return;
      setPolicies(res.ok ? res.data.policies : []);
    });
    return () => {
      active = false;
    };
  }, [apiBaseUrl, isLocked, selectedPatientId, token]);

  async function handleReviewPolicy(
    policyId: string,
    verificationStatus: "VERIFIED" | "REJECTED",
  ) {
    if (!selectedPatientId || submitting) return;
    setSubmitting(true);
    const res = await requestTyped(
      `${apiBaseUrl}/v1/clinical/patients/${encodeURIComponent(selectedPatientId)}/insurances/${encodeURIComponent(policyId)}`,
      {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ verificationStatus }),
      },
      PatientInsuranceResponseSchema,
    );
    setSubmitting(false);
    if (!res.ok) {
      setBanner({ tone: "error", text: res.error });
      return;
    }
    setPolicies((prev) =>
      prev.map((p) => (p.id === policyId ? res.data.policy : p)),
    );
    setBanner({
      tone: "success",
      text:
        locale === "fr"
          ? `Carte d'assurance ${res.data.policy.policyNumber} : ${verificationStatus}.`
          : locale === "ar"
            ? `تم تحديث بطاقة التأمين ${res.data.policy.policyNumber} (${verificationStatus}).`
            : `Insurance card ${res.data.policy.policyNumber} marked ${verificationStatus}.`,
    });
  }

  async function handleIssueInvoice(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selectedPatientId || !selectedFacilityId || submitting) return;
    const parsedMajor = Number.parseFloat(subtotalMajorInput.replace(",", "."));
    if (!Number.isFinite(parsedMajor) || parsedMajor < 1) {
      setBanner({
        tone: "error",
        text:
          locale === "fr"
            ? `Veuillez saisir un montant valide (${currencyCode}).`
            : locale === "ar"
              ? `يرجى إدخال مبلغ صحيح (${currencyCode}).`
              : `Enter a valid positive amount (${currencyCode}).`,
      });
      return;
    }
    const subtotalMinor = Math.round(parsedMajor * 100);
    setSubmitting(true);
    const res = await requestTyped(
      `${apiBaseUrl}/v1/billing/invoices`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          patientUserId: selectedPatientId,
          facilityId: selectedFacilityId,
          sourceType,
          description: description.trim(),
          subtotalMinor,
        }),
      },
      InvoiceResponseSchema,
    );
    setSubmitting(false);
    if (!res.ok) {
      setBanner({ tone: "error", text: res.error });
      return;
    }
    setInvoices((prev) => [res.data.invoice, ...prev]);
    setBanner({
      tone: "success",
      text:
        locale === "fr"
          ? `Facture ${res.data.invoice.invoiceNumber} émise.`
          : locale === "ar"
            ? `تم إصدار الفاتورة ${res.data.invoice.invoiceNumber}.`
            : `Invoice ${res.data.invoice.invoiceNumber} issued cleanly.`,
    });
  }

  const verifiedPolicy =
    policies.find((p) => p.verificationStatus === "VERIFIED") ?? null;
  const parsedMajorNum = Number.parseFloat(subtotalMajorInput.replace(",", "."));
  const subtotalMajor =
    Number.isFinite(parsedMajorNum) && parsedMajorNum >= 0 ? parsedMajorNum : 0;
  const estimatedCoveredMajor = verifiedPolicy
    ? Math.round((subtotalMajor * verifiedPolicy.coveragePercent) / 100)
    : 0;
  const estimatedPatientMajor = Math.max(0, Number((subtotalMajor - estimatedCoveredMajor).toFixed(2)));

  function formatPolicyStatus(status: string): string {
    if (status === "VERIFIED") {
      return locale === "fr" ? "Vérifiée" : locale === "ar" ? "موثقة" : "Verified";
    }
    if (status === "REJECTED") {
      return locale === "fr" ? "Refusée" : locale === "ar" ? "مرفوضة" : "Rejected";
    }
    return locale === "fr" ? "En attente" : locale === "ar" ? "قيد التحقق" : "Pending";
  }

  function formatInvoiceStatus(status: string): string {
    if (status === "PAID") {
      return locale === "fr" ? "Payée" : locale === "ar" ? "مدفوعة" : "Paid";
    }
    if (status === "CANCELLED" || status === "VOID") {
      return locale === "fr" ? "Annulée" : locale === "ar" ? "ملغاة" : "Cancelled";
    }
    return locale === "fr" ? "Émise" : locale === "ar" ? "صادرة" : "Issued";
  }

  const serviceTiles =
    locale === "fr"
      ? ([
          {
            id: "APPOINTMENT" as const,
            label: "Consultation",
            desc: "Consultation spécialiste & admission",
            defaultMinor: "35000",
            icon: Stethoscope,
          },
          {
            id: "SERVICE" as const,
            label: "Acte / Soin",
            desc: "Acte clinique ambulatoire & consommables",
            defaultMinor: "80000",
            icon: Syringe,
          },
          {
            id: "LAB_ORDER" as const,
            label: "Biologie / Radio",
            desc: "Bilan biologique et imagerie diagnostique",
            defaultMinor: "50000",
            icon: FlaskConical,
          },
          {
            id: "DISPATCH" as const,
            label: "Ambulance 141",
            desc: "Transport sanitaire d'urgence & prise en charge",
            defaultMinor: "60000",
            icon: Ambulance,
          },
        ] as const)
      : locale === "ar"
        ? ([
            {
              id: "APPOINTMENT" as const,
              label: "استشارة طبية",
              desc: "استشارة طبية واستقبال بالعيادة",
              defaultMinor: "35000",
              icon: Stethoscope,
            },
            {
              id: "SERVICE" as const,
              label: "إجراء طبي",
              desc: "إجراء علاجي ومستلزمات طبية",
              defaultMinor: "80000",
              icon: Syringe,
            },
            {
              id: "LAB_ORDER" as const,
              label: "تحاليل / أشعة",
              desc: "فحوصات مخبرية وأشعة تشخيصية",
              defaultMinor: "50000",
              icon: FlaskConical,
            },
            {
              id: "DISPATCH" as const,
              label: "إسعاف 141",
              desc: "نقل طبي طارئ واستقبال مستعجلات",
              defaultMinor: "60000",
              icon: Ambulance,
            },
          ] as const)
        : ([
            {
              id: "APPOINTMENT" as const,
              label: "Consultation",
              desc: "Specialist clinic intake & consultation",
              defaultMinor: "35000",
              icon: Stethoscope,
            },
            {
              id: "SERVICE" as const,
              label: "Procedure",
              desc: "Outpatient clinical procedure & supplies",
              defaultMinor: "80000",
              icon: Syringe,
            },
            {
              id: "LAB_ORDER" as const,
              label: "Diagnostic Lab",
              desc: "Laboratory panel & imaging workup",
              defaultMinor: "50000",
              icon: FlaskConical,
            },
            {
              id: "DISPATCH" as const,
              label: "Ambulance",
              desc: "Emergency medical transport & bay intake",
              defaultMinor: "60000",
              icon: Ambulance,
            },
          ] as const);

  return (
    <section className="rounded-2xl border border-[#D7E4F2] bg-white p-5 shadow-[0_6px_22px_-12px_rgba(15,36,62,0.08)] sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-[#E8F1FA] pb-3.5">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#BFDBFE] bg-[#EBF4FF] text-[#0066CC]">
            <CreditCard className="h-4 w-4" aria-hidden="true" />
          </span>
          <h2 className="font-editorial text-base font-bold text-[#0F243E]">{c.title}</h2>
        </div>
        <MoroccanComplianceBadge domain="hospital" locale={locale} />
      </div>

      <div className="mt-4 space-y-4">
        <EntityPicker
          id="hospital-billing-patient"
          label={c.patientLabel}
          placeholder={c.patientPlaceholder}
          emptyLabel={c.patientEmpty}
          options={Array.from(
            new Map(
              patients.map((p) => [
                p.id,
                {
                  id: p.id,
                  label: p.fullName,
                  sublabel: p.phone ?? p.email ?? p.countryCode,
                },
              ]),
            ).values(),
          )}
          value={selectedPatientId}
          onChange={setSelectedPatientId}
          disabled={isLocked}
        />

        {/* Insurance Policies */}
        <div className="space-y-2 rounded-2xl border border-[#D7E4F2] bg-[#F8FBFE] p-4">
          <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#2F4661]">
            <ShieldCheck className="h-3.5 w-3.5 text-[#0066CC]" aria-hidden="true" />
            <span>{c.insuranceHeading}</span>
          </h3>
          {policies.length === 0 ? (
            <p className="text-xs text-[#6B829D]">{c.noInsurance}</p>
          ) : (
            <ul className="space-y-2 text-xs">
              {policies.map((pol) => (
                <li
                  key={pol.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#D7E4F2] bg-white px-3.5 py-2.5"
                >
                  <div>
                    <p className="font-bold text-[#0F243E]">
                      {pol.providerName} · {pol.coveragePlan} ({pol.coveragePercent}%)
                    </p>
                    <p className="font-mono-tabular text-[#556E89]">
                      #{pol.policyNumber} · {formatPolicyStatus(pol.verificationStatus)}
                    </p>
                  </div>
                  {pol.verificationStatus === "PENDING" ? (
                    <div className="flex gap-1.5">
                      <UiButton
                        type="button"
                        size="sm"
                        disabled={busy || submitting || isLocked}
                        onClick={() => void handleReviewPolicy(pol.id, "VERIFIED")}
                      >
                        <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                        <span>{c.verifyBtn}</span>
                      </UiButton>
                      <UiButton
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={busy || submitting || isLocked}
                        onClick={() => void handleReviewPolicy(pol.id, "REJECTED")}
                      >
                        <XCircle className="h-3 w-3" aria-hidden="true" />
                        <span>{c.rejectBtn}</span>
                      </UiButton>
                    </div>
                  ) : (
                    <UiBadge
                      tone={pol.verificationStatus === "VERIFIED" ? "emerald" : "red"}
                    >
                      {formatPolicyStatus(pol.verificationStatus)}
                    </UiBadge>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Visual Reception Billing Form (Tactile Service Tiles + 1-Tap Tariff Presets) */}
        <form
          onSubmit={(e) => void handleIssueInvoice(e)}
          className="space-y-3.5 rounded-2xl border border-[#D7E4F2] bg-[#F8FBFE] p-4 text-xs"
        >
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {serviceTiles.map((svc) => {
              const Icon = svc.icon;
              const active = sourceType === svc.id;
              return (
                <button
                  key={svc.id}
                  type="button"
                  onClick={() => {
                    setSourceType(svc.id);
                    setDescription(svc.desc);
                    setSubtotalMajorInput(
                      String(Math.round(Number(svc.defaultMinor) / 100)),
                    );
                  }}
                  className={`flex min-h-[42px] items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold transition-colors active:scale-95 ${
                    active
                      ? "border-[#0052A3] bg-[#0066CC] text-white shadow-2xs"
                      : "border-[#D7E4F2] bg-white text-[#2F4661] hover:border-[#0066CC] hover:text-[#0066CC]"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span>{svc.label}</span>
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-12">
            <div className="sm:col-span-7">
              <label className="mb-1 block font-semibold text-[#2F4661]">{c.descLabel}</label>
              <UiInput
                type="text"
                required
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <div className="sm:col-span-5">
              <ClinicalStepper
                label={c.amountLabel(currencyCode)}
                value={subtotalMajorInput}
                onChange={setSubtotalMajorInput}
                step={50}
                min={1}
                max={50000}
                unit={currencyCode}
                presets={[
                  { label: "200", value: "200" },
                  { label: "350", value: "350" },
                  { label: "500", value: "500" },
                  { label: "800", value: "800" },
                  { label: "1500", value: "1500" },
                ]}
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            {verifiedPolicy ? (
              <div className="inline-flex flex-wrap items-center gap-2 rounded-xl border border-[#B2E5DC] bg-[#E6F7F4] px-3 py-1.5 text-[11px] font-semibold text-[#0B6B5C]">
                <span>
                  {verifiedPolicy.providerName} ({verifiedPolicy.coveragePercent}%): -{estimatedCoveredMajor} {currencyCode}
                </span>
                <span className="font-mono-tabular font-bold text-[#0F243E]">
                  {locale === "fr"
                    ? "Reste patient :"
                    : locale === "ar"
                      ? "باقي المريض:"
                      : "Patient Co-Pay:"}{" "}
                  {estimatedPatientMajor} {currencyCode}
                </span>
              </div>
            ) : (
              <span dir="ltr" className="font-mono-tabular text-xs font-bold text-[#0066CC]">
                {subtotalMajor.toFixed(2)} {currencyCode}
              </span>
            )}
            <UiButton
              type="submit"
              size="sm"
              disabled={busy || submitting || isLocked || !selectedPatientId || !selectedFacilityId}
            >
              <ReceiptText className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{c.issueBtn}</span>
            </UiButton>
          </div>
        </form>

        {/* Recent Invoices */}
        <div className="rounded-2xl border border-[#D7E4F2] bg-[#F3F8FD] p-4 text-xs ">
          <h3 className="font-bold text-slate-900">{c.recentTitle(invoices.length)}</h3>
          {invoices.length === 0 ? (
            <p className="mt-1.5 text-slate-500">{c.noInvoices}</p>
          ) : (
            <ul className="mt-2 max-h-48 space-y-1.5 overflow-y-auto">
              {invoices.slice(0, 10).map((inv) => (
                <li
                  key={inv.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 px-3 py-2"
                >
                  <div>
                    <span className="font-mono-tabular font-bold text-slate-900">
                      {inv.invoiceNumber}
                    </span>{" "}
                    · {inv.patientName} · <span className="text-slate-600">{inv.description}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono-tabular font-bold text-emerald-800">
                      {(inv.patientPayableMinor / 100).toFixed(2)} {inv.currencyCode}
                    </span>
                    <UiBadge tone={inv.status === "PAID" ? "emerald" : "teal"}>
                      {formatInvoiceStatus(inv.status)}
                    </UiBadge>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
