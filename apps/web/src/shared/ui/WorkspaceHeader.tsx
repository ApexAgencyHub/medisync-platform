"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import type { AuthenticatedUser } from "@medisync/contracts";
import { UserCheck } from "lucide-react";
import { useLocale } from "../i18n/locale-store";

export interface WorkspaceHeaderProps {
  title: string;
  countryCode: string;
  countryName: string;
  currencyCode: string;
  emergencyHotline?: string;
  prefixMeta?: ReactNode;
  extraMeta?: ReactNode;
  user?: AuthenticatedUser | null;
  guestLabel?: string;
  hideGuestSignIn?: boolean;
  portalHref?: string;
  onSignOut?: () => void;
  actions?: ReactNode;
}

export function WorkspaceHeader({
  title,
  countryCode,
  countryName,
  currencyCode,
  prefixMeta,
  extraMeta,
  user,
  guestLabel,
  hideGuestSignIn = false,
  portalHref,
  actions,
}: WorkspaceHeaderProps) {
  const { locale, isRtl } = useLocale();
  const isStaff =
    user !== null &&
    user !== undefined &&
    user.role !== "PATIENT" &&
    user.role !== "CAREGIVER";
  const resolvedPortalHref = portalHref ?? (isStaff ? "/pro" : "/portal");
  const isPending =
    Boolean(user) &&
    (user!.accountStatus === "PENDING_APPROVAL" ||
      (isStaff && user!.role !== "OPS_ADMIN" && !user!.credentialVerified));

  const labels =
    locale === "ar"
      ? { signIn: "تسجيل الدخول", pending: "بانتظار مراجعة الإدارة" }
      : locale === "fr"
        ? { signIn: "Connexion", pending: "Validation admin en attente" }
        : { signIn: "Sign In", pending: "Pending Admin Verification" };

  const hasRightCluster =
    Boolean(actions) ||
    isPending ||
    (!user && !hideGuestSignIn);

  return (
    <section
      dir={isRtl ? "rtl" : "ltr"}
      aria-label={title}
      className="flex flex-col gap-2 border-b border-[#D7E4F2] pb-2.5 sm:pb-3 lg:flex-row lg:flex-wrap lg:items-center lg:justify-between lg:gap-x-4 lg:gap-y-2"
    >
      <div className="min-w-0 flex-1">
        <div className="atlas-no-scrollbar flex flex-nowrap items-center gap-x-1.5 overflow-x-auto whitespace-nowrap text-[11px] font-medium text-[#556E89] sm:flex-wrap sm:gap-x-2">
          <span className="inline-flex shrink-0 items-center gap-1.5 text-[#0F243E]">
            <span
              aria-hidden="true"
              className="h-1.5 w-1.5 rounded-full bg-[#0F9D88]"
            />
            {prefixMeta ? <>{prefixMeta} </> : null}
            <strong className="font-semibold">{countryName}</strong>
            <span dir="ltr" className="text-[#6B829D]">
              ({countryCode})
            </span>
          </span>
          <span aria-hidden="true" className="text-[#B7CDE4]">
            ·
          </span>
          <span dir="ltr" className="shrink-0 font-semibold text-[#2F4661]">
            {currencyCode}
          </span>
          {extraMeta ? (
            <>
              <span aria-hidden="true" className="text-[#B7CDE4]">
                ·
              </span>
              <span className="shrink-0">{extraMeta}</span>
            </>
          ) : null}
        </div>

        <h1
          title={title}
          className="font-editorial mt-0.5 text-base font-bold leading-snug tracking-[-0.02em] text-[#0F243E] sm:text-lg lg:text-xl xl:text-[23px]"
        >
          {title}
        </h1>
      </div>

      {hasRightCluster ? (
        <div className="flex flex-wrap items-center gap-2 lg:shrink-0">
          {actions}

          {isPending ? (
            <Link
              href={resolvedPortalHref}
              className="whitespace-nowrap rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-900 hover:bg-amber-100"
            >
              {labels.pending}
            </Link>
          ) : null}

          {!user && !hideGuestSignIn ? (
            <Link
              href={resolvedPortalHref}
              className="inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-xl bg-[#0066CC] px-3.5 text-xs font-semibold text-white shadow-xs hover:bg-[#0052A3] active:scale-[0.98] xl:h-10 xl:px-4"
            >
              <UserCheck className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{guestLabel ?? labels.signIn}</span>
            </Link>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
