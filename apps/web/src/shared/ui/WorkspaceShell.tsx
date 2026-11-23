import type { ReactNode } from "react";
import { AppHeader, type AppRouteKey } from "./AppHeader";
import { ClinicalOsRail } from "./ClinicalOsRail";

interface WorkspaceShellProps {
  activeRoute: AppRouteKey;
  statusPill?: string;
  children: ReactNode;
  maxWidthClass?: string;
  hideRail?: boolean;
}

/**
 * Pure White & Clinical Sky Medical Workspace Shell.
 */
export function WorkspaceShell({
  activeRoute,
  statusPill,
  children,
  maxWidthClass = "max-w-7xl",
  hideRail = false,
}: WorkspaceShellProps) {
  return (
    <div className="min-h-dvh bg-[#F3F8FD] text-[#0F243E]">
      <AppHeader
        activeRoute={activeRoute}
        {...(statusPill ? { statusPill } : {})}
      />
      <div className="flex min-h-[calc(100dvh-3.5rem)] xl:min-h-[calc(100dvh-4rem)]">
        {!hideRail ? <ClinicalOsRail activeRoute={activeRoute} /> : null}
        <main className="min-w-0 flex-1">
          <div
            className={`mx-auto ${maxWidthClass} px-3 py-2.5 sm:px-5 sm:py-3.5 xl:px-7 xl:py-4`}
          >
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
