"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { AuthenticatedUser } from "@medisync/contracts";
import { ShieldAlert, ShieldCheck, Siren } from "lucide-react";
import {
  getAllowedMenuRoutes,
  isConsumerUserOrGuest,
} from "../auth/role-capabilities";
import {
  readStoredSession,
  SESSION_CHANGE_EVENT,
} from "../auth/session-storage";
import { formatRoleLabel } from "../i18n/human-labels";
import { useLocale } from "../i18n/locale-store";
import { resolveCountryPack } from "@medisync/country-packs";
import { resolveEffectiveCountryCode } from "../config/deployment";
import { ATLAS_NAV_ITEMS, type AppRouteKey } from "./AppHeader";
import { isPendingStaffVerification } from "./VerificationGateNotice";

/**
 * Pure White Persistent Left Medical Care Navigation Rail.
 * Enforces strict single-role isolation with crisp Clinical Blue active states.
 */
export function ClinicalOsRail({
  activeRoute,
}: {
  activeRoute: AppRouteKey;
}) {
  const { locale, t } = useLocale();
  const [sessionUser, setSessionUser] = useState<AuthenticatedUser | null>(
    null,
  );

  useEffect(() => {
    const sync = () => setSessionUser(readStoredSession()?.user ?? null);
    sync();
    window.addEventListener(SESSION_CHANGE_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(SESSION_CHANGE_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const allowedRoutes = getAllowedMenuRoutes(sessionUser);
  const railItems = ATLAS_NAV_ITEMS.filter((item) =>
    allowedRoutes.has(item.href),
  );
  const isConsumerOrGuest = isConsumerUserOrGuest(sessionUser);
  const pendingStaff = isPendingStaffVerification(sessionUser);

  const railTitle = isConsumerOrGuest
    ? locale === "fr"
      ? "Services de soins"
      : locale === "ar"
        ? "خدمات الرعاية"
        : "Care Services"
    : sessionUser
      ? formatRoleLabel(sessionUser.role, locale)
      : "Medical Workspace";

  const emergencyHotline = resolveCountryPack(
    resolveEffectiveCountryCode(sessionUser?.countryCode),
  ).emergencyHotlines.ambulance;
  const emergencyLabel =
    locale === "fr"
      ? `Urgences ${emergencyHotline}`
      : locale === "ar"
        ? `إسعاف ${emergencyHotline}`
        : `Emergency ${emergencyHotline}`;

  return (
    <aside
      aria-label="Medical Navigation Sidebar"
      className="hidden lg:sticky lg:top-14 xl:top-16 lg:flex lg:h-[calc(100dvh-3.5rem)] xl:h-[calc(100dvh-4rem)] lg:w-[64px] xl:w-[208px] lg:shrink-0 lg:flex-col lg:justify-between border-e border-[#D7E4F2] bg-white text-[#0F243E] transition-[width] duration-150"
    >
      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-3 xl:px-3 xl:py-3.5 [scrollbar-width:thin]">
        <div className="mb-2.5 flex items-center justify-center xl:justify-between xl:px-2.5">
          <span className="hidden truncate text-[11px] font-semibold text-[#6B829D] xl:inline">
            {railTitle}
          </span>
          <span
            aria-hidden="true"
            title={railTitle}
            className={`h-2 w-2 rounded-full ${
              pendingStaff ? "bg-amber-500" : "bg-[#0F9D88]"
            }`}
          />
        </div>

        <ul className="space-y-1">
          {railItems.map((item) => {
            const Icon = item.icon;
            const active = item.href === activeRoute;
            const label = t(item.labelKey);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  title={label}
                  aria-current={active ? "page" : undefined}
                  className={`group flex min-h-[38px] items-center justify-center gap-2.5 rounded-xl px-2 py-2 text-[12.5px] font-medium transition-colors xl:justify-start xl:px-3 ${
                    active
                      ? "border border-[#BFDBFE] bg-[#EBF4FF] font-semibold text-[#0052A3]"
                      : "border border-transparent text-[#4A627D] hover:bg-[#F3F8FD] hover:text-[#0F243E]"
                  }`}
                >
                  <Icon
                    className={`h-4 w-4 shrink-0 ${
                      active
                        ? "text-[#0066CC]"
                        : "text-[#7D96B2] group-hover:text-[#0066CC]"
                    }`}
                    aria-hidden="true"
                  />
                  <span className="sr-only min-w-0 flex-1 truncate xl:not-sr-only">
                    {label}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Pure White Medical Footer Card */}
      <div className="shrink-0 space-y-2 border-t border-[#D7E4F2] bg-[#F3F8FD] p-2 xl:p-2.5">
        {sessionUser ? (
          <div
            title={`${sessionUser.fullName} · ${formatRoleLabel(sessionUser.role, locale)}`}
            className="rounded-xl border border-[#D7E4F2] bg-white px-2 py-2 xl:px-2.5"
          >
            <div className="flex items-center justify-center gap-1.5 xl:justify-between">
              <span className="hidden truncate text-xs font-semibold text-[#0F243E] xl:inline">
                <bdi dir="auto">{sessionUser.fullName}</bdi>
              </span>
              {pendingStaff ? (
                <ShieldAlert
                  className="h-4 w-4 shrink-0 text-amber-600"
                  aria-hidden="true"
                />
              ) : (
                <ShieldCheck
                  className="h-4 w-4 shrink-0 text-[#0F9D88]"
                  aria-hidden="true"
                />
              )}
            </div>
            <p className="mt-0.5 hidden truncate text-[10.5px] text-[#6B829D] xl:block">
              {formatRoleLabel(sessionUser.role, locale)} ·{" "}
              {resolveEffectiveCountryCode(sessionUser.countryCode)}
            </p>
          </div>
        ) : null}

        <div
          title={`${emergencyLabel} · 24/7`}
          className="flex items-center justify-center rounded-xl border border-rose-200 bg-rose-50 px-2 py-1.5 text-xs xl:justify-between xl:px-2.5"
        >
          <span className="inline-flex items-center gap-1.5 font-semibold text-[#DC2626]">
            <Siren className="h-3.5 w-3.5 shrink-0 text-[#DC2626]" aria-hidden="true" />
            <span className="hidden truncate xl:inline">{emergencyLabel}</span>
            <span dir="ltr" className="font-mono-tabular text-[11px] xl:hidden">
              {emergencyHotline}
            </span>
          </span>
          <span className="hidden text-[10.5px] font-semibold text-rose-800 xl:inline">
            24/7
          </span>
        </div>
      </div>
    </aside>
  );
}
