"use client";

import Link from "next/link";
import { useEffect } from "react";
import { AlertTriangle, Home, RotateCcw } from "lucide-react";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Keep error boundary lightweight; Next.js reports digest in production telemetry.
    void error.digest;
  }, [error]);

  return (
    <main className="flex min-h-[70vh] items-center justify-center px-4 py-12">
      <section className="w-full max-w-md space-y-5 rounded-2xl border border-[#D7E4F2] bg-white p-7 text-center shadow-[0_14px_34px_-12px_rgba(15,36,62,0.12)]">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-rose-200 bg-rose-50 text-rose-600">
          <AlertTriangle className="h-6 w-6" aria-hidden="true" />
        </div>
        <div className="space-y-1.5">
          <h1 className="font-editorial text-lg font-extrabold text-[#0F243E]">
            Something interrupted this workspace
          </h1>
          <p className="text-xs leading-relaxed text-[#556E89]">
            A temporary rendering error occurred. Your session and saved clinical records are unaffected.
          </p>
          {error.digest ? (
            <p className="font-mono-tabular text-[11px] text-[#7D95B0]">
              Ref: {error.digest}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2.5 pt-1">
          <button
            type="button"
            onClick={() => reset()}
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl bg-[#0066CC] px-4 text-xs font-bold text-white shadow-xs transition hover:bg-[#0052A3]"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Retry Workspace</span>
          </button>
          <Link
            href="/"
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-[#CBDDF0] bg-[#F8FBFE] px-4 text-xs font-semibold text-[#0F243E] transition hover:bg-white hover:text-[#0066CC]"
          >
            <Home className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Home</span>
          </Link>
        </div>
      </section>
    </main>
  );
}
