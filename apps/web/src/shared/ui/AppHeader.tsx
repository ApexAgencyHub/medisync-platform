import Link from "next/link";
import { BrandMark } from "./BrandMark";

export type AppRouteKey =
  | "/"
  | "/portal"
  | "/map"
  | "/booking"
  | "/clinical"
  | "/admin";

interface NavItem {
  href: AppRouteKey;
  label: string;
}

const NAV_ITEMS: readonly NavItem[] = [
  { href: "/", label: "Overview" },
  { href: "/map", label: "Live Map" },
  { href: "/booking", label: "Booking" },
  { href: "/clinical", label: "Clinical" },
  { href: "/portal", label: "Portal" },
];

interface AppHeaderProps {
  activeRoute: AppRouteKey;
  statusPill?: string;
}

export function AppHeader({ activeRoute, statusPill }: AppHeaderProps) {
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
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
