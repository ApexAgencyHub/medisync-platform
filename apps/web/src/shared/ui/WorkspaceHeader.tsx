"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import type { AuthenticatedUser } from "@medisync/contracts";
import { LogOut, UserCheck } from "lucide-react";
import { formatRoleLabel } from "../i18n/human-labels";
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
  emergencyHotline,
  prefixMeta,
  extraMeta,
  user,
  guestLabel,
  hideGuestSignIn = false,
  portalHref,
  onSignOut,
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
      ? { signIn: "تسجيل الدخول", pending: "بانتظار مراجعة الإدارة", emergency: "طوارئ" }
      : locale === "fr"
        ? { signIn: "Connexion", pending: "Validation admin en attente", emergency: "Urgences" }
        : { signIn: "Sign In", pending: "Pending Admin Verification", emergency: "Emergency" };

  return (
    <section
      dir={isRtl ? "rtl" : "ltr"}
      aria-label={title}
      className="flex flex-col gap-2 border-b border-[#D7E4F2] pb-2.5 sm:pb-3 lg:flex-row lg:items-center lg:justify-between lg:gap-4"
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
          {emergencyHotline ? (
            <>
              <span aria-hidden="true" className="text-[#B7CDE4]">
                ·
              </span>
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-[10.5px] font-medium text-[#DC2626]">
                <span className="hidden sm:inline">{labels.emergency}</span>
                <strong dir="ltr" className="font-semibold">
                  {emergencyHotline}
                </strong>
              </span>
            </>
          ) : null}
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
          className="font-editorial mt-0.5 text-base font-bold leading-snug tracking-[-0.02em] text-[#0F243E] sm:text-lg lg:truncate lg:text-xl xl:text-[23px]"
        >
          {title}
        </h1>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 lg:shrink-0 lg:flex-nowrap">
        {actions}

        {user ? (
          <div className="inline-flex h-9 max-w-full items-center gap-1.5 rounded-xl border border-[#D7E4F2] bg-white ps-2.5 pe-1 text-xs shadow-2xs xl:h-10 xl:gap-2 xl:ps-3 xl:pe-1.5">
            <UserCheck
              className="h-3.5 w-3.5 shrink-0 text-[#0066CC]"
              aria-hidden="true"
            />
            <span className="max-w-[110px] truncate font-semibold text-[#0F243E] sm:max-w-[135px] xl:max-w-[160px]">
              <bdi dir="auto">{user.fullName}</bdi>
            </span>
            <span className="hidden rounded-full border border-[#D7E4F2] bg-[#F3F8FD] px-2 py-0.5 text-[10.5px] font-medium text-[#2F4661] xl:inline">
              {formatRoleLabel(user.role, locale)}
            </span>
            {isPending ? (
              <Link
                href={resolvedPortalHref}
                className="whitespace-nowrap rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10.5px] font-semibold text-amber-900"
              >
                {labels.pending}
              </Link>
            ) : null}
            {onSignOut ? (
              <button
                type="button"
                onClick={onSignOut}
                aria-label="Sign out"
                title="Sign out"
                className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[#4A627D] transition-colors hover:bg-rose-50 hover:text-[#DC2626] active:scale-95 xl:h-8 xl:w-8"
              >
                <LogOut className="h-3.5 w-3.5 xl:h-4 xl:w-4" aria-hidden="true" />
              </button>
            ) : null}
          </div>
        ) : !hideGuestSignIn ? (
          <Link
            href={resolvedPortalHref}
            className="inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-xl bg-[#0066CC] px-3.5 text-xs font-semibold text-white shadow-xs hover:bg-[#0052A3] xl:h-10 xl:px-4"
          >
            <UserCheck className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{guestLabel ?? labels.signIn}</span>
          </Link>
        ) : null}
      </div>
    </section>
  );
}
