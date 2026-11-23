import Link from "next/link";
import { Calendar, Compass, Home, ShieldCheck } from "lucide-react";

export default function NotFound() {
  return (
    <main className="flex min-h-[75vh] items-center justify-center px-4 py-12">
      <section className="w-full max-w-xl space-y-5 rounded-2xl border border-[#D7E4F2] bg-white p-8 text-center shadow-[0_14px_34px_-12px_rgba(15,36,62,0.12)]">
        <p className="font-mono-tabular text-xs font-bold uppercase tracking-widest text-[#0066CC]">
          404 · Page Not Found
        </p>
        <h1 className="font-editorial text-2xl font-extrabold text-[#0F243E]">
          This care route doesn&apos;t exist
        </h1>
        <p className="text-xs leading-relaxed text-[#556E89]">
          Choose a workspace below to continue navigating MediSync Global.
        </p>
        <div className="grid grid-cols-2 gap-2.5 pt-2 sm:grid-cols-4">
          <Link
            href="/"
            className="inline-flex min-h-[42px] items-center justify-center gap-1.5 whitespace-nowrap rounded-xl bg-[#0066CC] px-3 text-xs font-bold text-white transition hover:bg-[#0052A3]"
          >
            <Home className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>Home</span>
          </Link>
          <Link
            href="/map"
            className="inline-flex min-h-[42px] items-center justify-center gap-1.5 whitespace-nowrap rounded-xl border border-[#CBDDF0] bg-[#F8FBFE] px-3 text-xs font-semibold text-[#0F243E] transition hover:bg-white hover:text-[#0066CC]"
          >
            <Compass className="h-3.5 w-3.5 shrink-0 text-[#0066CC]" aria-hidden="true" />
            <span>Live Map</span>
          </Link>
          <Link
            href="/booking"
            className="inline-flex min-h-[42px] items-center justify-center gap-1.5 whitespace-nowrap rounded-xl border border-[#CBDDF0] bg-[#F8FBFE] px-3 text-xs font-semibold text-[#0F243E] transition hover:bg-white hover:text-[#0066CC]"
          >
            <Calendar className="h-3.5 w-3.5 shrink-0 text-[#0F9D88]" aria-hidden="true" />
            <span>Book Visit</span>
          </Link>
          <Link
            href="/pro"
            className="inline-flex min-h-[42px] items-center justify-center gap-1.5 whitespace-nowrap rounded-xl border border-[#CBDDF0] bg-[#F8FBFE] px-3 text-xs font-semibold text-[#0F243E] transition hover:bg-white hover:text-[#0066CC]"
          >
            <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-[#0066CC]" aria-hidden="true" />
            <span>Staff Portal</span>
          </Link>
        </div>
      </section>
    </main>
  );
}
