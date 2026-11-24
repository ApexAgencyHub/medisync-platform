"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ALLOWED_AVATAR_MIME_TYPES,
  isStaffWorkerRole,
  type AuthResponse,
  type CountryPack,
  type FacilitySummary,
  type UserMediaDocument,
} from "@medisync/contracts";
import {
  ArrowRight,
  Camera,
  CheckCircle2,
  Clock3,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  UserCheck,
  Users,
} from "lucide-react";
import { listMyUserMedia } from "@/features/media-certifications";
import { getPrimaryWorkspaceForUser } from "@/shared/auth/role-capabilities";
import {
  clearStoredSession,
  readStoredSession,
  revokeClientSession,
  SESSION_CHANGE_EVENT,
  writeStoredSession,
} from "@/shared/auth/session-storage";
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
import { useImageLightbox } from "@/shared/ui/ImageLightboxProvider";
import {
  UiButton,
  UiLinkButton,
  WorkspaceHeader,
  useToastSetter,
} from "@/shared/ui/primitives";
import { isPendingStaffVerification } from "@/shared/ui/VerificationGateNotice";
import { fetchMe, listFacilities } from "../api-client";
import { getPortalOnboardingSummary, PORTAL_COPY } from "../portal-i18n";
import { AccountProfileSecurityCard } from "./AccountProfileSecurityCard";
import {
  ProfileCredentialsPanel,
  uploadAvatarPhotoFile,
} from "./ProfileCredentialsPanel";
import { ComplianceRightsCard } from "./ComplianceRightsCard";

interface AuthenticatedProfileWorkspaceProps {
  packs: readonly CountryPack[];
  apiBaseUrl: string;
}

const PROFILE_COPY = {
  en: {
    heading: "My Profile & Account",
    careRegionPrefix: "Care Region",
    guestEyebrow: "Authenticated Member Profile",
    guestTitle: "Sign in to open your MediSync profile",
    guestSubtitle:
      "Manage your verified contact details, profile photo, security password, active sessions, and professional licenses in one place.",
    guestPrimaryCta: "Sign In or Create Account",
    guestSecondaryCta: "Back to Overview",
    guestProtectedBadge: "Protected Health Account",
    guestPrivacyLabel: "Privacy",
    guestPrivacyValue: "CNDP Law 09-08",
    guestSecurityLabel: "Security",
    guestSecurityValue: "Encrypted Sessions",
    guestRegionLabel: "Region",
    guestEmergencyShort: "Emergency 141",
    guestProLink: "Staff & Partner Portal",
    signOutBtn: "Sign Out",
    verifiedStaffTag: "Verified Staff",
    pendingStaffTag: "Pending Admin Verification",
    activeMemberTag: "Active Account",
    emailVerified: "Email verified",
    emailUnverified: "Email unverified",
    phoneVerified: "Phone verified",
    phoneUnverified: "Phone unverified",
    credentialsTitle: "Credentials & Verification",
    credentialsSubtitle:
      "Upload valid professional licenses so operations administrators can keep your clinical or fleet clearance active.",
    careShortcutsTitle: "Your Care Workspace",
    careShortcutsSub:
      "Jump directly to emergency medical records, live doctor slots, GPS transport, or 24/7 duty pharmacies.",
    shortcutSafety: "Emergency Profile & Allergies",
    shortcutBooking: "Doctor Appointments",
    shortcutPharmacy: "24/7 QR Pharmacy",
    shortcutMap: "Live Dispatch Map",
    ledgerTitle: "Account & Session Details",
    memberSinceLabel: "Member since",
    authMethodLabel: "Sign-in method",
    authMethodLocal: "Email & Password",
    authMethodGoogle: "Google Sign-In",
    accountStatusLabel: "Account status",
    switchAccountCta: "Switch Account",
  },
  fr: {
    heading: "Mon Profil & Compte",
    careRegionPrefix: "Région Active",
    guestEyebrow: "Profil Membre Authentifié",
    guestTitle: "Connectez-vous pour accéder à votre profil",
    guestSubtitle:
      "Gérez vos coordonnées vérifiées, photo de profil, mot de passe, sessions actives et justificatifs professionnels.",
    guestPrimaryCta: "Connexion ou Inscription",
    guestSecondaryCta: "Retour à l'aperçu",
    guestProtectedBadge: "Compte Santé Protégé",
    guestPrivacyLabel: "Confidentialité",
    guestPrivacyValue: "Loi CNDP 09-08",
    guestSecurityLabel: "Sécurité",
    guestSecurityValue: "Sessions Chiffrées",
    guestRegionLabel: "Région",
    guestEmergencyShort: "Urgence 141",
    guestProLink: "Portail Personnel & Partenaires",
    signOutBtn: "Déconnexion",
    verifiedStaffTag: "Praticien / Chauffeur Vérifié",
    pendingStaffTag: "En attente de validation",
    activeMemberTag: "Compte Actif",
    emailVerified: "E-mail vérifié",
    emailUnverified: "E-mail non vérifié",
    phoneVerified: "Téléphone vérifié",
    phoneUnverified: "Téléphone non vérifié",
    credentialsTitle: "Justificatifs & Agrément",
    credentialsSubtitle:
      "Téléversez vos pièces professionnelles afin que l'administration maintienne votre habilitation active.",
    careShortcutsTitle: "Vos Accès Soins Rapides",
    careShortcutsSub:
      "Accédez directement à votre dossier médical d'urgence, aux rendez-vous, à la carte GPS ou aux pharmacies.",
    shortcutSafety: "Dossier Urgence & Allergies",
    shortcutBooking: "Rendez-vous Médecins",
    shortcutPharmacy: "Pharmacies 24/7 & QR",
    shortcutMap: "Carte & Transport Live",
    ledgerTitle: "Détails du Compte & Session",
    memberSinceLabel: "Membre depuis",
    authMethodLabel: "Méthode d'accès",
    authMethodLocal: "E-mail & Mot de passe",
    authMethodGoogle: "Google Sign-In",
    accountStatusLabel: "Statut du compte",
    switchAccountCta: "Changer de compte",
  },
  ar: {
    heading: "ملفي الشخصي والحساب",
    careRegionPrefix: "المنطقة الصحية",
    guestEyebrow: "ملف المستخدم الموثق",
    guestTitle: "سجل الدخول للوصول إلى ملفك الشخصي",
    guestSubtitle:
      "أدِر بياناتك الشخصية الموثقة، صورة الحساب، كلمة المرور، الجلسات النشطة ووثائق الاعتماد المهنية في مكان واحد.",
    guestPrimaryCta: "تسجيل الدخول أو إنشاء حساب",
    guestSecondaryCta: "العودة للرئيسية",
    guestProtectedBadge: "حساب صحي محمي",
    guestPrivacyLabel: "الخصوصية",
    guestPrivacyValue: "قانون CNDP 09-08",
    guestSecurityLabel: "الأمان",
    guestSecurityValue: "جلسات مشفّرة",
    guestRegionLabel: "المنطقة",
    guestEmergencyShort: "الطوارئ 141",
    guestProLink: "بوابة الطاقم والشركاء",
    signOutBtn: "تسجيل الخروج",
    verifiedStaffTag: "حساب مهني معتمد",
    pendingStaffTag: "بانتظار مراجعة الإدارة",
    activeMemberTag: "حساب نشط",
    emailVerified: "البريد مؤكد",
    emailUnverified: "البريد غير مؤكد",
    phoneVerified: "الهاتف مؤكد",
    phoneUnverified: "الهاتف غير مؤكد",
    credentialsTitle: "وثائق الاعتماد والتحقق",
    credentialsSubtitle:
      "ارفع التراخيص والشهادات المهنية لإبقاء صلاحيات العمل الميداني أو الطبي مفعّلة.",
    careShortcutsTitle: "روابط الرعاية الصحية الخاصة بك",
    careShortcutsSub:
      "انتقل مباشرة إلى ملف الطوارئ والحساسية، مواعيد الأطباء، خريطة الإسعاف، أو الصيدليات.",
    shortcutSafety: "ملف الطوارئ والحساسية",
    shortcutBooking: "حجوزات الأطباء",
    shortcutPharmacy: "صيدليات 24/7",
    shortcutMap: "الخريطة المباشرة",
    ledgerTitle: "بيانات الحساب والجلسة",
    memberSinceLabel: "تاريخ الإنشاء",
    authMethodLabel: "طريقة الدخول",
    authMethodLocal: "البريد وكلمة المرور",
    authMethodGoogle: "حساب Google",
    accountStatusLabel: "حالة الحساب",
    switchAccountCta: "تبديل الحساب",
  },
} as const;

export function AuthenticatedProfileWorkspace({
  packs,
  apiBaseUrl,
}: AuthenticatedProfileWorkspaceProps) {
  const router = useRouter();
  const { locale, isRtl } = useLocale();
  const copy = PROFILE_COPY[locale] ?? PROFILE_COPY.en;
  const portalCopy = PORTAL_COPY[locale];
  const msg = portalCopy.messages;
  const setToast = useToastSetter();
  const { openImage } = useImageLightbox();

  const [session, setSession] = useState<AuthResponse | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [facilities, setFacilities] = useState<FacilitySummary[]>([]);
  const [documents, setDocuments] = useState<UserMediaDocument[]>([]);
  const [busy, setBusy] = useState(false);
  const [avatarProgress, setAvatarProgress] = useState<number | null>(null);
  const hydrationSeqRef = useRef(0);

  useEffect(() => {
    let active = true;

    async function hydrateAuthenticatedProfile() {
      const seq = ++hydrationSeqRef.current;
      const stored = readStoredSession();
      if (!active) return;

      if (!stored) {
        setSession(null);
        setFacilities([]);
        setDocuments([]);
        setHydrated(true);
        return;
      }

      setSession(stored);
      setHydrated(true);

      const [meRes, facRes, mediaRes] = await Promise.all([
        fetchMe(apiBaseUrl, stored.token),
        listFacilities(apiBaseUrl, stored.token, stored.user.countryCode),
        listMyUserMedia(apiBaseUrl, stored.token),
      ]);
      if (!active || seq !== hydrationSeqRef.current || !readStoredSession()) {
        return;
      }

      if (!meRes.ok) {
        if (
          meRes.status === 401 ||
          meRes.error === "UNAUTHORIZED" ||
          meRes.error === "INVALID_TOKEN"
        ) {
          clearStoredSession();
          setSession(null);
          setFacilities([]);
          setDocuments([]);
        }
        return;
      }

      const freshSession: AuthResponse = {
        token: stored.token,
        user: meRes.data.user,
      };
      setSession(freshSession);
      if (JSON.stringify(freshSession.user) !== JSON.stringify(stored.user)) {
        writeStoredSession(freshSession);
      }
      if (facRes.ok) setFacilities(facRes.data.facilities);
      if (mediaRes.ok) setDocuments(mediaRes.data.documents);
    }

    void hydrateAuthenticatedProfile();
    const syncHandler = () => {
      const current = readStoredSession();
      if (!current) {
        hydrationSeqRef.current += 1;
        setSession(null);
        setFacilities([]);
        setDocuments([]);
        return;
      }
      setSession((prev) =>
        prev?.token === current.token &&
        JSON.stringify(prev.user) === JSON.stringify(current.user)
          ? prev
          : current,
      );
    };
    window.addEventListener(SESSION_CHANGE_EVENT, syncHandler);
    window.addEventListener("storage", syncHandler);
    return () => {
      active = false;
      window.removeEventListener(SESSION_CHANGE_EVENT, syncHandler);
      window.removeEventListener("storage", syncHandler);
    };
  }, [apiBaseUrl]);

  const activePack = resolveActivePack(packs);
  const activeCountryCode = resolveEffectiveCountryCode(
    session?.user.countryCode ?? activePack?.code,
  );
  const resolvedCountryPack =
    packs.find((item) => item.code === activeCountryCode) ?? activePack;

  async function refreshUserDocuments() {
    if (!session) return;
    const mediaRes = await listMyUserMedia(apiBaseUrl, session.token);
    if (mediaRes.ok) {
      setDocuments(mediaRes.data.documents);
    }
  }

  async function handleRefreshStatus() {
    if (!session) return;
    setBusy(true);
    const [meRes] = await Promise.all([
      fetchMe(apiBaseUrl, session.token),
      refreshUserDocuments(),
    ]);
    setBusy(false);

    if (!meRes.ok) {
      setToast({
        tone: "error",
        text: msg.refreshStatusFailed(meRes.error),
      });
      return;
    }

    const updated: AuthResponse = { token: session.token, user: meRes.data.user };
    setSession(updated);
    writeStoredSession(updated);
    setToast({
      tone: isPendingStaffVerification(meRes.data.user) ? "info" : "success",
      text: isPendingStaffVerification(meRes.data.user)
        ? msg.stillPendingReview
        : msg.adminApprovedMsg,
    });
  }

  async function handleAvatarChange(file: File | null) {
    if (!file || !session) return;
    setBusy(true);
    const result = await uploadAvatarPhotoFile({
      apiBaseUrl,
      token: session.token,
      user: session.user,
      file,
      invalidMimeMessage: msg.invalidAvatarMime,
      uploadFailedMessage: msg.avatarUploadFailed,
      onProgress: setAvatarProgress,
    });
    setBusy(false);

    if (!result.ok) {
      setToast({ tone: "error", text: result.errorText });
      return;
    }

    const updatedSession: AuthResponse = {
      token: session.token,
      user: result.user,
    };
    setSession(updatedSession);
    writeStoredSession(updatedSession);
    await refreshUserDocuments();
    setToast({ tone: "success", text: msg.avatarUploaded });
  }

  function handleSignOut() {
    hydrationSeqRef.current += 1;
    revokeClientSession(apiBaseUrl);
    setSession(null);
    setFacilities([]);
    setDocuments([]);
    setToast({ tone: "info", text: msg.signedOutRevoked });
  }

  if (!hydrated) {
    return (
      <div
        dir={isRtl ? "rtl" : "ltr"}
        className="mx-auto max-w-2xl rounded-2xl border border-[#D7E4F2] bg-white p-8 shadow-sm ring-1 ring-slate-900/[0.06]"
      >
        <div className="h-6 w-48 animate-pulse rounded-lg bg-slate-100" />
        <div className="mt-4 h-24 animate-pulse rounded-xl bg-slate-50" />
      </div>
    );
  }

  if (!session) {
    return (
      <section
        dir={isRtl ? "rtl" : "ltr"}
        className="mx-auto max-w-4xl py-6 sm:py-12"
      >
        <div className="grid overflow-hidden rounded-2xl border border-[#D7E4F2] bg-white shadow-[0_14px_36px_-16px_rgba(15,36,62,0.12)] lg:grid-cols-12">
          {/* Soft Clinical Sky Protected Account Panel */}
          <div className="atlas-ice-grid flex flex-col justify-between border-b border-[#D7E4F2] p-7 text-[#0F243E] lg:col-span-5 lg:border-e lg:border-b-0">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full border border-[#BFDBFE] bg-[#EBF4FF] px-3 py-1 text-xs font-semibold text-[#0052A3]">
                <span className="h-2 w-2 rounded-full bg-[#0066CC]" />
                <span>{copy.guestProtectedBadge}</span>
              </p>
              <p className="font-editorial mt-4 text-2xl font-bold leading-snug text-[#0F243E] sm:text-[28px]">
                {copy.guestEyebrow}
              </p>
            </div>

            <dl className="mt-6 space-y-2.5 border-t border-[#D7E4F2] pt-4 text-xs text-[#4A627D]">
              <div className="flex items-center justify-between gap-2">
                <dt>{copy.guestPrivacyLabel}</dt>
                <dd className="font-semibold text-[#0066CC]">{copy.guestPrivacyValue}</dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt>{copy.guestSecurityLabel}</dt>
                <dd className="font-semibold text-[#0F243E]">{copy.guestSecurityValue}</dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt>{copy.guestRegionLabel}</dt>
                <dd className="font-semibold text-[#0F243E]">
                  {formatCountryDisplayName(
                    activeCountryCode,
                    resolvedCountryPack?.name ?? activeCountryCode,
                    locale,
                  )}
                </dd>
              </div>
            </dl>
          </div>

          {/* Pure White Unlock Plate */}
          <div className="flex flex-col justify-between bg-white p-7 sm:p-9 lg:col-span-7">
            <div>
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[#BFDBFE] bg-[#EBF4FF] text-[#0066CC]">
                <UserCheck className="h-5 w-5" aria-hidden="true" />
              </span>
              <h1 className="font-editorial mt-4 text-3xl leading-[1.08] tracking-[-0.02em] text-[#0F243E] sm:text-[36px]">
                {copy.guestTitle}
              </h1>
              <div className="mt-6 flex flex-wrap items-center gap-2.5">
                <UiLinkButton href="/portal" variant="primary" size="lg">
                  <span>{copy.guestPrimaryCta}</span>
                  <ArrowRight
                    className="h-4 w-4 rtl:rotate-180"
                    aria-hidden="true"
                  />
                </UiLinkButton>
                <UiLinkButton href="/" variant="outline" size="lg">
                  <span>{copy.guestSecondaryCta}</span>
                </UiLinkButton>
              </div>
            </div>

            <div className="mt-8 flex items-center justify-between border-t border-[#D7E4F2] pt-4 text-xs text-[#5B7087]">
              <span>MediSync Pro</span>
              <UiLinkButton href="/pro" variant="ghost" size="sm">
                <span>{copy.guestProLink}</span>
                <ArrowRight className="h-3.5 w-3.5 rtl:rotate-180" aria-hidden="true" />
              </UiLinkButton>
            </div>
          </div>
        </div>
      </section>
    );
  }

  const user = session.user;
  const pendingStaff = isPendingStaffVerification(user);
  const staffRole = isStaffWorkerRole(user.role);
  const primaryWorkspace = getPrimaryWorkspaceForUser(user, locale);
  const countryLabel = formatCountryDisplayName(
    activeCountryCode,
    resolvedCountryPack?.name ?? activeCountryCode,
    locale,
  );

  return (
    <div dir={isRtl ? "rtl" : "ltr"} className="space-y-6">
      <WorkspaceHeader
        title={copy.heading}
        prefixMeta={<span>{copy.careRegionPrefix}</span>}
        countryCode={activeCountryCode}
        countryName={countryLabel}
        currencyCode={resolvedCountryPack?.currencyCode ?? activeCountryCode}
        emergencyHotline={
          resolvedCountryPack?.emergencyHotlines.ambulance ?? ""
        }
        user={user}
        hideGuestSignIn
        onSignOut={handleSignOut}
      />

      {/* Pure White Medical Member Dossier Header */}
      <section className="atlas-medical-grid rounded-2xl border border-[#D7E4F2] bg-white p-5 text-[#0F243E] sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
            <div className="relative flex shrink-0 items-center gap-3">
              {user.avatarUrl ? (
                <button
                  type="button"
                  onClick={() =>
                    openImage({
                      src: user.avatarUrl!,
                      downloadUrl: user.avatarUrl!,
                      alt: user.fullName,
                      title: user.fullName,
                      subtitle: formatRoleLabel(user.role, locale),
                    })
                  }
                  className="rounded-full ring-2 ring-[#D7E4F2] transition hover:ring-[#0066CC] focus:outline-none"
                >
                  <EntityAvatar
                    name={user.fullName}
                    role={user.role}
                    avatarUrl={user.avatarUrl}
                    size="lg"
                  />
                </button>
              ) : (
                <EntityAvatar
                  name={user.fullName}
                  role={user.role}
                  avatarUrl={null}
                  size="lg"
                />
              )}
            </div>

            <div className="min-w-0 space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-editorial text-2xl leading-tight text-[#0F243E] sm:text-3xl">
                  <bdi dir="auto">{user.fullName}</bdi>
                </h2>
                <span className="inline-flex items-center gap-1 rounded-xl border border-[#D7E4F2] bg-[#F3F8FD] px-2 py-0.5 font-mono-tabular text-[10.5px] font-semibold uppercase text-[#2C3E54]">
                  {formatRoleLabel(user.role, locale)} · {user.countryCode}
                </span>
                <span
                  className={`inline-flex items-center gap-1 rounded-xl border px-2 py-0.5 font-mono-tabular text-[10.5px] font-semibold uppercase ${
                    pendingStaff
                      ? "border-amber-200 bg-amber-50 text-amber-900"
                      : "border-[#BFDBFE] bg-[#EBF4FF] text-[#00448A]"
                  }`}
                >
                  {pendingStaff ? (
                    <ShieldAlert className="h-3 w-3" aria-hidden="true" />
                  ) : (
                    <ShieldCheck className="h-3 w-3" aria-hidden="true" />
                  )}
                  {pendingStaff
                    ? copy.pendingStaffTag
                    : staffRole
                      ? copy.verifiedStaffTag
                      : copy.activeMemberTag}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono-tabular text-[11px] text-[#5B7087]">
                {user.email ? <bdi dir="ltr">{user.email}</bdi> : null}
                <span
                  className={`inline-flex items-center gap-1 font-medium ${
                    user.emailVerified ? "text-[#0066CC]" : "text-[#6E8298]"
                  }`}
                >
                  <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                  {user.emailVerified
                    ? copy.emailVerified
                    : copy.emailUnverified}
                </span>
                <span
                  className={`inline-flex items-center gap-1 font-medium ${
                    user.phoneVerified ? "text-[#0066CC]" : "text-[#6E8298]"
                  }`}
                >
                  <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                  {user.phoneVerified
                    ? copy.phoneVerified
                    : copy.phoneUnverified}
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 lg:shrink-0">
            <label className="inline-flex min-h-[34px] cursor-pointer items-center gap-1.5 rounded-xl border border-[#CBDDF0] bg-white px-3 py-1.5 text-xs font-semibold text-[#0F243E] transition hover:border-[#0066CC] hover:bg-[#F3F8FD] active:scale-[0.98]">
              <Camera className="h-3.5 w-3.5 text-[#0066CC]" aria-hidden="true" />
              <span>
                {avatarProgress !== null
                  ? `${avatarProgress}%`
                  : portalCopy.aside.photoBtn}
              </span>
              <input
                type="file"
                accept={ALLOWED_AVATAR_MIME_TYPES.join(",")}
                disabled={busy}
                className="sr-only"
                onChange={(e) =>
                  void handleAvatarChange(e.target.files?.[0] ?? null)
                }
              />
            </label>

            <UiLinkButton
              href={primaryWorkspace.href}
              variant="primary"
              size="sm"
            >
              <span>{primaryWorkspace.label}</span>
              <ArrowRight
                className="h-3.5 w-3.5 rtl:rotate-180"
                aria-hidden="true"
              />
            </UiLinkButton>
          </div>
        </div>
      </section>

      {/* Main Split Grid: Identity + Password/Sessions on Left, Verification/Role Access on Right */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        <section className="min-w-0 rounded-2xl border border-[#D7E4F2] bg-white p-5 sm:p-6 lg:col-span-7">
          <AccountProfileSecurityCard
            apiBaseUrl={apiBaseUrl}
            token={session.token}
            user={user}
            facilities={facilities}
            onSessionUpdated={(auth, message) => {
              writeStoredSession(auth);
              setSession(auth);
              if (message) setToast({ tone: "success", text: message });
            }}
            onUserUpdated={(updatedUser, message) => {
              const next: AuthResponse = {
                token: session.token,
                user: updatedUser,
              };
              writeStoredSession(next);
              setSession(next);
              if (message) setToast({ tone: "success", text: message });
            }}
            onOpenSwitchAccount={() =>
              router.push(
                user.role !== "PATIENT" && user.role !== "CAREGIVER"
                  ? "/pro"
                  : "/portal",
              )
            }
            onSignOut={handleSignOut}
            hidePrimaryLink
          />
        </section>

        <aside className="min-w-0 space-y-5 lg:col-span-5">
          {staffRole ? (
            <section className="rounded-2xl border border-[#D7E4F2] bg-white p-5 sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#D7E4F2] pb-3">
                <h2 className="text-sm font-bold text-[#0F243E]">
                  {copy.credentialsTitle}
                </h2>
                <UiButton
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={busy}
                  onClick={() => void handleRefreshStatus()}
                >
                  <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>{portalCopy.aside.refreshBtn}</span>
                </UiButton>
              </div>
              {pendingStaff ? (
                <p className="mt-2.5 text-xs leading-relaxed text-[#4A4843]">
                  {getPortalOnboardingSummary(portalCopy, user.role)}
                </p>
              ) : null}

              <div className="mt-3">
                <ProfileCredentialsPanel
                  key={user.id}
                  apiBaseUrl={apiBaseUrl}
                  token={session.token}
                  userRole={user.role}
                  documents={documents}
                  busy={busy}
                  onBusyChange={setBusy}
                  onDocumentsUpdated={refreshUserDocuments}
                  onFeedback={(tone, text) => setToast({ tone, text })}
                />
              </div>
            </section>
          ) : null}

          {/* Account & Session Ledger */}
          <section className="rounded-2xl border border-[#D7E4F2] bg-white p-5 sm:p-6">
            <div className="flex items-center justify-between gap-2">
              <h2 className="flex items-center gap-1.5 text-sm font-bold text-slate-950">
                <Clock3
                  className="h-4 w-4 text-[#0066CC]"
                  aria-hidden="true"
                />
                <span>{copy.ledgerTitle}</span>
              </h2>
              <UiLinkButton
                href={
                  user.role !== "PATIENT" && user.role !== "CAREGIVER"
                    ? "/pro"
                    : "/portal"
                }
                variant="outline"
                size="sm"
                pill
              >
                <Users className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{copy.switchAccountCta}</span>
              </UiLinkButton>
            </div>

            <dl className="mt-4 space-y-2.5 text-xs">
              <div className="flex items-center justify-between gap-3 border-b border-slate-200/60 pb-2">
                <dt className="text-slate-500">{copy.accountStatusLabel}</dt>
                <dd className="font-semibold text-slate-900">
                  {pendingStaff
                    ? copy.pendingStaffTag
                    : staffRole
                      ? copy.verifiedStaffTag
                      : copy.activeMemberTag}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3 border-b border-slate-200/60 pb-2">
                <dt className="text-slate-500">{copy.authMethodLabel}</dt>
                <dd className="font-semibold text-slate-900">
                  {user.authProvider === "GOOGLE"
                    ? copy.authMethodGoogle
                    : user.authProvider === "PHONE"
                      ? "Phone OTP"
                      : copy.authMethodLocal}
                </dd>
              </div>
              {user.createdAtIso ? (
                <div className="flex items-center justify-between gap-3 border-b border-slate-200/60 pb-2">
                  <dt className="text-slate-500">{copy.memberSinceLabel}</dt>
                  <dd dir="ltr" className="font-mono-tabular font-semibold text-slate-900">
                    {user.createdAtIso.slice(0, 10)}
                  </dd>
                </div>
              ) : null}
              {user.lastLoginAtIso ? (
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-slate-500">
                    {portalCopy.profileCard.lastLoginPrefix}
                  </dt>
                  <dd dir="ltr" className="font-mono-tabular font-semibold text-slate-900">
                    {user.lastLoginAtIso.slice(0, 16).replace("T", " ")} UTC
                  </dd>
                </div>
              ) : null}
            </dl>
          </section>

          <ComplianceRightsCard
            apiBaseUrl={apiBaseUrl}
            token={session.token}
            user={user}
          />
        </aside>
      </div>
    </div>
  );
}
