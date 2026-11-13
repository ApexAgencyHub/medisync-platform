import Link from "next/link";
import {
  Activity,
  Ambulance,
  ArrowUpRight,
  Building2,
  FlaskConical,
  Pill,
  ShieldAlert,
  Stethoscope,
  Users,
} from "lucide-react";

const ECOSYSTEM_PORTALS = [
  {
    role: "Patients & Caregivers",
    slice: "maps-dispatch / booking",
    href: "/booking",
    summary:
      "Locate clinics, hospitals, and 24/7 pharmacies on the map, book slots, and track live ambulance arrival.",
    icon: Users,
  },
  {
    role: "Doctors & Specialists",
    slice: "booking / clinical-records",
    href: "/clinical",
    summary:
      "Multi-clinic schedules, structured visit notes, digital lab orders, and QR-verified e-prescriptions.",
    icon: Stethoscope,
  },
  {
    role: "Clinics & Reception",
    slice: "foundation / booking",
    href: "/booking",
    summary:
      "Branch discovery profiles, real-time walk-in queue intake, vitals capture, and doctor roster shifts.",
    icon: Building2,
  },
  {
    role: "Hospitals & ERs",
    slice: "maps-dispatch",
    href: "/map",
    summary:
      "Live emergency wait times, ICU/bed availability broadcast, and pre-arrival ambulance handoffs.",
    icon: Activity,
  },
  {
    role: "Medical Transport Drivers",
    slice: "maps-dispatch",
    href: "/map",
    summary:
      "Redis Geo real-time GPS streams, nearest-unit emergency routing, and medical courier dispatches.",
    icon: Ambulance,
  },
  {
    role: "Pharmacies",
    slice: "clinical-pharmacy-labs",
    href: "/clinical",
    summary:
      "On-duty map status, instant QR e-prescription verification, dispensing logs, and home courier handoff.",
    icon: Pill,
  },
  {
    role: "Diagnostic Labs & Imaging",
    slice: "clinical-pharmacy-labs",
    href: "/clinical",
    summary:
      "Digital test orders, home sample pickup scheduling, and presigned direct scan/PDF uploads.",
    icon: FlaskConical,
  },
  {
    role: "Operations & License Admins",
    slice: "admin-ops",
    href: "/admin",
    summary:
      "Facility & medical license verification, manual dispatch overrides, disputes, and immutable audit logs.",
    icon: ShieldAlert,
  },
] as const;

export function EcosystemSlicesGrid() {
  return (
    <section aria-label="Medical Ecosystem Portals" className="space-y-4">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900">
            Eight-Actor Vertical Slice Architecture
          </h2>
          <p className="text-sm text-slate-600">
            Every portal shares `@medisync/contracts` and `@medisync/country-packs` across Web, iOS, and Android.
          </p>
        </div>
        <span className="font-mono-tabular text-xs font-medium text-teal-800">
          5 Vertical Slices Verified
        </span>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {ECOSYSTEM_PORTALS.map((portal) => {
          const Icon = portal.icon;
          return (
            <Link
              key={portal.role}
              href={portal.href}
              className="group flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5 transition-colors hover:border-teal-700/60 hover:bg-slate-50/40"
            >
              <div>
                <div className="flex items-center justify-between">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-50 text-teal-800">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <ArrowUpRight
                    className="h-4 w-4 text-slate-400 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-teal-800"
                    aria-hidden="true"
                  />
                </div>
                <h3 className="mt-3 text-sm font-semibold text-slate-900 group-hover:text-teal-900">
                  {portal.role}
                </h3>
                <p className="mt-1.5 text-xs leading-relaxed text-slate-600">
                  {portal.summary}
                </p>
              </div>
              <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-2.5 font-mono-tabular text-[11px] text-slate-500">
                <span>{portal.slice}</span>
                <span className="font-semibold text-teal-800">{portal.href}</span>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
