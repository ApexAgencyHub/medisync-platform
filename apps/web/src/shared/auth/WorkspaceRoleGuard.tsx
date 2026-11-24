"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import type { AuthenticatedUser, UserRole } from "@medisync/contracts";
import { ArrowRight, KeyRound, Lock, ShieldAlert, UserPlus } from "lucide-react";
import { formatRoleLabel } from "@/shared/i18n/human-labels";
import { useLocale } from "@/shared/i18n/locale-store";
import { isPendingStaffVerification } from "@/shared/ui/VerificationGateNotice";
import { getPrimaryWorkspaceForUser } from "./role-capabilities";

interface WorkspaceRoleGuardProps {
  user: AuthenticatedUser | null;
  hydrated: boolean;
  allowedRoles: readonly UserRole[];
  workspaceTitle: string;
  requiredRoleDescription: string;
  allowPendingMatchingRole?: boolean;
  hideRecruitment?: boolean;
  primaryActionLabel?: string;
  onPrimaryAction?: () => void;
  children: ReactNode;
}

const ROLE_GUARD_COPY = {
  en: {
    protectedEyebrow: "Protected Staff & Partner Workspace",
    signInRequiredSuffix: "Sign-In Required",
    reservedPrefix: "This portal is isolated from public patient views and reserved for",
    signInStaffCta: "Sign In to Staff Portal",
    applyPartnerCta: "Apply as Medical Partner",
    returnPatientCta: "Return to Patient Care",
    separationEyebrow: "Role Separation Active",
    awaitingSuffix: "Awaiting Admin Approval",
    restrictedPrefix: "Restricted to",
    pendingMsgPrefix: "Your",
    pendingMsgSuffix:
      "account is currently pending administrator verification. Review your credential checklist in the Partner Onboarding Portal while waiting.",
    mismatchMsgPrefix: "You are currently signed in as",
    mismatchMsgSuffix:
      ". For safety and clinical privacy, this interface is accessible only to",
    switchAccountCta: "Switch Account",
  },
  fr: {
    protectedEyebrow: "Espace Protégé · Personnel & Partenaires",
    signInRequiredSuffix: "Connexion Requise",
    reservedPrefix:
      "Ce portail est séparé de l'interface patient et réservé aux",
    signInStaffCta: "Connexion Espace Pro",
    applyPartnerCta: "Devenir Partenaire Santé",
    returnPatientCta: "Retour à l'Espace Patient",
    separationEyebrow: "Séparation des Rôles Active",
    awaitingSuffix: "En Attente d'Approbation",
    restrictedPrefix: "Réservé aux",
    pendingMsgPrefix: "Votre compte",
    pendingMsgSuffix:
      "est en cours de vérification par l'administration. Consultez vos documents dans le portail partenaire en attendant.",
    mismatchMsgPrefix: "Vous êtes connecté en tant que",
    mismatchMsgSuffix:
      ". Pour la sécurité et la confidentialité médicale, cet espace est réservé aux",
    switchAccountCta: "Changer de Compte",
  },
  ar: {
    protectedEyebrow: "فضاء محمي · الطاقم الطبي والشركاء",
    signInRequiredSuffix: "تسجيل الدخول مطلوب",
    reservedPrefix: "هذه الواجهة مفصولة عن فضاء المرضى ومخصصة فقط لـ",
    signInStaffCta: "تسجيل الدخول المهني",
    applyPartnerCta: "انضم كشريك طبي",
    returnPatientCta: "الرجوع لصفحة المريض",
    separationEyebrow: "فصل الصلاحيات مفعّل",
    awaitingSuffix: "في انتظار موافقة الإدارة",
    restrictedPrefix: "مخصص فقط لـ",
    pendingMsgPrefix: "حسابك كـ",
    pendingMsgSuffix:
      "قيد المراجعة من طرف الإدارة. يمكنك متابعة حالة وثائقك عبر بوابة الاعتماد.",
    mismatchMsgPrefix: "أنت مسجّل الدخول الآن بصفة",
    mismatchMsgSuffix:
      ". لحماية الخصوصية الطبية، هذه الواجهة مفتوحة فقط لـ",
    switchAccountCta: "تغيير الحساب",
  },
} as const;

/**
 * Frontend route guard enforcing role isolation across English, French, and Arabic RTL.
 */
export function WorkspaceRoleGuard({
  user,
  hydrated,
  allowedRoles,
  workspaceTitle,
  requiredRoleDescription,
  allowPendingMatchingRole = false,
  hideRecruitment = false,
  primaryActionLabel,
  onPrimaryAction,
  children,
}: WorkspaceRoleGuardProps) {
  const { locale, isRtl } = useLocale();
  const copy = ROLE_GUARD_COPY[locale] ?? ROLE_GUARD_COPY.en;

  if (!hydrated) {
    return (
      <section
        aria-label="Verifying workspace access"
        className="mx-auto max-w-2xl rounded-2xl border border-[#D7E4F2] bg-white p-6"
      >
        <div className="space-y-3">
          <div className="h-5 w-48 animate-pulse rounded-lg bg-slate-200" />
          <div className="h-4 w-72 animate-pulse rounded-lg bg-slate-100" />
        </div>
      </section>
    );
  }

  if (!user) {
    return (
      <section
        dir={isRtl ? "rtl" : "ltr"}
        aria-label={`${workspaceTitle} access gate`}
        className="mx-auto max-w-3xl overflow-hidden rounded-2xl border border-[#D7E4F2] bg-white"
      >
        <div className="grid sm:grid-cols-12">
          <div className="atlas-ice-grid flex flex-col justify-between border-b border-[#D7E4F2] p-6 text-[#0F243E] sm:col-span-4 sm:border-e sm:border-b-0">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[#BFDBFE] bg-[#EBF4FF] text-[#0066CC]">
              <Lock className="h-5 w-5" aria-hidden="true" />
            </span>
            <p className="mt-6 font-mono-tabular text-[10px] font-semibold uppercase tracking-[0.12em] text-[#0066CC]">
              {copy.protectedEyebrow}
            </p>
          </div>

          <div className="min-w-0 space-y-3 p-6 sm:col-span-8 sm:p-7">
            <div>
              <h2 className="font-editorial text-2xl leading-tight text-[#0F243E] sm:text-[28px]">
                <bdi dir="auto">{workspaceTitle}</bdi> — {copy.signInRequiredSuffix}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-[#475A70]">
                {copy.reservedPrefix}{" "}
                <strong className="font-semibold text-[#0F243E]">
                  <bdi dir="auto">{requiredRoleDescription}</bdi>
                </strong>
                .
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-2">
              {onPrimaryAction && primaryActionLabel ? (
                <button
                  type="button"
                  onClick={onPrimaryAction}
                  className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-[#0066CC] px-4 text-xs font-semibold text-white transition-colors hover:bg-[#0052A3]"
                >
                  <KeyRound className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>{primaryActionLabel}</span>
                </button>
              ) : (
                <Link
                  href="/pro"
                  className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-[#0066CC] px-4 text-xs font-semibold text-white transition-colors hover:bg-[#0052A3]"
                >
                  <KeyRound className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>{copy.signInStaffCta}</span>
                </Link>
              )}

              {!hideRecruitment ? (
                <Link
                  href="/pro?tab=register"
                  className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[#CBDDF0] bg-white px-3.5 text-xs font-semibold text-[#0F243E] transition-colors hover:border-[#0066CC]"
                >
                  <UserPlus className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>{copy.applyPartnerCta}</span>
                </Link>
              ) : null}

              <Link
                href="/"
                className="inline-flex h-9 items-center gap-1 rounded-xl border border-[#D7E4F2] bg-[#F3F8FD] px-3.5 text-xs font-semibold text-[#475A70] transition-colors hover:bg-white hover:text-[#0F243E]"
              >
                <span>{copy.returnPatientCta}</span>
              </Link>
            </div>
          </div>
        </div>
      </section>
    );
  }

  const roleAllowed = allowedRoles.includes(user.role);
  const pendingBlocked =
    roleAllowed && !allowPendingMatchingRole && isPendingStaffVerification(user);

  if (!roleAllowed || pendingBlocked) {
    const home = getPrimaryWorkspaceForUser(user, locale);
    const roleLabel = formatRoleLabel(user.role, locale);

    return (
      <section
        dir={isRtl ? "rtl" : "ltr"}
        aria-label={`${workspaceTitle} restricted notice`}
        className="mx-auto max-w-2xl rounded-2xl border border-amber-200 bg-amber-50/90 p-6 sm:p-8"
      >
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
          <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-amber-300 bg-white text-amber-800">
            <ShieldAlert className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1 space-y-3">
            <div>
              <p className="font-mono-tabular text-[11px] font-bold uppercase tracking-wider text-amber-800">
                {copy.separationEyebrow}
              </p>
              <h2 className="mt-1 text-lg font-bold text-slate-950">
                {pendingBlocked
                  ? `${workspaceTitle} — ${copy.awaitingSuffix}`
                  : `${copy.restrictedPrefix} ${requiredRoleDescription}`}
              </h2>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
                {pendingBlocked ? (
                  <>
                    {copy.pendingMsgPrefix}{" "}
                    <strong className="font-semibold text-slate-800">
                      {roleLabel}
                    </strong>{" "}
                    {copy.pendingMsgSuffix}
                  </>
                ) : (
                  <>
                    {copy.mismatchMsgPrefix}{" "}
                    <strong className="font-semibold text-slate-800">
                      {roleLabel}
                    </strong>
                    {copy.mismatchMsgSuffix}{" "}
                    <bdi dir="auto">{requiredRoleDescription}</bdi>.
                  </>
                )}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Link
                href={home.href}
                className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-[#0066CC] px-4 text-xs font-semibold text-white transition-colors hover:bg-[#0052A3]"
              >
                <span>{home.label}</span>
                <ArrowRight
                  className="h-3.5 w-3.5 rtl:rotate-180"
                  aria-hidden="true"
                />
              </Link>
              <Link
                href="/pro"
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#CBDDF0] bg-white px-3.5 text-xs font-semibold text-[#0F243E] transition-colors hover:bg-[#F3F8FD]"
              >
                <span>{copy.switchAccountCta}</span>
              </Link>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return <>{children}</>;
}
