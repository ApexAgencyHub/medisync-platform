"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Building2,
  CalendarCheck2,
  Globe,
  HeartHandshake,
  Home,
  Map as MapIcon,
  Menu,
  Pill,
  ShieldCheck,
  Stethoscope,
  Users,
  X,
} from "lucide-react";
import { BrandMark } from "./BrandMark";
import { LocaleTogglePill } from "../i18n/LocaleTogglePill";
import { useLocale } from "../i18n/locale-store";

export type AppRouteKey =
  | "/"
  | "/patient"
  | "/profiles"
  | "/portal"
  | "/map"
  | "/booking"
  | "/clinical"
  | "/pharmacy"
  | "/admin";

interface NavItem {
  href: AppRouteKey;
  labelKey: string;
  icon: typeof Home;
}

const NAV_ITEMS: readonly NavItem[] = [
  { href: "/", labelKey: "nav.overview", icon: Home },
  { href: "/patient", labelKey: "nav.patient", icon: HeartHandshake },
  { href: "/profiles", labelKey: "nav.profiles", icon: Users },
  { href: "/map", labelKey: "nav.map", icon: MapIcon },
  { href: "/booking", labelKey: "nav.booking", icon: CalendarCheck2 },
  { href: "/clinical", labelKey: "nav.clinical", icon: Stethoscope },
  { href: "/pharmacy", labelKey: "nav.pharmacy", icon: Pill },
  { href: "/admin", labelKey: "nav.admin", icon: ShieldCheck },
  { href: "/portal", labelKey: "nav.portal", icon: Building2 },
];

interface AppHeaderProps {
  activeRoute: AppRouteKey;
  statusPill?: string;
}

/** Clean global workspace header paired with a slide-over navigation and language sidebar. */
export function AppHeader({ activeRoute, statusPill }: AppHeaderProps) {
  const { t } = useLocale();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!sidebarOpen) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setSidebarOpen(false);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [sidebarOpen]);

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur-xs">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <Link href="/" className="min-w-0 shrink-0">
            <BrandMark />
          </Link>

          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            aria-label={t("menu.open")}
            aria-expanded={sidebarOpen}
            className="inline-flex min-h-[40px] shrink-0 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-semibold text-slate-800 shadow-xs transition-colors hover:border-teal-700 hover:bg-teal-50/70 hover:text-teal-900 active:scale-[0.99]"
          >
            <Menu className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{t("menu.title")}</span>
          </button>
        </div>
      </header>

      {sidebarOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t("menu.title")}
          className="fixed inset-0 z-50 flex justify-end bg-slate-950/45 backdrop-blur-xs"
          onClick={() => setSidebarOpen(false)}
        >
          <aside
            className="flex h-full w-80 max-w-[85vw] flex-col justify-between overflow-y-auto border-s border-slate-200 bg-white p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="space-y-6">
              <div className="flex items-center justify-between gap-2 border-b border-slate-200 pb-4">
                <BrandMark />
                <button
                  type="button"
                  onClick={() => setSidebarOpen(false)}
                  aria-label={t("menu.close")}
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>

              {statusPill ? (
                <p className="rounded-xl border border-teal-200 bg-teal-50 px-3 py-2 text-center font-mono-tabular text-xs font-medium text-teal-900">
                  {statusPill}
                </p>
              ) : null}

              <div className="space-y-2">
                <p className="px-1 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  {t("menu.navigation")}
                </p>
                <nav
                  aria-label="Sidebar Workspace Navigation"
                  className="space-y-1"
                >
                  {NAV_ITEMS.map((item) => {
                    const Icon = item.icon;
                    const isActive = item.href === activeRoute;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setSidebarOpen(false)}
                        aria-current={isActive ? "page" : undefined}
                        className={
                          isActive
                            ? "flex min-h-[44px] items-center gap-3 rounded-xl bg-teal-800 px-3.5 py-2 text-sm font-semibold text-white shadow-xs"
                            : "flex min-h-[44px] items-center gap-3 rounded-xl px-3.5 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-950"
                        }
                      >
                        <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                        <span>{t(item.labelKey)}</span>
                      </Link>
                    );
                  })}
                </nav>
              </div>

              <div className="space-y-2 border-t border-slate-200 pt-5">
                <p className="flex items-center gap-1.5 px-1 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <Globe className="h-3.5 w-3.5 text-teal-800" aria-hidden="true" />
                  <span>{t("menu.language")}</span>
                </p>
                <LocaleTogglePill />
              </div>
            </div>
          </aside>
        </div>
      ) : null}
    </>
  );
}
