"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  computeVisitCountdown,
  type AppointmentSummary,
  type AuthResponse,
  type ClinicalMediaObjectSummary,
  type CountryPack,
  type DispatchRequestSummary,
  type LabOrderSummary,
  type PrescriptionSummary,
  type VisitCountdownTone,
  type VisitNoteSummary,
} from "@medisync/contracts";
import { fetchAppointments } from "@/features/booking";
import {
  fetchClinicalMedia,
  fetchLabOrders,
  fetchPrescriptions,
  fetchVisitNotes,
} from "@/features/clinical-workspace";
import { listDispatchRequests } from "@/features/maps-dispatch";
import { checkBackendOnline } from "@/shared/api/directory-client";
import {
  clearStoredSession,
  readStoredSession,
} from "@/shared/auth/session-storage";
import {
  formatClinicalFileType,
  formatDispatchStatus,
  formatVisitMode,
} from "@/shared/i18n/human-labels";
import { useLocale } from "@/shared/i18n/locale-store";
import {
  removeGuestActivityPass,
  useBookmarkedProviders,
  useGuestActivityPasses,
} from "@/shared/patient/patient-local-store";
import { BookmarkButton } from "@/shared/ui/BookmarkButton";
import { EntityAvatar } from "@/shared/ui/EntityAvatar";
import { useImageLightbox } from "@/shared/ui/ImageLightboxProvider";
import { QrPrescriptionCard } from "@/shared/ui/QrPrescriptionCard";
import {
  RegionTabs,
  SessionAccountBar,
  StatusBanner,
  UiBadge,
  UiButton,
  type RegionTabOption,
  type UiBadgeTone,
} from "@/shared/ui/primitives";
import {
  Ambulance,
  BookmarkCheck,
  CalendarClock,
  FileText,
  FlaskConical,
  HeartHandshake,
  Lock,
  MapPin,
  Pill,
  Stethoscope,
  Trash2,
  Users,
} from "lucide-react";

interface PatientHubWorkspaceProps {
  packs: readonly CountryPack[];
  apiBaseUrl: string;
}

const COUNTDOWN_BADGE_TONE: Record<VisitCountdownTone, UiBadgeTone> = {
  urgent: "red",
  upcoming: "amber",
  future: "teal",
  past: "slate",
};

const QUICK_CARE_TILES = [
  {
    href: "/map",
    title: "Live Map & Fast Book",
    caption: "See nearby drivers, doctors & clinics",
    icon: MapPin,
    accent: "text-teal-800 bg-teal-50 border-teal-200",
  },
  {
    href: "/booking",
    title: "Book Doctor or Nurse",
    caption: "Pick an open clinic or home slot",
    icon: Stethoscope,
    accent: "text-emerald-800 bg-emerald-50 border-emerald-200",
  },
  {
    href: "/profiles",
    title: "Public Profiles",
    caption: "Compare photos, specialties & centers",
    icon: Users,
    accent: "text-sky-800 bg-sky-50 border-sky-200",
  },
  {
    href: "/pharmacy",
    title: "Pharmacy & Refills",
    caption: "Order medicines & track delivery",
    icon: Pill,
    accent: "text-amber-800 bg-amber-50 border-amber-200",
  },
] as const;

function resolveBookmarkAvatarRole(
  kind: "DOCTOR" | "NURSE" | "CLINIC" | "HOSPITAL" | "PHARMACY" | "LAB",
): "DOCTOR" | "CLINIC_STAFF" | "PHARMACIST" | "LAB_TECH" {
  switch (kind) {
    case "PHARMACY":
      return "PHARMACIST";
    case "LAB":
      return "LAB_TECH";
    case "CLINIC":
    case "HOSPITAL":
      return "CLINIC_STAFF";
    default:
      return "DOCTOR";
  }
}

/**
 * Personal Patient Care Hub uniting saved doctors/clinics, upcoming visit & transport
 * deadlines, and signed-in clinical documents/prescriptions without requiring signup
 * for browsing or local bookmarks.
 */
export function PatientHubWorkspace({
  packs,
  apiBaseUrl,
}: PatientHubWorkspaceProps) {
  const { t } = useLocale();
  const { openImage } = useImageLightbox();

  const defaultCountry = packs[0]?.code ?? "MA";
  const [selectedCountry, setSelectedCountry] = useState<string>(defaultCountry);
  const [session, setSession] = useState<AuthResponse | null>(null);
  const [apiOnline, setApiOnline] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [banner, setBanner] = useState<{
    tone: "info" | "success" | "warning" | "error";
    text: string;
  } | null>(null);

  const [appointments, setAppointments] = useState<AppointmentSummary[]>([]);
  const [dispatches, setDispatches] = useState<DispatchRequestSummary[]>([]);
  const [visitNotes, setVisitNotes] = useState<VisitNoteSummary[]>([]);
  const [prescriptions, setPrescriptions] = useState<PrescriptionSummary[]>([]);
  const [labOrders, setLabOrders] = useState<LabOrderSummary[]>([]);
  const [mediaFiles, setMediaFiles] = useState<ClinicalMediaObjectSummary[]>(
    [],
  );

  const bookmarks = useBookmarkedProviders(selectedCountry);
  const guestPasses = useGuestActivityPasses(selectedCountry);

  const regionOptions = useMemo<readonly RegionTabOption[]>(
    () =>
      packs.map((pack) => ({
        code: pack.code,
        label: `${pack.code} · ${pack.name}`,
      })),
    [packs],
  );

  useEffect(() => {
    const stored = readStoredSession();
    if (stored) {
      setSession(stored);
      setSelectedCountry(stored.user.countryCode);
    }
  }, []);

  useEffect(() => {
    let active = true;
    async function loadPatientData() {
      const online = await checkBackendOnline();
      if (!active) return;
      setApiOnline(online);

      if (!online || !session?.token) {
        setAppointments([]);
        setDispatches([]);
        setVisitNotes([]);
        setPrescriptions([]);
        setLabOrders([]);
        setMediaFiles([]);
        return;
      }

      setLoading(true);
      const token = session.token;
      const [
        apptRes,
        dispatchRes,
        notesRes,
        rxRes,
        labsRes,
        mediaRes,
      ] = await Promise.all([
        fetchAppointments(apiBaseUrl, token, selectedCountry),
        listDispatchRequests(apiBaseUrl, token, selectedCountry),
        fetchVisitNotes(apiBaseUrl, token, selectedCountry),
        fetchPrescriptions(apiBaseUrl, token, selectedCountry),
        fetchLabOrders(apiBaseUrl, token, selectedCountry),
        fetchClinicalMedia(apiBaseUrl, token, selectedCountry),
      ]);
      if (!active) return;
      setLoading(false);

      if (apptRes.ok) setAppointments(apptRes.data.appointments);
      if (dispatchRes.ok) setDispatches(dispatchRes.data.dispatches);
      if (notesRes.ok) setVisitNotes(notesRes.data.visitNotes);
      if (rxRes.ok) setPrescriptions(rxRes.data.prescriptions);
      if (labsRes.ok) setLabOrders(labsRes.data.labOrders);
      if (mediaRes.ok) setMediaFiles(mediaRes.data.mediaObjects);

      if (!apptRes.ok && apptRes.status === 401) {
        clearStoredSession();
        setSession(null);
        setBanner({
          tone: "warning",
          text: "Your sign-in session expired. Local bookmarks and guest passes remain saved on this device.",
        });
      }
    }
    void loadPatientData();
    return () => {
      active = false;
    };
  }, [apiBaseUrl, selectedCountry, session?.token]);

  const sortedAppointments = useMemo(() => {
    return [...appointments].sort((a, b) => {
      const aInfo = computeVisitCountdown(a.slotStartIso);
      const bInfo = computeVisitCountdown(b.slotStartIso);
      if (aInfo.isPast !== bInfo.isPast) {
        return aInfo.isPast ? 1 : -1;
      }
      return Date.parse(a.slotStartIso) - Date.parse(b.slotStartIso);
    });
  }, [appointments]);

  function handleSignOut() {
    clearStoredSession();
    setSession(null);
    setBanner({
      tone: "info",
      text: "Signed out cleanly. Your saved doctors and local guest passes remain stored in this browser.",
    });
  }

  return (
    <div className="space-y-6">
      {/* Top Hero & Region Bar */}
      <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="inline-flex items-center gap-1.5 font-mono-tabular text-xs font-semibold uppercase tracking-wider text-teal-800">
              <HeartHandshake className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{t("patient.eyebrow")}</span>
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
              {t("patient.heading")}
            </h1>
            <p className="mt-1 max-w-3xl text-sm text-slate-600">
              {t("patient.subtitle")}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link href="/map">
              <UiButton size="sm">1-Tap Fast Book Ride</UiButton>
            </Link>
            <Link href="/booking">
              <UiButton size="sm" variant="secondary">
                Reserve Visit Slot
              </UiButton>
            </Link>
          </div>
        </div>

        <RegionTabs
          value={selectedCountry}
          onChange={setSelectedCountry}
          options={regionOptions}
        />

        <SessionAccountBar
          session={session}
          onSignOut={handleSignOut}
          prompt="Using Guest Care Mode: save doctors, view visit passes, and fast-book rides without an account. Sign in to unlock private clinical records."
        />

        {banner ? (
          <StatusBanner tone={banner.tone} message={banner.text} />
        ) : null}
      </section>

      {/* Simple Icon-Driven Portal Tiles for Any Literacy Level */}
      <section aria-label="Quick Care Access">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {QUICK_CARE_TILES.map((tile) => {
            const Icon = tile.icon;
            return (
              <Link
                key={tile.href}
                href={tile.href}
                className="group flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs transition-colors hover:border-teal-700 hover:bg-teal-50/30"
              >
                <span
                  className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border ${tile.accent}`}
                >
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-slate-900 group-hover:text-teal-900">
                    {tile.title}
                  </p>
                  <p className="truncate text-xs text-slate-600">
                    {tile.caption}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Saved Doctors / Facilities + Visit Deadlines */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Bookmarked Doctors, Nurses & Centers */}
        <section className="min-w-0 space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs lg:col-span-6">
          <div className="flex items-center justify-between gap-2 border-b border-slate-200 pb-3">
            <div className="flex items-center gap-2">
              <BookmarkCheck
                className="h-4 w-4 text-amber-600"
                aria-hidden="true"
              />
              <h2 className="text-base font-bold text-slate-900">
                Saved Doctors, Nurses & Centers
              </h2>
            </div>
            <UiBadge tone="amber">{bookmarks.length} saved</UiBadge>
          </div>

          {bookmarks.length === 0 ? (
            <div className="space-y-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5 text-center">
              <p className="text-xs font-semibold text-slate-800">
                No providers bookmarked in {selectedCountry} yet.
              </p>
              <p className="text-xs text-slate-600">
                Tap the Save button on any doctor, home nurse, clinic, or pharmacy card to pin them here for quick rebooking.
              </p>
              <div className="flex flex-wrap justify-center gap-2 pt-1">
                <Link href="/profiles">
                  <UiButton size="sm">Browse Public Profiles</UiButton>
                </Link>
                <Link href="/map">
                  <UiButton size="sm" variant="secondary">
                    Explore Live Map
                  </UiButton>
                </Link>
              </div>
            </div>
          ) : (
            <ul className="space-y-3">
              {bookmarks.map((item) => (
                <li
                  key={item.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3.5"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <EntityAvatar
                      name={item.title}
                      role={resolveBookmarkAvatarRole(item.kind)}
                      subtitle={item.subtitle}
                      size="sm"
                    />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <p className="truncate text-sm font-bold text-slate-900">
                          <bdi dir="auto">{item.title}</bdi>
                        </p>
                        <UiBadge tone="slate">{item.kind}</UiBadge>
                      </div>
                      <p className="mt-0.5 truncate text-xs text-slate-600">
                        <bdi dir="auto">{item.subtitle}</bdi>
                      </p>
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    <Link href={item.href}>
                      <UiButton size="sm">Open</UiButton>
                    </Link>
                    <BookmarkButton
                      compact
                      entry={{
                        id: item.id,
                        kind: item.kind,
                        countryCode: item.countryCode,
                        title: item.title,
                        subtitle: item.subtitle,
                        ...(item.facilityId ? { facilityId: item.facilityId } : {}),
                        ...(item.facilityName
                          ? { facilityName: item.facilityName }
                          : {}),
                        href: item.href,
                      }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Visit Deadlines & Active Ride Passes */}
        <section className="min-w-0 space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs lg:col-span-6">
          <div className="flex items-center justify-between gap-2 border-b border-slate-200 pb-3">
            <div className="flex items-center gap-2">
              <CalendarClock
                className="h-4 w-4 text-teal-800"
                aria-hidden="true"
              />
              <h2 className="text-base font-bold text-slate-900">
                Upcoming Visit Deadlines & Rides
              </h2>
            </div>
            <UiBadge tone="teal">
              {sortedAppointments.length + dispatches.length + guestPasses.length}{" "}
              tracked
            </UiBadge>
          </div>

          {sortedAppointments.length === 0 &&
          dispatches.length === 0 &&
          guestPasses.length === 0 ? (
            <div className="space-y-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5 text-center">
              <p className="text-xs font-semibold text-slate-800">
                No active visits or ride alerts in {selectedCountry}.
              </p>
              <p className="text-xs text-slate-600">
                Reserve a time window with a specialist or trigger a 1-Tap Fast Book pickup from the map.
              </p>
              <div className="flex flex-wrap justify-center gap-2 pt-1">
                <Link href="/booking">
                  <UiButton size="sm">Reserve Visit</UiButton>
                </Link>
                <Link href="/map">
                  <UiButton size="sm" variant="secondary">
                    1-Tap Fast Book
                  </UiButton>
                </Link>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Confirmed Appointments with Time-Remaining Countdown */}
              {sortedAppointments.map((appt) => {
                const countdown = computeVisitCountdown(appt.slotStartIso);
                return (
                  <div
                    key={appt.id}
                    className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-xs"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-mono-tabular font-bold text-slate-900">
                        {appt.slotStartIso.slice(0, 16).replace("T", " ")}
                      </span>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <UiBadge tone={COUNTDOWN_BADGE_TONE[countdown.tone]}>
                          {countdown.label}
                        </UiBadge>
                        <UiBadge tone="slate">{appt.status}</UiBadge>
                      </div>
                    </div>
                    <p className="mt-1.5 font-semibold text-slate-900">
                      <bdi dir="auto">{appt.doctorName}</bdi> ·{" "}
                      <bdi dir="auto">{appt.facilityName}</bdi>
                    </p>
                    <p className="mt-0.5 text-slate-600">
                      {formatVisitMode(appt.visitMode)}
                      {appt.reason ? ` · ${appt.reason}` : ""}
                    </p>
                  </div>
                );
              })}

              {/* Real-Time Backend Dispatch Alerts */}
              {dispatches.map((ride) => (
                <div
                  key={ride.id}
                  className="rounded-xl border border-teal-200 bg-teal-50/40 p-3.5 text-xs"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 font-bold text-slate-900">
                      <Ambulance
                        className="h-3.5 w-3.5 text-teal-800"
                        aria-hidden="true"
                      />
                      <span>Medical Pickup Request</span>
                    </span>
                    <UiBadge tone="teal">
                      {formatDispatchStatus(ride.status)}
                    </UiBadge>
                  </div>
                  <p className="mt-1 text-slate-700">
                    <bdi dir="auto">{ride.pickupAddress}</bdi>
                  </p>
                </div>
              ))}

              {/* Guest Local Passes (Offline / No-Account Mode) */}
              {guestPasses.map((pass) => {
                const countdown = computeVisitCountdown(pass.scheduledAtIso);
                return (
                  <div
                    key={pass.id}
                    className="rounded-xl border border-amber-200 bg-amber-50/50 p-3.5 text-xs"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-bold text-slate-900">
                        {pass.title} ·{" "}
                        <span className="font-mono-tabular text-amber-900">
                          {pass.trackingCode}
                        </span>
                      </span>
                      <div className="flex items-center gap-1.5">
                        <UiBadge tone={COUNTDOWN_BADGE_TONE[countdown.tone]}>
                          {pass.statusLabel}
                        </UiBadge>
                        <button
                          type="button"
                          onClick={() => removeGuestActivityPass(pass.id)}
                          aria-label={`Remove tracking pass ${pass.trackingCode}`}
                          className="rounded p-1 text-slate-500 hover:bg-white hover:text-red-700"
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                    <p className="mt-1 text-slate-700">
                      <bdi dir="auto">{pass.landmarkOrFacility}</bdi>
                      {pass.phoneContact ? ` · ${pass.phoneContact}` : ""}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {/* Doctor-Shared Documents, Lab Results, Notes & QR Prescriptions */}
      <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-teal-800" aria-hidden="true" />
            <h2 className="text-base font-bold text-slate-900">
              Doctor Documents, Visit Notes, Labs & QR Prescriptions
            </h2>
          </div>
          {session ? (
            <UiBadge tone="emerald">
              Encrypted Access · {session.user.fullName}
            </UiBadge>
          ) : (
            <UiBadge tone="slate">Sign-In Required for Private Records</UiBadge>
          )}
        </div>

        {!session ? (
          <div className="flex flex-col items-start justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-5 sm:flex-row sm:items-center">
            <div className="flex items-start gap-3">
              <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-teal-800">
                <Lock className="h-5 w-5" aria-hidden="true" />
              </span>
              <div className="space-y-1">
                <p className="text-sm font-bold text-slate-900">
                  Your private clinical documents stay protected
                </p>
                <p className="max-w-2xl text-xs text-slate-600">
                  Browsing the map, fast-booking drivers, and saving doctors work without an account. Sign in on the Care Portal whenever you want to inspect doctor consultation notes, lab PDFs, imaging scans, and scannable QR prescriptions.
                </p>
              </div>
            </div>
            <Link href="/portal" className="shrink-0">
              <UiButton size="sm">Unlock Clinical Documents</UiButton>
            </Link>
          </div>
        ) : !apiOnline ? (
          <StatusBanner
            tone="warning"
            message="Care backend is currently offline. Connect the local API service to load synced consultation notes and laboratory files."
          />
        ) : loading ? (
          <p className="text-xs font-medium text-slate-600">
            Loading consultation notes, prescriptions, lab orders, and shared documents...
          </p>
        ) : (
          <div className="grid gap-5 lg:grid-cols-2">
            {/* Prescriptions + Shared Scans */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Digital QR Prescriptions ({prescriptions.length})
              </h3>
              {prescriptions.length === 0 ? (
                <p className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-xs text-slate-600">
                  No prescriptions recorded in {selectedCountry} yet.
                </p>
              ) : (
                <div className="space-y-2.5">
                  {prescriptions.map((rx) => (
                    <QrPrescriptionCard key={rx.id} prescription={rx} />
                  ))}
                </div>
              )}

              <h3 className="pt-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                Uploaded Lab Reports & Medical Scans ({mediaFiles.length})
              </h3>
              {mediaFiles.length === 0 ? (
                <p className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-xs text-slate-600">
                  No imaging scans or PDF reports uploaded for this region.
                </p>
              ) : (
                <ul className="space-y-2">
                  {mediaFiles.map((file) => (
                    <li
                      key={file.id}
                      className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-bold text-slate-900">
                          <bdi dir="auto">{file.fileName}</bdi>
                        </p>
                        <p className="text-slate-600">
                          {formatClinicalFileType(file.mimeType)} ·{" "}
                          {file.createdAtIso.slice(0, 10)}
                        </p>
                      </div>
                      {file.downloadUrl && file.mimeType.startsWith("image/") ? (
                        <UiButton
                          size="sm"
                          variant="secondary"
                          onClick={() =>
                            openImage({
                              src: file.downloadUrl!,
                              downloadUrl: file.downloadUrl,
                              mimeType: file.mimeType,
                              alt: file.fileName,
                              title: file.fileName,
                              subtitle: formatClinicalFileType(file.mimeType),
                            })
                          }
                        >
                          Inspect Photo
                        </UiButton>
                      ) : file.downloadUrl ? (
                        <a
                          href={file.downloadUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex min-h-[34px] items-center rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 hover:border-teal-700"
                        >
                          Open Document
                        </a>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Doctor Consultation Notes + Lab Orders */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Consultation Notes ({visitNotes.length})
              </h3>
              {visitNotes.length === 0 ? (
                <p className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-xs text-slate-600">
                  No doctor visit notes found in {selectedCountry}.
                </p>
              ) : (
                <ul className="space-y-2">
                  {visitNotes.map((note) => (
                    <li
                      key={note.id}
                      className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-xs"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-slate-900">
                          <bdi dir="auto">{note.doctorName}</bdi>{" "}
                          {note.icd10Codes.length > 0 ? (
                            <span className="font-mono-tabular font-normal text-teal-800">
                              ({note.icd10Codes.join(", ")})
                            </span>
                          ) : null}
                        </span>
                        <span className="font-mono-tabular text-[11px] text-slate-500">
                          {note.createdAtIso.slice(0, 10)}
                        </span>
                      </div>
                      <p className="mt-1 text-slate-700">
                        <strong className="font-semibold text-slate-900">Assessment:</strong>{" "}
                        <bdi dir="auto">{note.assessment}</bdi>
                      </p>
                      <p className="mt-1 text-slate-600">
                        <strong className="font-semibold text-slate-900">Plan:</strong>{" "}
                        <bdi dir="auto">{note.plan}</bdi>
                      </p>
                    </li>
                  ))}
                </ul>
              )}

              <h3 className="pt-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                Diagnostic Lab Orders ({labOrders.length})
              </h3>
              {labOrders.length === 0 ? (
                <p className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-xs text-slate-600">
                  No active diagnostic lab orders in {selectedCountry}.
                </p>
              ) : (
                <ul className="space-y-2">
                  {labOrders.map((lab) => (
                    <li
                      key={lab.id}
                      className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs"
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <FlaskConical
                          className="h-4 w-4 shrink-0 text-teal-800"
                          aria-hidden="true"
                        />
                        <div className="min-w-0">
                          <p className="truncate font-bold text-slate-900">
                            <bdi dir="auto">{lab.panelName}</bdi>
                          </p>
                          <p className="truncate text-slate-600">
                            {lab.urgency} · {lab.createdAtIso.slice(0, 10)}
                          </p>
                        </div>
                      </div>
                      <UiBadge tone="teal">{lab.status}</UiBadge>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
