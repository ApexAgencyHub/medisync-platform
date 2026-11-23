"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import type { AuthenticatedUser, UserRole } from "@medisync/contracts";
import { ArrowRight, LogOut, ShieldAlert } from "lucide-react";
import { formatRoleLabel } from "@/shared/i18n/human-labels";
import { useLocale } from "@/shared/i18n/locale-store";
import {
  getPrimaryWorkspaceForUser,
  isConsumerUserOrGuest,
} from "./role-capabilities";
import { revokeClientSession } from "./session-storage";

interface ConsumerWorkspaceGuardProps {
  user: AuthenticatedUser | null;
  hydrated: boolean;
  surfaceTitle: string;
  allowRoles?: readonly UserRole[];
  onSignOut?: () => void;
  children: ReactNode;
}

const GUARD_COPY = {
  en: {
    eyebrow: "Role Separation Active",
    headingSuffix: "Workspace Isolated",
    signedInPrefix: "You are signed in as",
    middle: "Patient views like",
    suffix: "are separated so staff accounts stay focused on professional workflows.",
    signOutCta: "Sign Out to Use as Patient",
  },
  fr: {
    eyebrow: "Séparation des Rôles Active",
    headingSuffix: "Espace Isolé",
    signedInPrefix: "Vous êtes connecté en tant que",
    middle: "Les espaces patients comme",
    suffix: "sont séparés afin de garder les comptes professionnels dédiés à leur métier.",
    signOutCta: "Se déconnecter pour utiliser en Patient",
  },
  ar: {
    eyebrow: "فصل الحسابات مفعّل",
    headingSuffix: "مساحة مهنية معزولة",
    signedInPrefix: "أنت مسجّل الدخول حالياً بصفة",
    middle: "واجهات المرضى بحال",
    suffix: "معزولة باش يبقى حسابك المهني مخصص للعمل فقط.",
    signOutCta: "تسجيل الخروج واستعمال الحساب كمريض",
  },
} as const;

const WORKSPACE_CTA_LOCALIZED: Record<string, { fr: string; ar: string }> = {
  "/clinical": { fr: "Ouvrir l'Espace Médecin", ar: "فتح فضاء الطبيب" },
  "/nurse": { fr: "Ouvrir le Poste Infirmier", ar: "فتح محطة التمريض" },
  "/driver": { fr: "Ouvrir l'Espace Chauffeur", ar: "فتح فضاء السائق" },
  "/pharmacy": { fr: "Ouvrir le Comptoir Pharmacie", ar: "فتح مكتب الصيدلية" },
  "/hospital": { fr: "Ouvrir l'Accueil Hôpital", ar: "فتح استقبال المستشفى" },
  "/lab": { fr: "Ouvrir le Bureau Labo", ar: "فتح مكتب المختبر" },
  "/admin": { fr: "Ouvrir l'Administration", ar: "فتح لوحة الإدارة" },
  "/pro": { fr: "Ouvrir MediSync Pro", ar: "فتح بوابة المهنيين Pro" },
  "/patient": { fr: "Ouvrir Mon Espace Santé", ar: "فتح ملفي الصحي" },
};

/**
 * Prevents non-patient professionals (active or pending verification) from mixing into Consumer/Patient UIs.
 */
export function ConsumerWorkspaceGuard({
  user,
  hydrated,
  surfaceTitle,
  allowRoles = [],
  onSignOut,
  children,
}: ConsumerWorkspaceGuardProps) {
  const { locale, isRtl } = useLocale();
  const copy = GUARD_COPY[locale] ?? GUARD_COPY.en;

  const isStaff =
    hydrated &&
    user !== null &&
    !isConsumerUserOrGuest(user) &&
    !allowRoles.includes(user.role);

  if (isStaff && user) {
    const home = getPrimaryWorkspaceForUser(user, locale);
    const localizedRole = formatRoleLabel(user.role, locale);
    const localizedCta =
      locale === "en"
        ? home.label
        : WORKSPACE_CTA_LOCALIZED[home.href]?.[locale] ?? home.label;

    return (
      <section
        dir={isRtl ? "rtl" : "ltr"}
        aria-label={`${surfaceTitle} isolated from staff view`}
        className="mx-auto max-w-3xl overflow-hidden rounded-2xl border border-[#D7E4F2] bg-white"
      >
        <div className="grid sm:grid-cols-12">
          <div className="atlas-ice-grid flex flex-col justify-between border-b border-[#D7E4F2] p-6 text-[#0F243E] sm:col-span-4 sm:border-e sm:border-b-0">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[#BFDBFE] bg-[#EBF4FF] text-[#0066CC]">
              <ShieldAlert className="h-5 w-5" aria-hidden="true" />
            </span>
            <p className="mt-6 font-mono-tabular text-[10px] font-semibold uppercase tracking-[0.12em] text-[#0066CC]">
              {copy.eyebrow}
            </p>
          </div>

          <div className="min-w-0 space-y-3 p-6 sm:col-span-8 sm:p-7">
            <div>
              <h2 className="font-editorial text-2xl leading-tight text-[#0F243E] sm:text-[28px]">
                {localizedRole} — {copy.headingSuffix}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-[#475A70]">
                {copy.signedInPrefix}{" "}
                <strong className="font-semibold text-[#0F243E]">
                  <bdi dir="auto">{user.fullName}</bdi>
                </strong>{" "}
                ({localizedRole}). {copy.middle}{" "}
                <strong>
                  <bdi dir="auto">{surfaceTitle}</bdi>
                </strong>{" "}
                {copy.suffix}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-2">
              <Link
                href={home.href}
                className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-[#0066CC] px-4 text-xs font-semibold text-white transition-colors hover:bg-[#0052A3]"
              >
                <span>{localizedCta}</span>
                <ArrowRight
                  className="h-3.5 w-3.5 rtl:rotate-180"
                  aria-hidden="true"
                />
              </Link>
              <button
                type="button"
                onClick={() => {
                  revokeClientSession();
                  onSignOut?.();
                }}
                className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[#CBDDF0] bg-white px-3.5 text-xs font-semibold text-[#0F243E] transition-colors hover:border-[#0066CC]"
              >
                <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{copy.signOutCta}</span>
              </button>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return <>{children}</>;
}
