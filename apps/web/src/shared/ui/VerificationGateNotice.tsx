"use client";

import Link from "next/link";
import { isStaffWorkerRole, type AuthenticatedUser } from "@medisync/contracts";
import { formatRoleLabel } from "@/shared/i18n/human-labels";
import { useLocale } from "@/shared/i18n/locale-store";
import { ArrowRight, ShieldAlert } from "lucide-react";

export function isPendingStaffVerification(
  user: AuthenticatedUser | null | undefined,
): boolean {
  if (!user) return false;
  return (
    isStaffWorkerRole(user.role) &&
    (user.accountStatus === "PENDING_APPROVAL" || !user.credentialVerified)
  );
}

interface VerificationGateNoticeProps {
  user: AuthenticatedUser | null | undefined;
  compact?: boolean;
}

const VERIFICATION_COPY = {
  en: {
    titlePrefix: "Administration Verification Required",
    summary:
      "Upload your required documents and workplace details, then wait for Administration approval to activate live operational tools.",
    cta: "Upload Papers & Check Status",
  },
  fr: {
    titlePrefix: "Vérification Administrative Requise",
    summary:
      "Téléversez vos justificatifs et votre établissement d'exercice, puis attendez la validation de l'Administration.",
    cta: "Envoyer Mes Documents",
  },
  ar: {
    titlePrefix: "مطلوب تأكيد الحساب من الإدارة",
    summary:
      "ارفع وثائقك المهنية ومقر العمل ديالك، وتسنّى موافقة الإدارة باش تفتح ليك أدوات العمل الكاملة.",
    cta: "رفع الوثائق ومتابعة الطلب",
  },
} as const;

export function VerificationGateNotice({
  user,
  compact = false,
}: VerificationGateNoticeProps) {
  const { locale, isRtl } = useLocale();
  if (!user || !isPendingStaffVerification(user)) return null;
  const copy = VERIFICATION_COPY[locale] ?? VERIFICATION_COPY.en;

  return (
    <div
      dir={isRtl ? "rtl" : "ltr"}
      role="status"
      className={`flex flex-col justify-between gap-3 rounded-2xl border border-amber-300 bg-amber-50 text-amber-950 sm:flex-row sm:items-center ${
        compact ? "p-3.5 text-xs" : "p-5 text-sm"
      }`}
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-amber-300 bg-white text-amber-700">
          <ShieldAlert className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="font-mono-tabular text-xs font-semibold uppercase tracking-[0.06em] text-amber-900">
            {copy.titlePrefix} ({formatRoleLabel(user.role, locale)})
          </p>
          <p className="mt-0.5 text-xs leading-relaxed text-amber-900/90">
            {copy.summary}
          </p>
        </div>
      </div>

      <Link
        href="/pro"
        className="inline-flex min-h-[36px] shrink-0 items-center justify-center gap-1.5 rounded-xl bg-[#0066CC] px-4 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[#0052A3] active:scale-[0.98]"
      >
        <span>{copy.cta}</span>
        <ArrowRight className="h-3.5 w-3.5 rtl:rotate-180" aria-hidden="true" />
      </Link>
    </div>
  );
}
