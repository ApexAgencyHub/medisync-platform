"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="flex min-h-screen items-center justify-center bg-[#F3F8FD] px-4 text-[#0F243E] antialiased">
        <main className="w-full max-w-md space-y-5 rounded-2xl border border-[#D7E4F2] bg-white p-7 text-center shadow-lg">
          <h1 className="text-lg font-bold text-[#0F243E]">
            MediSync Global — Recovery Mode
          </h1>
          <p className="text-xs leading-relaxed text-[#556E89]">
            An unexpected application error occurred. Reload to restore your session.
          </p>
          {error.digest ? (
            <p className="font-mono text-[11px] text-[#7D95B0]">
              Ref: {error.digest}
            </p>
          ) : null}
          <button
            type="button"
            onClick={() => reset()}
            className="inline-flex min-h-[42px] items-center justify-center rounded-xl bg-[#0066CC] px-5 text-xs font-bold text-white hover:bg-[#0052A3]"
          >
            Reload Application
          </button>
        </main>
      </body>
    </html>
  );
}
