"use client";

import Link from "next/link";
import { BrandMark } from "./BrandMark";
import { LocaleTogglePill } from "../i18n/LocaleTogglePill";
import { useLocale } from "../i18n/locale-store";

export type AppRouteKey =
  | "/"
  | "/portal"
  | "/map"
  | "/booking"
  | "/clinical"
  | "/pharmacy"
  | "/admin";

interface NavItem {
  href: AppRouteKey;
  labelKey: string;
}

const NAV_ITEMS: readonly NavItem[] = [
  { href: "/", labelKey: "nav.overview" },
  { href: "/map", labelKey: "nav.map" },
  { href: "/booking", labelKey: "nav.booking" },
  { href: "/clinical", labelKey: "nav.clinical" },
  { href: "/pharmacy", labelKey: "nav.pharmacy" },
  { href: "/admin", labelKey: "nav.admin" },
  { href: "/portal", labelKey: "nav.portal" },
];

interface AppHeaderProps {
  activeRoute: AppRouteKey;
  statusPill?: string;
}

export function AppHeader({ activeRoute, statusPill }: AppHeaderProps) {
  const { t } = useLocale();

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3.5 sm:px-6">
        <Link href="/" className="min-w-0 shrink-0">
          <BrandMark />
        </Link>

        <nav
          aria-label="Primary Workspace Navigation"
          className="flex flex-wrap items-center justify-end gap-1.5 sm:gap-2"
        >
          {statusPill ? (
            <span className="hidden rounded-full border border-teal-200 bg-teal-50 px-3 py-1 font-mono-tabular text-xs font-medium text-teal-900 lg:inline-flex">
              {statusPill}
            </span>
          ) : null}

          <LocaleTogglePill />

          {NAV_ITEMS.map((item) => {
            const isActive = item.href === activeRoute;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={
                  isActive
                    ? "inline-flex min-h-[38px] items-center whitespace-nowrap rounded-lg bg-teal-800 px-2.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-teal-900 active:scale-[0.99] sm:px-3"
                    : "inline-flex min-h-[38px] items-center whitespace-nowrap rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:border-teal-700 hover:text-teal-800 sm:px-3"
                }
              >
                {t(item.labelKey)}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
