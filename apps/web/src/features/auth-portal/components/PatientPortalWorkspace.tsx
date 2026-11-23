"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ALLOWED_AVATAR_MIME_TYPES,
  isStaffWorkerRole,
  type AuthResponse,
  type AuthenticatedUser,
  type CountryPack,
} from "@medisync/contracts";
import {
  ArrowRight,
  Building2,
  CalendarCheck2,
  Camera,
  HeartHandshake,
  LogOut,
  MapPin,
  Pill,
  ShieldCheck,
  UserCheck,
} from "lucide-react";
import { getPrimaryWorkspaceForUser } from "@/shared/auth/role-capabilities";
import {
  clearStoredSession,
  readStoredSession,
  revokeClientSession,
  writeStoredSession,
} from "@/shared/auth/session-storage";
import { checkBackendOnline } from "@/shared/api/directory-client";
import {
  resolveActivePack,
  resolveEffectiveCountryCode,
} from "@/shared/config/deployment";
import {
  formatCountryDisplayName,
  formatRoleLabel,
} from "@/shared/i18n/human-labels";
import { useLocale } from "@/shared/i18n/locale-store";
import { EntityAvatar } from "@/shared/ui/EntityAvatar";
import {
  UiLinkButton,
  WorkspaceHeader,
  useToastSetter,
} from "@/shared/ui/primitives";
import { fetchMe } from "../api-client";
import { PORTAL_COPY } from "../portal-i18n";
import { AccountProfileSecurityCard } from "./AccountProfileSecurityCard";
import { AccountRecoveryPanel } from "./AccountRecoveryPanel";
import { PatientAuthPanel } from "./PatientAuthPanel";
import { uploadAvatarPhotoFile } from "./ProfileCredentialsPanel";

interface PatientPortalWorkspaceProps {
  packs: readonly CountryPack[];
  apiBaseUrl: string;
}

const CONSUMER_PORTAL_COPY = {
  en: {
    eyebrow: "Patient Access",
    title: "Sign In to MediSync Care",
    recoveryTitle: "Verify Contact & Reset Password",
    backToSignIn: "Back to Patient Sign In",
    staffNoticeTitle: "Medical staff or partner?",
    staffNoticeCta: "Go to MediSync Pro",
    signedInStaffNotice:
      "Signed in with a staff account. Manage credentials on MediSync Pro.",
    careCardTitle: "Quick Access",
    openProfileCta: "Open My Profile",
    shortcutPatient: "Health Folder & Safety",
    shortcutBooking: "Doctor Appointments",
    shortcutMap: "Live Care Map",
    shortcutPharmacy: "24/7 Duty Pharmacy & Parapharmacy",
    photoAlt: "MediSync sunlit clinical reception",
    photoCaption: "Licensed clinics, QR prescriptions, and dispatch.",
  },
  fr: {
    eyebrow: "Espace Patient",
    title: "Connexion à MediSync Soins",
    recoveryTitle: "Vérifier un contact ou réinitialiser",
    backToSignIn: "Retour à la connexion",
    staffNoticeTitle: "Professionnel de santé ou partenaire ?",
    staffNoticeCta: "Accéder à MediSync Pro",
    signedInStaffNotice:
      "Connecté en compte professionnel. Gérez vos pièces sur MediSync Pro.",
    careCardTitle: "Accès rapides",
    openProfileCta: "Ouvrir Mon Profil",
    shortcutPatient: "Dossier Santé & Sécurité",
    shortcutBooking: "Rendez-vous Médecin",
    shortcutMap: "Carte Médicale Live",
    shortcutPharmacy: "Pharmacies de Garde & Parapharmacie",
    photoAlt: "Réception clinique lumineuse MediSync",
    photoCaption: "Cliniques agréées, ordonnances QR et urgences.",
  },
  ar: {
    eyebrow: "دخول المرضى",
    title: "تسجيل الدخول إلى رعاية ميديسينك",
    recoveryTitle: "تأكيد الحساب واستعادة كلمة المرور",
    backToSignIn: "العودة لتسجيل الدخول",
    staffNoticeTitle: "طبيب أو مهني صحي أو سائق؟",
    staffNoticeCta: "الانتقال إلى MediSync Pro",
    signedInStaffNotice:
      "أنت مسجل بحساب مهني. أدر وثائقك عبر MediSync Pro.",
    careCardTitle: "روابط سريعة",
    openProfileCta: "فتح ملفي الشخصي",
    shortcutPatient: "ملف الطوارئ والسجل الطبي",
    shortcutBooking: "حجوزات الأطباء",
    shortcutMap: "الخريطة المباشرة",
    shortcutPharmacy: "صيدليات الحراسة وشبه الصيدلية",
    photoAlt: "استقبال عيادة طبية ميديسينك",
    photoCaption: "عيادات مرخصة، وصفات QR وإسعاف مباشر.",
  },
} as const;

/**
 * Consumer-exclusive authentication & account portal (`/portal`).
 * Strictly isolates Patient/Caregiver authentication from Staff/Partner flows.
 */
export function PatientPortalWorkspace({
  packs,
  apiBaseUrl,
}: PatientPortalWorkspaceProps) {
  const router = useRouter();
  const { locale, isRtl, t } = useLocale();
  const copy = PORTAL_COPY[locale];
  const consumer = CONSUMER_PORTAL_COPY[locale] ?? CONSUMER_PORTAL_COPY.en;
  const msg = copy.messages;
  const setStatusMessage = useToastSetter();

  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<AuthenticatedUser | null>(null);
  const [busy, setBusy] = useState(false);
  const [avatarProgress, setAvatarProgress] = useState<number | null>(null);
  const [showRecovery, setShowRecovery] = useState(false);
  const [showSwitchAuth, setShowSwitchAuth] = useState(false);

  const activePack = resolveActivePack(packs);
  const activeCountryCode = resolveEffectiveCountryCode(
    currentUser?.countryCode ?? activePack?.code,
  );
  const resolvedCountryPack =
    packs.find((item) => item.code === activeCountryCode) ?? activePack;

  useEffect(() => {
    const stored = readStoredSession();
    if (stored) {
      setSessionToken(stored.token);
      setCurrentUser(stored.user);
    }

    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("tab") === "recovery") {
        setShowRecovery(true);
        setShowSwitchAuth(true);
      }
    }

    let cancelled = false;
    checkBackendOnline().then(async (online) => {
      if (!online || cancelled || !stored) return;
      const meRes = await fetchMe(apiBaseUrl, stored.token);
      if (cancelled) return;

      if (!meRes.ok && meRes.status === 401) {
        clearStoredSession();
        setSessionToken(null);
        setCurrentUser(null);
        return;
      }

      if (meRes.ok) {
        setCurrentUser(meRes.data.user);
        writeStoredSession({ token: stored.token, user: meRes.data.user });
      }
    });

    return () => {
      cancelled = true;
    };
  }, [apiBaseUrl]);

  async function handleAuthenticatedConsumer(
    auth: AuthResponse,
    message: string,
  ) {
    writeStoredSession(auth);
    setSessionToken(auth.token);
    setCurrentUser(auth.user);
    setShowSwitchAuth(false);
    setStatusMessage({ tone: "success", text: message });
    router.push(getPrimaryWorkspaceForUser(auth.user, locale).href);
  }

  async function handleAvatarFileChange(file: File | null) {
    if (!file || !sessionToken || !currentUser) return;
    setBusy(true);
    const result = await uploadAvatarPhotoFile({
      apiBaseUrl,
      token: sessionToken,
      user: currentUser,
      file,
      invalidMimeMessage: msg.invalidAvatarMime,
      uploadFailedMessage: msg.avatarUploadFailed,
      onProgress: setAvatarProgress,
    });
    setBusy(false);

    if (!result.ok) {
      setStatusMessage({ tone: "error", text: result.errorText });
      return;
    }

    setCurrentUser(result.user);
    writeStoredSession({ token: sessionToken, user: result.user });
    setStatusMessage({ tone: "success", text: msg.avatarUploaded });
  }

  function handleSignOut() {
    revokeClientSession(apiBaseUrl);
    setSessionToken(null);
    setCurrentUser(null);
    setShowSwitchAuth(false);
    setStatusMessage({ tone: "info", text: msg.signedOutRevoked });
  }

  // Signed-out focused Patient / Caregiver Pure White Medical split gate
  if (!currentUser || !sessionToken || showSwitchAuth) {
    return (
      <div dir={isRtl ? "rtl" : "ltr"} className="mx-auto max-w-5xl py-2 sm:py-5">
        <div className="grid overflow-hidden rounded-2xl border border-[#D7E4F2] bg-white shadow-[0_14px_36px_-16px_rgba(15,36,62,0.12)] lg:grid-cols-12">
          {/* Pure White / Soft Clinical Sky Care Column */}
          <aside className="atlas-ice-grid flex flex-col justify-between border-b border-[#D7E4F2] text-[#0F243E] lg:col-span-5 lg:border-e lg:border-b-0">
            <div className="p-6 sm:p-7">
              <p className="inline-flex items-center gap-2 rounded-full border border-[#BFDBFE] bg-[#EBF4FF] px-3 py-1 text-xs font-semibold text-[#0052A3]">
                <span className="h-2 w-2 rounded-full bg-[#0066CC]" />
                <span>
                  {locale === "ar"
                    ? `بوابة رعاية المرضى · ${activeCountryCode}`
                    : locale === "fr"
                      ? `Portail Patient · ${activeCountryCode}`
                      : `Patient Care Portal · ${activeCountryCode}`}
                </span>
              </p>
              <p className="font-editorial mt-3.5 text-2xl font-bold leading-snug text-[#0F243E] sm:text-[28px]">
                {consumer.photoCaption}
              </p>
              <div className="mt-4 flex flex-wrap gap-1.5 text-[11px] font-semibold text-[#4A627D]">
                <span className="rounded-full border border-[#D7E4F2] bg-white px-2.5 py-1">
                  {locale === "ar"
                    ? "محمي بقانون CNDP 09-08"
                    : locale === "fr"
                      ? "Protégé Loi CNDP 09-08"
                      : "CNDP 09-08 Protected"}
                </span>
                <span className="rounded-full border border-[#D7E4F2] bg-white px-2.5 py-1">
                  {locale === "ar"
                    ? "رمز SMS · جوجل"
                    : locale === "fr"
                      ? "SMS OTP · Google"
                      : "Phone OTP · Google"}
                </span>
                <span className="rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-[#DC2626]">
                  {locale === "ar"
                    ? `الطوارئ ${resolvedCountryPack?.emergencyHotlines.ambulance ?? "141"}`
                    : locale === "fr"
                      ? `Urgences SAMU ${resolvedCountryPack?.emergencyHotlines.ambulance ?? "141"}`
                      : `Emergency ${resolvedCountryPack?.emergencyHotlines.ambulance ?? "141"}`}
                </span>
              </div>
            </div>

            <div className="relative hidden overflow-hidden border-t border-[#D7E4F2] lg:block">
              <img
                src="/media/facilities/clinic-interior.webp"
                alt={consumer.photoAlt}
                width={960}
                height={720}
                className="aspect-[16/10] w-full object-cover"
              />
            </div>
          </aside>

          {/* Pure White Consumer Auth Surface */}
          <div className="flex flex-col justify-between bg-white p-6 sm:p-8 lg:col-span-7">
            <div>
              {currentUser ? (
                <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#D7E4F2] bg-[#F3F8FD] px-3.5 py-2 text-xs">
                  <span className="font-medium text-[#475A70]">
                    {copy.signedInAs()} <strong className="text-[#0F243E]">{currentUser.fullName}</strong>
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setShowSwitchAuth(false);
                      setShowRecovery(false);
                    }}
                    className="inline-flex items-center gap-1 font-semibold text-[#0066CC] hover:underline"
                  >
                    <span aria-hidden="true" className="inline-block rtl:rotate-180">
                      ←
                    </span>
                    <span>{copy.backToProfile}</span>
                  </button>
                </div>
              ) : null}

              <div className="mb-5">
                <p className="font-mono-tabular text-[10.5px] font-semibold uppercase tracking-[0.12em] text-[#0066CC]">
                  {consumer.eyebrow}
                </p>
                <h1 className="font-editorial mt-1 text-3xl leading-[1.08] text-[#0F243E] sm:text-[34px]">
                  {showRecovery ? consumer.recoveryTitle : consumer.title}
                </h1>
              </div>

              {showRecovery ? (
                <AccountRecoveryPanel
                  apiBaseUrl={apiBaseUrl}
                  defaultPurpose="RESET_PASSWORD"
                  placeholderEmail="patient.ma@medisync.global"
                  busy={busy}
                  onBusyChange={setBusy}
                  onFeedback={(status) => setStatusMessage(status)}
                  onPasswordResetComplete={() => setShowRecovery(false)}
                  onContactVerified={(updated) => {
                    if (sessionToken && currentUser?.id === updated.id) {
                      setCurrentUser(updated);
                      writeStoredSession({ token: sessionToken, user: updated });
                    }
                  }}
                  backLabel={consumer.backToSignIn}
                  onBack={() => setShowRecovery(false)}
                />
              ) : (
                <PatientAuthPanel
                  apiBaseUrl={apiBaseUrl}
                  busy={busy}
                  setBusy={setBusy}
                  onAuthenticated={handleAuthenticatedConsumer}
                  onStatusMessage={(status) => setStatusMessage(status)}
                  onSwitchToRecovery={() => setShowRecovery(true)}
                />
              )}
            </div>

            {/* Clean MediSync Pro Switcher */}
            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-[#D7E4F2] pt-4">
              <span className="text-xs font-medium text-[#667382]">
                {consumer.staffNoticeTitle}
              </span>
              <UiLinkButton
                href="/pro"
                variant="outline"
                size="sm"
                className="shrink-0"
              >
                <Building2 className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{consumer.staffNoticeCta}</span>
                <ArrowRight
                  className="h-3.5 w-3.5 rtl:rotate-180"
                  aria-hidden="true"
                />
              </UiLinkButton>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const staffSignedIn = isStaffWorkerRole(currentUser.role);

  return (
    <div dir={isRtl ? "rtl" : "ltr"} className="space-y-4">
      <WorkspaceHeader
        title={t("portal.heading")}
        prefixMeta={<span>{copy.careRegionPrefix}</span>}
        countryCode={activeCountryCode}
        countryName={formatCountryDisplayName(
          activeCountryCode,
          resolvedCountryPack?.name ?? activeCountryCode,
          locale,
        )}
        currencyCode={resolvedCountryPack?.currencyCode ?? activeCountryCode}
        emergencyHotline={
          resolvedCountryPack?.emergencyHotlines.ambulance ?? ""
        }
        user={currentUser}
        hideGuestSignIn
        portalHref={staffSignedIn ? "/pro" : "/portal"}
        onSignOut={handleSignOut}
      />

      {staffSignedIn ? (
        <div className="flex flex-col justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50/75 px-5 py-4 sm:flex-row sm:items-center">
          <div className="flex items-start gap-2.5">
            <ShieldCheck
              className="mt-0.5 h-5 w-5 shrink-0 text-[#0066CC]"
              aria-hidden="true"
            />
            <p className="text-xs font-medium text-emerald-950 sm:text-sm">
              {consumer.signedInStaffNotice}
            </p>
          </div>
          <UiLinkButton href="/pro" variant="primary" size="sm" pill className="shrink-0">
            <span>{consumer.staffNoticeCta}</span>
            <ArrowRight className="h-3.5 w-3.5 rtl:rotate-180" aria-hidden="true" />
          </UiLinkButton>
        </div>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-12">
        <section className="min-w-0 rounded-2xl border border-[#D7E4F2] bg-white p-5 sm:p-6 lg:col-span-7">
          <AccountProfileSecurityCard
            apiBaseUrl={apiBaseUrl}
            token={sessionToken}
            user={currentUser}
            facilities={[]}
            onSessionUpdated={(auth, msgText) => {
              writeStoredSession(auth);
              setSessionToken(auth.token);
              setCurrentUser(auth.user);
              if (msgText) setStatusMessage({ tone: "success", text: msgText });
            }}
            onUserUpdated={(updatedUser, msgText) => {
              writeStoredSession({ token: sessionToken, user: updatedUser });
              setCurrentUser(updatedUser);
              if (msgText) setStatusMessage({ tone: "success", text: msgText });
            }}
            onOpenSwitchAccount={() => {
              if (staffSignedIn) {
                router.push("/pro");
              } else {
                setShowSwitchAuth(true);
              }
            }}
            onSignOut={handleSignOut}
          />
        </section>

        <aside className="min-w-0 space-y-4 lg:col-span-5">
          <section className="rounded-2xl border border-[#D7E4F2] bg-white p-5 sm:p-6">
            <div className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-3">
                <EntityAvatar
                  name={currentUser.fullName}
                  role={currentUser.role}
                  avatarUrl={currentUser.avatarUrl}
                  size="lg"
                />
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-slate-950">
                    <bdi dir="auto">{currentUser.fullName}</bdi>
                  </p>
                  <p className="text-xs font-semibold text-[#0066CC]">
                    {formatRoleLabel(currentUser.role, locale)} · {currentUser.countryCode}
                  </p>
                </div>
              </div>

              <label className="inline-flex min-h-[34px] shrink-0 cursor-pointer items-center gap-1.5 rounded-xl bg-[#F3F8FD] border border-[#D7E4F2] px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-emerald-50 hover:text-[#0066CC]">
                <Camera className="h-3.5 w-3.5" aria-hidden="true" />
                <span>
                  {avatarProgress !== null ? `${avatarProgress}%` : copy.aside.photoBtn}
                </span>
                <input
                  type="file"
                  accept={ALLOWED_AVATAR_MIME_TYPES.join(",")}
                  disabled={busy}
                  className="sr-only"
                  onChange={(e) =>
                    void handleAvatarFileChange(e.target.files?.[0] ?? null)
                  }
                />
              </label>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <UiLinkButton href="/profile" variant="primary" size="sm" pill>
                <UserCheck className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{consumer.openProfileCta}</span>
              </UiLinkButton>
              <button
                type="button"
                onClick={handleSignOut}
                className="inline-flex h-8 items-center gap-1.5 rounded-full bg-slate-100 px-3 text-xs font-semibold text-slate-700 transition hover:bg-rose-50 hover:text-rose-700"
              >
                <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{copy.aside.signOutBtn}</span>
              </button>
            </div>
          </section>

          <section className="rounded-2xl border border-[#D7E4F2] bg-white p-5 sm:p-6">
            <h2 className="text-sm font-bold text-[#0F243E]">
              {consumer.careCardTitle}
            </h2>
            <div className="mt-4 grid gap-2">
              <Link
                href="/patient"
                className="flex items-center justify-between rounded-lg border border-[#D7E4F2] bg-[#F3F8FD] px-3.5 py-2.5 text-xs font-semibold text-[#0F243E] transition hover:bg-white hover:text-[#0066CC]"
              >
                <span className="inline-flex items-center gap-2">
                  <HeartHandshake className="h-4 w-4 text-[#0066CC]" aria-hidden="true" />
                  <span>{consumer.shortcutPatient}</span>
                </span>
                <ArrowRight className="h-3.5 w-3.5 rtl:rotate-180" aria-hidden="true" />
              </Link>
              <Link
                href="/booking"
                className="flex items-center justify-between rounded-lg border border-[#D7E4F2] bg-[#F3F8FD] px-3.5 py-2.5 text-xs font-semibold text-[#0F243E] transition hover:bg-white hover:text-[#0066CC]"
              >
                <span className="inline-flex items-center gap-2">
                  <CalendarCheck2 className="h-4 w-4 text-[#0066CC]" aria-hidden="true" />
                  <span>{consumer.shortcutBooking}</span>
                </span>
                <ArrowRight className="h-3.5 w-3.5 rtl:rotate-180" aria-hidden="true" />
              </Link>
              <Link
                href="/map"
                className="flex items-center justify-between rounded-lg border border-[#D7E4F2] bg-[#F3F8FD] px-3.5 py-2.5 text-xs font-semibold text-[#0F243E] transition hover:bg-white hover:text-[#0066CC]"
              >
                <span className="inline-flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-[#0066CC]" aria-hidden="true" />
                  <span>{consumer.shortcutMap}</span>
                </span>
                <ArrowRight className="h-3.5 w-3.5 rtl:rotate-180" aria-hidden="true" />
              </Link>
              <Link
                href="/pharmacy"
                className="flex items-center justify-between rounded-lg border border-[#D7E4F2] bg-[#F3F8FD] px-3.5 py-2.5 text-xs font-semibold text-[#0F243E] transition hover:bg-white hover:text-[#0066CC]"
              >
                <span className="inline-flex items-center gap-2">
                  <Pill className="h-4 w-4 text-[#0066CC]" aria-hidden="true" />
                  <span>{consumer.shortcutPharmacy}</span>
                </span>
                <ArrowRight className="h-3.5 w-3.5 rtl:rotate-180" aria-hidden="true" />
              </Link>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
