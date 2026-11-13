import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { listCountryPacks } from "@medisync/country-packs";
import { PortalWorkspace } from "@/features/auth-portal";
import { BrandMark } from "@/shared/ui/BrandMark";

export const dynamic = "force-dynamic";

export default function PortalPage() {
  const packs = [...listCountryPacks()];
  const apiBaseUrl =
    process.env.API_URL ??
    process.env.NEXT_PUBLIC_API_URL ??
    "http://127.0.0.1:4000";

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <Link href="/" className="shrink-0">
            <BrandMark />
          </Link>
          <div className="flex items-center gap-2">
            <Link
              href="/map"
              className="inline-flex min-h-[38px] items-center rounded-lg bg-teal-800 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-teal-900"
            >
              Live Map
            </Link>
            <Link
              href="/"
              className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:border-teal-700 hover:text-teal-800"
            >
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Overview</span>
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
        <PortalWorkspace packs={packs} apiBaseUrl={apiBaseUrl} />
      </main>
    </div>
  );
}
