"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  AuthenticatedUser,
  LegalConsentRecord,
  LegalConsentType,
  LocaleCode,
} from "@medisync/contracts";
import {
  CheckCircle2,
  Download,
  FileText,
  ShieldAlert,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { clearStoredSession } from "@/shared/auth/session-storage";
import { useLocale } from "@/shared/i18n/locale-store";
import { UiButton, UiInput, UiSwitch, useToastSetter } from "@/shared/ui/primitives";
import {
  deleteMyAccount,
  exportMyPersonalData,
  fetchMyConsents,
  updateMyConsent,
} from "../api-client";

interface ComplianceRightsCardProps {
  apiBaseUrl: string;
  token: string;
  user: AuthenticatedUser;
}

const COMPLIANCE_UI_COPY: Record<
  LocaleCode,
  {
    title: string;
    subtitle: string;
    consentsHeading: string;
    termsLabel: string;
    telehealthLabel: string;
    dataSharingLabel: string;
    grantedPill: string;
    revokedPill: string;
    enableBtn: string;
    withdrawBtn: string;
    exportBtn: string;
    exportingBtn: string;
    deleteBtn: string;
    deleteConfirmTitle: string;
    deleteConfirmHint: string;
    deleteInputPlaceholder: string;
    deleteSubmitBtn: string;
    cancelBtn: string;
    exportSuccess: string;
    consentSaved: string;
    deleteBlockedAdmin: string;
  }
> = {
  en: {
    title: "Privacy Consents & Data Rights",
    subtitle:
      "Inspect your signed legal consents, download a portable JSON copy of your medical records (Moroccan CNDP Law 09-08), or request account erasure.",
    consentsHeading: "Active Legal Agreements",
    termsLabel: "Platform Terms & Health Data Processing",
    telehealthLabel: "Informed Teleconsultation Audio/Video Notice",
    dataSharingLabel: "Care Continuity Record Sharing (Doctors & Nurses)",
    grantedPill: "Granted",
    revokedPill: "Withdrawn",
    enableBtn: "Grant",
    withdrawBtn: "Withdraw",
    exportBtn: "Download My Data (JSON)",
    exportingBtn: "Preparing Export...",
    deleteBtn: "Anonymize & Close Account",
    deleteConfirmTitle: "Permanent Account Anonymization",
    deleteConfirmHint:
      "Type DELETE_MY_ACCOUNT to scrub personal contact identifiers and sign out everywhere.",
    deleteInputPlaceholder: "DELETE_MY_ACCOUNT",
    deleteSubmitBtn: "Confirm Erasure",
    cancelBtn: "Cancel",
    exportSuccess: "Personal & clinical data archive downloaded.",
    consentSaved: "Privacy consent preference updated.",
    deleteBlockedAdmin: "Sole active OPS_ADMIN accounts cannot be self-deleted.",
  },
  fr: {
    title: "Consentements & Droits sur les Données",
    subtitle:
      "Consultez vos accords légaux, téléchargez une copie JSON portable de votre dossier (Loi marocaine CNDP 09-08) ou demandez la clôture du compte.",
    consentsHeading: "Accords Légaux Enregistrés",
    termsLabel: "Conditions Générales & Traitement des Données Santé",
    telehealthLabel: "Consentement Éclairé de Téléconsultation",
    dataSharingLabel: "Partage Médical Inter-Équipe (Médecins & Infirmiers)",
    grantedPill: "Accordé",
    revokedPill: "Retiré",
    enableBtn: "Accorder",
    withdrawBtn: "Retirer",
    exportBtn: "Télécharger mes données (JSON)",
    exportingBtn: "Préparation...",
    deleteBtn: "Anonymiser & Fermer le compte",
    deleteConfirmTitle: "Anonymisation Définitive du Compte",
    deleteConfirmHint:
      "Saisissez DELETE_MY_ACCOUNT pour effacer vos identifiants personnels et révoquer vos sessions.",
    deleteInputPlaceholder: "DELETE_MY_ACCOUNT",
    deleteSubmitBtn: "Confirmer l'effacement",
    cancelBtn: "Annuler",
    exportSuccess: "Archive JSON de vos données téléchargée.",
    consentSaved: "Préférence de consentement mise à jour.",
    deleteBlockedAdmin: "Le dernier administrateur OPS_ADMIN actif est protégé.",
  },
  ar: {
    title: "الموافقات القانونية وحقوق المعطيات",
    subtitle:
      "راجع موافقاتك المسجلة، قم بتنزيل نسخة محمولة JSON من ملفك الطبي (القانون المغربي CNDP 09-08 لحماية المعطيات الشخصية)، أو اطلب إغلاق الحساب وإخفاء هويتك.",
    consentsHeading: "الاتفاقيات القانونية المسجلة",
    termsLabel: "شروط الاستخدام ومعالجة المعطيات الصحية",
    telehealthLabel: "الموافقة على الاستشارة عن بُعد بالصوت والفيديو",
    dataSharingLabel: "مشاركة السجل الصحي لمتابعة العلاج",
    grantedPill: "مفعّل",
    revokedPill: "مسحوب",
    enableBtn: "تفعيل",
    withdrawBtn: "سحب",
    exportBtn: "تنزيل بياناتي (JSON)",
    exportingBtn: "جاري التجهيز...",
    deleteBtn: "إغلاق الحساب وإخفاء الهوية",
    deleteConfirmTitle: "تأكيد إخفاء الهوية وإغلاق الحساب",
    deleteConfirmHint:
      "اكتب DELETE_MY_ACCOUNT لمسح معلومات الاتصال الشخصية وإنهاء كل الجلسات.",
    deleteInputPlaceholder: "DELETE_MY_ACCOUNT",
    deleteSubmitBtn: "تأكيد المسح",
    cancelBtn: "إلغاء",
    exportSuccess: "تم تنزيل نسخة JSON من بياناتك الصحية والحساب.",
    consentSaved: "تم تحديث تفضيل الموافقة القانونية.",
    deleteBlockedAdmin: "لا يمكن حذف آخر حساب مدير OPS_ADMIN نشط.",
  },
};

export function ComplianceRightsCard({
  apiBaseUrl,
  token,
  user,
}: ComplianceRightsCardProps) {
  const { locale } = useLocale();
  const router = useRouter();
  const copy = COMPLIANCE_UI_COPY[locale] ?? COMPLIANCE_UI_COPY.en;
  const setBanner = useToastSetter();

  const [consents, setConsents] = useState<LegalConsentRecord[]>([]);
  const [busy, setBusy] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteText, setDeleteText] = useState("");

  const loadConsents = useCallback(async () => {
    const res = await fetchMyConsents(apiBaseUrl, token);
    if (res.ok) {
      setConsents(res.data.consents);
    }
  }, [apiBaseUrl, token]);

  useEffect(() => {
    void loadConsents();
  }, [loadConsents]);

  function isGranted(type: LegalConsentType, defaultValue: boolean): boolean {
    const match = consents.find((c) => c.consentType === type);
    return match ? match.granted : defaultValue;
  }

  async function handleToggleConsent(type: LegalConsentType, nextGranted: boolean) {
    setBusy(true);
    const res = await updateMyConsent(apiBaseUrl, token, {
      consentType: type,
      consentVersion: "2026-11",
      granted: nextGranted,
      sourcePortal: "PROFILE",
    });
    setBusy(false);
    if (!res.ok) {
      setBanner({ tone: "error", text: res.error });
      return;
    }
    setBanner({ tone: "success", text: copy.consentSaved });
    await loadConsents();
  }

  async function handleExportJson() {
    setExporting(true);
    const res = await exportMyPersonalData(apiBaseUrl, token);
    setExporting(false);
    if (!res.ok) {
      setBanner({ tone: "error", text: res.error });
      return;
    }

    const blob = new Blob([JSON.stringify(res.data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `medisync-data-export-${user.id.slice(0, 8)}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setBanner({ tone: "success", text: copy.exportSuccess });
  }

  async function handleAnonymizeAccount() {
    if (deleteText.trim() !== "DELETE_MY_ACCOUNT") return;
    setBusy(true);
    const res = await deleteMyAccount(apiBaseUrl, token);
    setBusy(false);
    if (!res.ok) {
      setBanner({
        tone: "error",
        text:
          res.error === "LAST_ACTIVE_ADMIN_PROTECTED"
            ? copy.deleteBlockedAdmin
            : res.error,
      });
      return;
    }
    clearStoredSession();
    router.push("/");
  }

  const consentRows: Array<{
    type: LegalConsentType;
    label: string;
    defaultGranted: boolean;
    mutable: boolean;
  }> = [
    {
      type: "TERMS_PRIVACY",
      label: copy.termsLabel,
      defaultGranted: true,
      mutable: false,
    },
    {
      type: "TELEHEALTH_CONSENT",
      label: copy.telehealthLabel,
      defaultGranted: true,
      mutable: true,
    },
    {
      type: "DATA_SHARING",
      label: copy.dataSharingLabel,
      defaultGranted: true,
      mutable: true,
    },
  ];

  return (
    <section className="rounded-2xl border border-[#D7E4F2] bg-white p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-base font-bold text-[#0F243E]">
            <ShieldCheck className="h-4 w-4 text-[#0066CC]" aria-hidden="true" />
            <span>{copy.title}</span>
          </h2>
          <p className="mt-1 font-mono-tabular text-[11px] text-slate-500">
            {locale === "fr"
              ? "Loi marocaine CNDP 09-08 · Art. 7–9 (Accès, Portabilité & Effacement)"
              : locale === "ar"
                ? "القانون المغربي CNDP 09-08 · المواد 7–9 (الولوج، النقل والمسح)"
                : "Moroccan CNDP Law 09-08 · Art. 7–9 (Access, Portability & Erasure)"}
          </p>
          <p className="mt-1 max-w-2xl text-xs text-slate-600">{copy.subtitle}</p>
        </div>

        <UiButton
          type="button"
          size="sm"
          variant="outline"
          disabled={exporting}
          onClick={() => void handleExportJson()}
        >
          <Download className="h-3.5 w-3.5" aria-hidden="true" />
          <span>{exporting ? copy.exportingBtn : copy.exportBtn}</span>
        </UiButton>
      </div>

      <div className="mt-4 space-y-2.5">
        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
          {copy.consentsHeading}
        </p>
        {consentRows.map((row) => {
          const granted = isGranted(row.type, row.defaultGranted);
          return (
            <div
              key={row.type}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#D7E4F2] bg-[#F3F8FD] px-4 py-3 text-xs "
            >
              <div className="flex min-w-0 items-center gap-2.5">
                {granted ? (
                  <CheckCircle2
                    className="h-4 w-4 shrink-0 text-[#0066CC]"
                    aria-hidden="true"
                  />
                ) : (
                  <FileText
                    className="h-4 w-4 shrink-0 text-slate-400"
                    aria-hidden="true"
                  />
                )}
                <span className="font-medium text-slate-900">{row.label}</span>
              </div>

              <div className="flex items-center gap-2">
                {row.mutable ? (
                  <UiSwitch
                    checked={granted}
                    disabled={busy}
                    onChange={(next) => void handleToggleConsent(row.type, next)}
                    label={granted ? copy.grantedPill : copy.revokedPill}
                  />
                ) : (
                  <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-800">
                    {copy.grantedPill}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-5 border-t border-slate-200/70 pt-4">
        {!deleteOpen ? (
          <button
            type="button"
            onClick={() => setDeleteOpen(true)}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-700 hover:text-rose-900"
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{copy.deleteBtn}</span>
          </button>
        ) : (
          <div className="space-y-2.5 rounded-2xl bg-rose-50/90 p-4 text-xs text-rose-950 ring-1 ring-rose-200">
            <p className="flex items-center gap-1.5 font-bold">
              <ShieldAlert className="h-4 w-4 text-rose-700" aria-hidden="true" />
              <span>{copy.deleteConfirmTitle}</span>
            </p>
            <p className="text-rose-800">{copy.deleteConfirmHint}</p>
            <div className="flex flex-wrap items-center gap-2">
              <UiInput
                type="text"
                dir="ltr"
                value={deleteText}
                onChange={(e) => setDeleteText(e.target.value)}
                placeholder={copy.deleteInputPlaceholder}
                className="max-w-xs bg-white font-mono-tabular text-xs"
              />
              <UiButton
                type="button"
                size="sm"
                variant="danger"
                disabled={busy || deleteText.trim() !== "DELETE_MY_ACCOUNT"}
                onClick={() => void handleAnonymizeAccount()}
              >
                {copy.deleteSubmitBtn}
              </UiButton>
              <UiButton
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  setDeleteOpen(false);
                  setDeleteText("");
                }}
              >
                {copy.cancelBtn}
              </UiButton>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
