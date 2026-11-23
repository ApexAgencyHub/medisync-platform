"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  clearStoredSession,
  readStoredSession,
  revokeClientSession,
  writeStoredSession,
} from "@/shared/auth/session-storage";
import {
  formatCountryDisplayName,
  formatFacilityKind,
  formatRoleLabel,
  getLicenseExample,
} from "@/shared/i18n/human-labels";
import {
  ACTIVE_COUNTRY_CODE,
  resolveActivePack,
  resolveEffectiveCountryCode,
} from "@/shared/config/deployment";
import { EntityAvatar } from "@/shared/ui/EntityAvatar";
import { EntityPicker } from "@/shared/ui/EntityPicker";
import { useImageLightbox } from "@/shared/ui/ImageLightboxProvider";
import {
  WorkspaceHeader,
  useToastSetter,
} from "@/shared/ui/primitives";
import { MoroccanComplianceBadge } from "@/shared/ui/TactileControls";
import { MOROCCAN_CITIES } from "@/shared/config/morocco-standards";
import { useLocale } from "@/shared/i18n/locale-store";
import {
  ALLOWED_AVATAR_MIME_TYPES,
  ALLOWED_CERTIFICATION_MIME_TYPES,
  CertificationMimeTypeSchema,
  CreateFacilitySchema,
  FacilityKindSchema,
  LoginSchema,
  MAX_MEDIA_UPLOAD_BYTES,
  RegisterUserSchema,
  STAFF_WORKER_ROLES,
  isStaffWorkerRole,
  type AuthResponse,
  type AuthenticatedUser,
  type CountryPack,
  type DemoPersonaSummary,
  type FacilityKind,
  type FacilityMediaDocument,
  type FacilitySummary,
  type StaffWorkerRole,
  type UserMediaDocument,
  type UserRole,
} from "@medisync/contracts";
import { validateFacilityLicense } from "@medisync/country-packs";
import {
  checkBackendOnline,
  fetchDemoPersonas,
} from "@/shared/api/directory-client";
import {
  FileUploadDropzone,
  formatByteSize,
  inferUploadMimeType,
  listFacilityMedia,
  listMyUserMedia,
  uploadFacilityMediaEndToEnd,
} from "@/features/media-certifications";
import {
  Ambulance,
  Building2,
  Camera,
  Eye,
  EyeOff,
  FileText,
  FlaskConical,
  HeartPulse,
  Hospital,
  KeyRound,
  LocateFixed,
  LogOut,
  MapPin,
  Pill,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Stethoscope,
  UserPlus,
} from "lucide-react";
import {
  createFacility,
  fetchMe,
  listFacilities,
  loginUser,
  registerUser,
  updateUserProfile,
  verifyFacilityStatus,
} from "../api-client";
import { isPendingStaffVerification } from "@/shared/ui/VerificationGateNotice";
import { getPrimaryWorkspaceForUser } from "@/shared/auth/role-capabilities";
import { AccountProfileSecurityCard } from "./AccountProfileSecurityCard";
import { AccountRecoveryPanel } from "./AccountRecoveryPanel";
import {
  ProfileCredentialsPanel,
  uploadAvatarPhotoFile,
} from "./ProfileCredentialsPanel";
import { PrivacyConsentCheckbox } from "./PrivacyConsentCheckbox";
import {
  getPortalOnboardingSummary,
  getReviewStatusLabel,
  PORTAL_COPY,
} from "../portal-i18n";

type ProTab = "signin" | "register" | "facility" | "recovery";

function renderStaffRoleIcon(role: StaffWorkerRole, className = "h-5 w-5") {
  switch (role) {
    case "DOCTOR":
      return <Stethoscope className={className} aria-hidden="true" />;
    case "NURSE":
      return <HeartPulse className={className} aria-hidden="true" />;
    case "CLINIC_STAFF":
      return <Building2 className={className} aria-hidden="true" />;
    case "HOSPITAL_ADMIN":
      return <Hospital className={className} aria-hidden="true" />;
    case "DRIVER":
      return <Ambulance className={className} aria-hidden="true" />;
    case "PHARMACIST":
      return <Pill className={className} aria-hidden="true" />;
    case "LAB_TECH":
      return <FlaskConical className={className} aria-hidden="true" />;
  }
}

const FACILITY_KIND_LABELS: Record<FacilityKind, string> = {
  CLINIC: "Medical Clinic",
  HOSPITAL: "Acute Hospital",
  PHARMACY: "Dispensing Pharmacy",
  DIAGNOSTIC_LAB: "Diagnostic Laboratory",
};

function getRoleWorkspaceHref(
  role: UserRole,
  locale: "en" | "fr" | "ar" = "en",
): { href: string; label: string } {
  return getPrimaryWorkspaceForUser(
    {
      id: "",
      email: "",
      fullName: "",
      role,
      countryCode: "MA",
      facilityId: null,
      avatarUrl: null,
      emailVerified: true,
      phone: null,
      phoneVerified: true,
      authProvider: "LOCAL",
      accountStatus: "ACTIVE",
      credentialVerified: true,
      lastLoginAtIso: null,
      createdAtIso: "",
    },
    locale,
  );
}

interface ProPortalWorkspaceProps {
  packs: readonly CountryPack[];
  apiBaseUrl: string;
}

/**
 * Dedicated Staff, Facility & Driver enterprise authentication portal (`/pro`).
 * Strictly enforces `portalTrack: "STAFF"` and excludes consumer Patient/Caregiver sign-in UI.
 */
export function ProPortalWorkspace({
  packs,
  apiBaseUrl,
}: ProPortalWorkspaceProps) {
  const router = useRouter();
  const { locale, isRtl, t } = useLocale();
  const copy = PORTAL_COPY[locale];
  const msg = copy.messages;
  const { openImage } = useImageLightbox();
  const defaultPackCode = resolveActivePack(packs)?.code ?? ACTIVE_COUNTRY_CODE;

  const [activeTab, setActiveTab] = useState<ProTab>("signin");
  const [selectedCountry, setSelectedCountry] = useState<string>(defaultPackCode);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<AuthenticatedUser | null>(null);
  const [facilities, setFacilities] = useState<FacilitySummary[]>([]);
  const [demoPersonas, setDemoPersonas] = useState<DemoPersonaSummary[]>([]);
  const [showAccountSwitchForms, setShowAccountSwitchForms] = useState(false);
  const [showStaffPassword, setShowStaffPassword] = useState(false);

  const [busy, setBusy] = useState(false);
  const authLockRef = useRef(false);
  const setStatusMessage = useToastSetter();

  // Staff Sign-In Form State
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  // Staff Registration Form State
  const [regEmail, setRegEmail] = useState("");
  const [regPhone, setRegPhone] = useState("");
  const [regFullName, setRegFullName] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regRole, setRegRole] = useState<StaffWorkerRole>("DOCTOR");
  const [acceptedStaffTerms, setAcceptedStaffTerms] = useState(true);
  const [workplaceFacilityId, setWorkplaceFacilityId] = useState("");

  // Facility Onboarding Form State
  const [facName, setFacName] = useState("");
  const [facKind, setFacKind] = useState<FacilityKind>("CLINIC");
  const [facLicense, setFacLicense] = useState("");
  const [facAddress, setFacAddress] = useState("");
  const [facLat, setFacLat] = useState("33.5731");
  const [facLng, setFacLng] = useState("-7.5898");
  const [facLicenseFile, setFacLicenseFile] = useState<File | null>(null);
  const [facPhotoFile, setFacPhotoFile] = useState<File | null>(null);
  const [facUploadProgress, setFacUploadProgress] = useState<number | null>(
    null,
  );

  // User Profile Avatar & Practitioner Credentials State
  const [myUserMedia, setMyUserMedia] = useState<UserMediaDocument[]>([]);
  const [avatarProgress, setAvatarProgress] = useState<number | null>(null);
  const [facilityDocsByFac, setFacilityDocsByFac] = useState<
    Record<string, FacilityMediaDocument[]>
  >({});

  useEffect(() => {
    const stored = readStoredSession();
    if (stored) {
      setSessionToken(stored.token);
      setCurrentUser(stored.user);
      setSelectedCountry(resolveEffectiveCountryCode(stored.user.countryCode));
      setWorkplaceFacilityId(stored.user.facilityId ?? "");
    }

    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get("tab");
      const roleParam = params.get("role");
      if (
        tabParam === "signin" ||
        tabParam === "register" ||
        tabParam === "facility" ||
        tabParam === "recovery"
      ) {
        setActiveTab(tabParam);
        setShowAccountSwitchForms(true);
      }
      if (roleParam) {
        const upper = roleParam.toUpperCase();
        if (
          STAFF_WORKER_ROLES.includes(upper as StaffWorkerRole)
        ) {
          setRegRole(upper as StaffWorkerRole);
          setActiveTab("register");
          setShowAccountSwitchForms(true);
        }
      }
    }

    let cancelled = false;
    checkBackendOnline().then(async (online) => {
      if (!online || cancelled) return;

      const personasPromise = fetchDemoPersonas(apiBaseUrl).then((list) => {
        if (!cancelled) setDemoPersonas(list);
      });

      if (stored) {
        const [meRes, mediaRes] = await Promise.all([
          fetchMe(apiBaseUrl, stored.token),
          listMyUserMedia(apiBaseUrl, stored.token),
        ]);
        if (cancelled) return;

        if (!meRes.ok && meRes.status === 401) {
          clearStoredSession();
          setSessionToken(null);
          setCurrentUser(null);
          setFacilities([]);
          setMyUserMedia([]);
          await personasPromise;
          return;
        }

        const effectiveUser = meRes.ok ? meRes.data.user : stored.user;
        if (meRes.ok) {
          setCurrentUser(effectiveUser);
          setSelectedCountry(
            resolveEffectiveCountryCode(effectiveUser.countryCode),
          );
          setWorkplaceFacilityId(effectiveUser.facilityId ?? "");
          writeStoredSession({ token: stored.token, user: effectiveUser });
        }
        if (mediaRes.ok) {
          setMyUserMedia(mediaRes.data.documents);
        }

        if (isStaffWorkerRole(effectiveUser.role)) {
          const facRes = await listFacilities(
            apiBaseUrl,
            stored.token,
            effectiveUser.countryCode,
          );
          if (!cancelled && facRes.ok) {
            setFacilities(facRes.data.facilities);
          }
        }
      }

      await personasPromise;
    });

    return () => {
      cancelled = true;
    };
  }, [apiBaseUrl]);

  const activePack =
    packs.find((p) => p.code === selectedCountry) ?? packs[0] ?? null;

  const licenseMatchesPack =
    facLicense.trim().length > 0 &&
    validateFacilityLicense(selectedCountry, facLicense);

  async function refreshMyUserMedia(token: string) {
    const res = await listMyUserMedia(apiBaseUrl, token);
    if (res.ok) {
      setMyUserMedia(res.data.documents);
    }
  }

  async function refreshScopedFacilities(token: string, countryCode: string) {
    const res = await listFacilities(apiBaseUrl, token, countryCode);
    if (res.ok) {
      setFacilities(res.data.facilities);
      return;
    }
    setStatusMessage({
      tone: "error",
      text:
        res.error === "API_UNREACHABLE"
          ? "Unable to reach the medical directory service right now. Please try again in a moment."
          : `Unable to load scoped facilities (${res.error}).`,
    });
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
    await refreshMyUserMedia(sessionToken);
    setStatusMessage({ tone: "success", text: msg.avatarUploaded });
  }

  async function handleLoadFacilityDocs(facilityId: string) {
    if (!sessionToken) return;
    const res = await listFacilityMedia(apiBaseUrl, sessionToken, facilityId);
    if (res.ok) {
      setFacilityDocsByFac((prev) => ({
        ...prev,
        [facilityId]: res.data.documents,
      }));
    }
  }

  async function handleUploadExtraFacilityDoc(
    facilityId: string,
    category: "MINISTRY_LICENSE" | "FACILITY_PHOTO",
    file: File | null,
  ) {
    if (!file || !sessionToken) return;
    const mime = inferUploadMimeType(
      file,
      category === "FACILITY_PHOTO"
        ? ALLOWED_AVATAR_MIME_TYPES
        : ALLOWED_CERTIFICATION_MIME_TYPES,
    );
    if (!mime) {
      setStatusMessage({ tone: "error", text: msg.unsupportedDocFormat });
      return;
    }

    setBusy(true);
    const uploadRes = await uploadFacilityMediaEndToEnd({
      apiBaseUrl,
      token: sessionToken,
      facilityId,
      category,
      file,
      mimeType: CertificationMimeTypeSchema.parse(mime),
    });
    setBusy(false);

    if (!uploadRes.ok) {
      setStatusMessage({
        tone: "error",
        text: msg.facilityDocFailed(uploadRes.error),
      });
      return;
    }

    await handleLoadFacilityDocs(facilityId);
    setStatusMessage({
      tone: "success",
      text: msg.facilityDocUploaded(uploadRes.confirmed.document.fileName),
    });
  }

  async function applyAuthenticatedSession(auth: AuthResponse, message: string) {
    writeStoredSession(auth);
    setSessionToken(auth.token);
    setCurrentUser(auth.user);
    setShowAccountSwitchForms(false);
    setSelectedCountry(resolveEffectiveCountryCode(auth.user.countryCode));
    setWorkplaceFacilityId(auth.user.facilityId ?? "");
    setStatusMessage({
      tone: isPendingStaffVerification(auth.user) ? "info" : "success",
      text: isPendingStaffVerification(auth.user)
        ? `${message} ${msg.pendingUploadAppend}`
        : message,
    });
    if (!isPendingStaffVerification(auth.user)) {
      router.push(getPrimaryWorkspaceForUser(auth.user, locale).href);
      return;
    }
    await Promise.all([
      refreshScopedFacilities(auth.token, auth.user.countryCode),
      refreshMyUserMedia(auth.token),
    ]);
  }

  async function executeStaffLogin(identifierOrEmail: string, password: string) {
    if (authLockRef.current) return;
    const trimmed = identifierOrEmail.trim();
    const parsed = LoginSchema.safeParse({
      ...(trimmed.includes("@") ? { email: trimmed } : {}),
      identifier: trimmed,
      password,
      portalTrack: "STAFF",
    });
    if (!parsed.success) {
      setStatusMessage({ tone: "error", text: msg.invalidLoginFields });
      return;
    }

    authLockRef.current = true;
    setBusy(true);
    setStatusMessage(null);
    try {
      const res = await loginUser(apiBaseUrl, parsed.data);
      if (!res.ok) {
        setStatusMessage({
          tone: "error",
          text:
            res.error === "API_UNREACHABLE"
              ? msg.serviceUnreachable(apiBaseUrl)
              : msg.signInRejected(res.error),
        });
        return;
      }

      await applyAuthenticatedSession(
        res.data,
        msg.signedInMsg(
          res.data.user.fullName,
          formatRoleLabel(res.data.user.role, locale),
          res.data.user.countryCode,
        ),
      );
    } finally {
      setBusy(false);
      authLockRef.current = false;
    }
  }

  async function handleLoginSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await executeStaffLogin(loginEmail, loginPassword);
  }

  async function handleRegisterSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (authLockRef.current) return;
    const trimmedEmail = regEmail.trim();
    const trimmedPhone = regPhone.trim();
    const parsed = RegisterUserSchema.safeParse({
      ...(trimmedEmail ? { email: trimmedEmail } : {}),
      ...(trimmedPhone ? { phone: trimmedPhone } : {}),
      password: regPassword,
      fullName: regFullName,
      role: regRole,
      countryCode: selectedCountry,
      acceptedTerms: acceptedStaffTerms,
      consentVersion: "2026-11",
    });

    if (!parsed.success) {
      setStatusMessage({ tone: "error", text: msg.invalidRegisterFields });
      return;
    }

    authLockRef.current = true;
    setBusy(true);
    setStatusMessage(null);
    try {
      const res = await registerUser(apiBaseUrl, parsed.data);
      if (!res.ok) {
        setStatusMessage({
          tone: "error",
          text:
            res.error === "API_UNREACHABLE"
              ? msg.serviceUnreachable(apiBaseUrl)
              : msg.registerFailed(res.error),
        });
        return;
      }

      setRegPhone("");
      await applyAuthenticatedSession(
        res.data,
        msg.welcomeRegistered(
          res.data.user.fullName,
          formatRoleLabel(res.data.user.role, locale),
        ),
      );
    } finally {
      setBusy(false);
      authLockRef.current = false;
    }
  }

  async function handleSaveWorkplace(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!sessionToken || !currentUser || authLockRef.current) return;
    authLockRef.current = true;
    setBusy(true);
    try {
      const res = await updateUserProfile(apiBaseUrl, sessionToken, {
        facilityId: workplaceFacilityId || null,
      });
      if (!res.ok) {
        setStatusMessage({
          tone: "error",
          text: msg.workplaceFailed(res.error),
        });
        return;
      }
      setCurrentUser(res.data.user);
      writeStoredSession({ token: sessionToken, user: res.data.user });
      setStatusMessage({
        tone: "success",
        text: res.data.user.facilityId ? msg.workplaceSaved : msg.workplaceCleared,
      });
    } finally {
      setBusy(false);
      authLockRef.current = false;
    }
  }

  async function handleRefreshVerificationStatus() {
    if (!sessionToken || authLockRef.current) return;
    authLockRef.current = true;
    setBusy(true);
    try {
      const [meRes] = await Promise.all([
        fetchMe(apiBaseUrl, sessionToken),
        refreshMyUserMedia(sessionToken),
      ]);
      if (!meRes.ok) {
        setStatusMessage({
          tone: "error",
          text: msg.refreshStatusFailed(meRes.error),
        });
        return;
      }
      setCurrentUser(meRes.data.user);
      writeStoredSession({ token: sessionToken, user: meRes.data.user });
      await refreshScopedFacilities(sessionToken, meRes.data.user.countryCode);
      setStatusMessage({
        tone: isPendingStaffVerification(meRes.data.user) ? "info" : "success",
        text: isPendingStaffVerification(meRes.data.user)
          ? msg.stillPendingReview
          : msg.adminApprovedMsg,
      });
    } finally {
      setBusy(false);
      authLockRef.current = false;
    }
  }

  async function handleFacilitySubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!sessionToken || !currentUser) {
      setStatusMessage({ tone: "error", text: msg.facilitySignInFirst });
      return;
    }

    const latText = facLat.trim();
    const lngText = facLng.trim();
    const latNum = Number(latText);
    const lngNum = Number(lngText);
    if (!latText || !lngText || !Number.isFinite(latNum) || !Number.isFinite(lngNum)) {
      setStatusMessage({ tone: "error", text: msg.facilityInvalidFields });
      return;
    }

    const parsed = CreateFacilitySchema.safeParse({
      name: facName,
      kind: facKind,
      countryCode: selectedCountry,
      licenseNumber: facLicense,
      lat: latNum,
      lng: lngNum,
      address: facAddress,
    });

    if (!parsed.success) {
      setStatusMessage({ tone: "error", text: msg.facilityInvalidFields });
      return;
    }

    if (!validateFacilityLicense(parsed.data.countryCode, parsed.data.licenseNumber)) {
      setStatusMessage({
        tone: "error",
        text: msg.facilityLicenseMismatch(
          parsed.data.licenseNumber,
          parsed.data.countryCode,
        ),
      });
      return;
    }

    setBusy(true);
    setStatusMessage(null);
    const res = await createFacility(apiBaseUrl, sessionToken, parsed.data);

    if (!res.ok) {
      setBusy(false);
      setStatusMessage({
        tone: "error",
        text:
          res.error === "API_UNREACHABLE"
            ? msg.facilityServiceDown
            : msg.facilityRejected(res.error),
      });
      return;
    }

    const createdFacility = res.data.facility;
    const uploadTasks: Array<Promise<string>> = [];

    if (facLicenseFile) {
      const mime = inferUploadMimeType(
        facLicenseFile,
        ALLOWED_CERTIFICATION_MIME_TYPES,
      );
      if (mime) {
        setFacUploadProgress(15);
        uploadTasks.push(
          uploadFacilityMediaEndToEnd({
            apiBaseUrl,
            token: sessionToken,
            facilityId: createdFacility.id,
            category: "MINISTRY_LICENSE",
            file: facLicenseFile,
            mimeType: CertificationMimeTypeSchema.parse(mime),
            onProgress: (pct) => setFacUploadProgress(pct),
          }).then((upRes) =>
            upRes.ok ? "MINISTRY_LICENSE ✓" : `MINISTRY_LICENSE (${upRes.error})`,
          ),
        );
      }
    }

    if (facPhotoFile) {
      const mime = inferUploadMimeType(facPhotoFile, ALLOWED_AVATAR_MIME_TYPES);
      if (mime) {
        setFacUploadProgress((prev) => prev ?? 15);
        uploadTasks.push(
          uploadFacilityMediaEndToEnd({
            apiBaseUrl,
            token: sessionToken,
            facilityId: createdFacility.id,
            category: "FACILITY_PHOTO",
            file: facPhotoFile,
            mimeType: CertificationMimeTypeSchema.parse(mime),
            onProgress: (pct) =>
              setFacUploadProgress((prev) => Math.max(prev ?? 0, pct)),
          }).then((upPhoto) =>
            upPhoto.ok ? "FACILITY_PHOTO ✓" : `FACILITY_PHOTO (${upPhoto.error})`,
          ),
        );
      }
    }

    const uploadNotes = await Promise.all(uploadTasks);

    setFacUploadProgress(null);
    setBusy(false);

    setFacilities((prev) => [createdFacility, ...prev]);
    setFacName("");
    setFacLicense("");
    setFacAddress("");
    setFacLicenseFile(null);
    setFacPhotoFile(null);
    void handleLoadFacilityDocs(createdFacility.id);
    setStatusMessage({
      tone: "success",
      text: msg.facilityRegistered(
        createdFacility.name,
        createdFacility.verificationStatus,
        uploadNotes.join(", "),
      ),
    });
  }

  async function handleVerifyFacility(facilityId: string) {
    if (!sessionToken || currentUser?.role !== "OPS_ADMIN") return;
    setBusy(true);
    const res = await verifyFacilityStatus(
      apiBaseUrl,
      sessionToken,
      facilityId,
      "VERIFIED",
    );
    setBusy(false);
    if (!res.ok) {
      setStatusMessage({
        tone: "error",
        text: msg.facilityVerifyFailed(res.error),
      });
      return;
    }
    setFacilities((prev) =>
      prev.map((item) => (item.id === facilityId ? res.data.facility : item)),
    );
    setStatusMessage({
      tone: "success",
      text: msg.facilityVerifiedMsg(res.data.facility.name),
    });
  }

  function handleSignOut() {
    revokeClientSession(apiBaseUrl);
    setSessionToken(null);
    setCurrentUser(null);
    setFacilities([]);
    setShowAccountSwitchForms(false);
    setStatusMessage({ tone: "info", text: msg.signedOutRevoked });
  }

  const staffDemoPersonas = useMemo(
    () =>
      demoPersonas.filter(
        (p) =>
          p.role !== "PATIENT" &&
          p.role !== "CAREGIVER" &&
          (p.countryCode === selectedCountry || p.role === "OPS_ADMIN"),
      ),
    [demoPersonas, selectedCountry],
  );

  return (
    <div dir={isRtl ? "rtl" : "ltr"} className="space-y-4">
      <WorkspaceHeader
        title={t("pro.heading")}
        prefixMeta={<span>{copy.careRegionPrefix}</span>}
        countryCode={selectedCountry}
        countryName={formatCountryDisplayName(
          selectedCountry,
          activePack?.name ?? selectedCountry,
          locale,
        )}
        currencyCode={activePack?.currencyCode ?? selectedCountry}
        emergencyHotline={activePack?.emergencyHotlines.ambulance ?? ""}
        extraMeta={
          <span>
            {copy.licenseExampleLabel}{" "}
            <code
              dir="ltr"
              className="rounded bg-slate-100 px-1.5 py-0.5 font-mono-tabular text-[11px] text-slate-800"
            >
              {getLicenseExample(selectedCountry)}
            </code>
          </span>
        }
        user={currentUser}
        hideGuestSignIn
        portalHref="/pro"
        onSignOut={handleSignOut}
      />

      {/* Enterprise Staff Onboarding Status or Active Workspace Banner */}
      {currentUser && isStaffWorkerRole(currentUser.role) ? (
        isPendingStaffVerification(currentUser) ? (
          <section
            aria-label={copy.onboarding.ariaLabel}
            className="space-y-4 rounded-2xl border border-amber-300 bg-amber-50/70 p-5 shadow-xs"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-200/80 text-amber-950">
                  <ShieldAlert className="h-5 w-5" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-bold uppercase tracking-wider text-amber-900">
                    {copy.onboarding.checklistPrefix}{" "}
                    {formatRoleLabel(currentUser.role, locale)}
                  </p>
                  <h2 className="text-base font-bold text-slate-900">
                    {copy.onboarding.headline}
                  </h2>
                  <p className="mt-0.5 text-xs text-slate-700">
                    {getPortalOnboardingSummary(copy, currentUser.role)}
                  </p>
                </div>
              </div>

              <button
                type="button"
                disabled={busy}
                onClick={() => void handleRefreshVerificationStatus()}
                className="inline-flex min-h-[42px] shrink-0 items-center justify-center gap-1.5 rounded-xl bg-[#0066CC] px-4 py-2 text-xs font-semibold text-white hover:bg-[#0052A3] disabled:opacity-50"
              >
                <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{copy.onboarding.refreshBtn}</span>
              </button>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-xl border border-emerald-200 bg-white p-3 text-xs">
                <p className="font-bold text-emerald-800">
                  {copy.onboarding.step1Title}
                </p>
                <p className="mt-1 text-slate-600">
                  {copy.onboarding.step1Body(currentUser.fullName)}
                </p>
              </div>

              <div className="rounded-xl border border-amber-200 bg-white p-3 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-bold text-slate-900">
                    {copy.onboarding.step2Title}
                  </p>
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 font-mono-tabular text-[10px] font-bold text-amber-900">
                    {copy.onboarding.step2UploadedCount(myUserMedia.length)}
                  </span>
                </div>
                <p className="mt-1 text-slate-600">
                  {copy.onboarding.step2BodyPrefix}{" "}
                  <a
                    href="#user-cred-category"
                    className="font-semibold text-[#0066CC] underline underline-offset-2"
                  >
                    {copy.onboarding.step2LinkText}
                  </a>{" "}
                  {copy.onboarding.step2BodySuffix}
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-3 text-xs">
                <p className="font-bold text-slate-900">
                  {copy.onboarding.step3Title}
                </p>
                {currentUser.role === "DRIVER" ? (
                  <p className="mt-1 text-slate-600">
                    {copy.onboarding.step3DriverBody}
                  </p>
                ) : (
                  <form onSubmit={handleSaveWorkplace} className="mt-1.5 space-y-2">
                    <EntityPicker
                      id="pending-workplace-facility"
                      label={copy.onboarding.step3SelectAria}
                      value={workplaceFacilityId}
                      onChange={setWorkplaceFacilityId}
                      placeholder={copy.onboarding.step3SelectPlaceholder}
                      emptyLabel={copy.onboarding.step3SelectPlaceholder}
                      options={facilities.map((fac) => ({
                        id: fac.id,
                        label: fac.name,
                        sublabel: `${formatFacilityKind(fac.kind, locale)} · ${fac.address}`,
                      }))}
                    />
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        type="submit"
                        disabled={busy || !workplaceFacilityId}
                        className="min-h-[36px] rounded-xl bg-[#0066CC] px-3.5 py-1 text-[11px] font-semibold text-white hover:bg-[#0052A3] disabled:opacity-50"
                      >
                        {copy.onboarding.saveWorkplaceBtn}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setActiveTab("facility");
                          setShowAccountSwitchForms(true);
                        }}
                        className="min-h-[36px] rounded-xl bg-[#F3F8FD] border border-[#D7E4F2] px-3 py-1 text-[11px] font-semibold text-slate-700 hover:text-[#0066CC]"
                      >
                        {copy.onboarding.addOwnPlaceBtn}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          </section>
        ) : (
          (() => {
            const target = getRoleWorkspaceHref(currentUser.role, locale);
            return (
              <section className="flex flex-col justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 shadow-xs sm:flex-row sm:items-center">
                <div className="flex items-center gap-3">
                  <ShieldCheck
                    className="h-6 w-6 shrink-0 text-[#0066CC]"
                    aria-hidden="true"
                  />
                  <div>
                    <p className="text-sm font-bold text-emerald-950">
                      {copy.onboarding.verifiedTitle}
                    </p>
                    <p className="text-xs text-emerald-900/90">
                      {copy.onboarding.verifiedBody(
                        formatRoleLabel(currentUser.role, locale),
                      )}
                    </p>
                  </div>
                </div>
                <Link
                  href={target.href}
                  className="inline-flex min-h-[42px] shrink-0 items-center justify-center rounded-xl bg-[#0066CC] px-5 py-2 text-xs font-semibold text-white hover:bg-[#0052A3]"
                >
                  {target.label}
                </Link>
              </section>
            );
          })()
        )
      ) : null}

      <div className="grid gap-4 lg:grid-cols-12">
        {/* Left Column: Staff Enterprise Workflows ONLY */}
        <section className="min-w-0 rounded-2xl border border-[#D7E4F2] bg-white p-5 sm:p-6 lg:col-span-7">
          {currentUser && sessionToken && !showAccountSwitchForms ? (
            <AccountProfileSecurityCard
              apiBaseUrl={apiBaseUrl}
              token={sessionToken}
              user={currentUser}
              facilities={facilities}
              onSessionUpdated={(auth, msgText) => {
                writeStoredSession(auth);
                setSessionToken(auth.token);
                setCurrentUser(auth.user);
                if (msgText) setStatusMessage({ tone: "success", text: msgText });
              }}
              onUserUpdated={(updatedUser, msgText) => {
                writeStoredSession({ token: sessionToken, user: updatedUser });
                setCurrentUser(updatedUser);
                setWorkplaceFacilityId(updatedUser.facilityId ?? "");
                if (msgText) setStatusMessage({ tone: "success", text: msgText });
              }}
              onOpenSwitchAccount={() => setShowAccountSwitchForms(true)}
              onSignOut={handleSignOut}
            />
          ) : (
            <>
              {currentUser ? (
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs">
                  <span className="font-medium text-slate-700">
                    {copy.signedInAs()} <strong>{currentUser.fullName}</strong>
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowAccountSwitchForms(false)}
                    className="inline-flex items-center gap-1 font-semibold text-[#0066CC] hover:underline"
                  >
                    <span aria-hidden="true" className="inline-block rtl:rotate-180">
                      ←
                    </span>
                    <span>{copy.backToProfile}</span>
                  </button>
                </div>
              ) : null}

              {/* Staff Workflow Tabs ONLY */}
              <div
                role="tablist"
                aria-label={copy.workflowTabsAriaLabel}
                className="grid grid-cols-2 gap-1 rounded-xl border border-[#D7E4F2] bg-[#E8F1FA] p-1 sm:grid-cols-4"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === "signin"}
                  onClick={() => setActiveTab("signin")}
                  className={`flex min-h-[38px] items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold ${
                    activeTab === "signin"
                      ? "bg-[#0066CC] text-white"
                      : "text-[#4A4843] hover:bg-white hover:text-[#0F243E]"
                  }`}
                >
                  <KeyRound className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span>{copy.tabs.signin}</span>
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === "register"}
                  onClick={() => setActiveTab("register")}
                  className={`flex min-h-[38px] items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold ${
                    activeTab === "register"
                      ? "bg-[#0066CC] text-white"
                      : "text-[#4A4843] hover:bg-white hover:text-[#0F243E]"
                  }`}
                >
                  <UserPlus className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span>{copy.tabs.register}</span>
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === "facility"}
                  onClick={() => setActiveTab("facility")}
                  className={`flex min-h-[38px] items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold ${
                    activeTab === "facility"
                      ? "bg-[#0066CC] text-white"
                      : "text-[#4A4843] hover:bg-white hover:text-[#0F243E]"
                  }`}
                >
                  <Building2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span>{copy.tabs.facility}</span>
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === "recovery"}
                  onClick={() => setActiveTab("recovery")}
                  className={`flex min-h-[38px] items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold ${
                    activeTab === "recovery"
                      ? "bg-[#0066CC] text-white"
                      : "text-[#4A4843] hover:bg-white hover:text-[#0F243E]"
                  }`}
                >
                  <ShieldCheck className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span>{t("portal.recoveryTab")}</span>
                </button>
              </div>

              {activeTab === "signin" ? (
                <form onSubmit={handleLoginSubmit} className="mt-6 space-y-4">
                  <div className="rounded-xl bg-[#F3F8FD] border border-[#D7E4F2] px-4 py-3 text-xs text-slate-700">
                    {copy.staffSignin.introPrefix}{" "}
                    <Link
                      href="/portal"
                      className="font-semibold text-[#0066CC] underline underline-offset-2"
                    >
                      {copy.staffSignin.introLink}
                    </Link>{" "}
                    {copy.staffSignin.introSuffix}
                  </div>
                  <div>
                    <label
                      htmlFor="login-email"
                      className="block text-xs font-semibold uppercase tracking-wider text-slate-700"
                    >
                      {copy.staffSignin.workIdentifierLabel}
                    </label>
                    <input
                      id="login-email"
                      type="text"
                      dir="ltr"
                      autoComplete="username"
                      required
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      placeholder={copy.staffSignin.workIdentifierPlaceholder}
                      className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#0066CC] focus:outline-none focus:ring-2 focus:ring-[#0066CC]/20"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="login-password"
                      className="block text-xs font-semibold uppercase tracking-wider text-slate-700"
                    >
                      {copy.staffSignin.passwordLabel}
                    </label>
                    <div className="relative mt-1.5">
                      <input
                        id="login-password"
                        type={showStaffPassword ? "text" : "password"}
                        required
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        placeholder="••••••••••••"
                        className="w-full rounded-xl border border-slate-300 bg-white py-2.5 ps-3.5 pe-10 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#0066CC] focus:outline-none focus:ring-2 focus:ring-[#0066CC]/20"
                      />
                      <button
                        type="button"
                        aria-label={
                          showStaffPassword
                            ? copy.staffSignin.hideCharsAria
                            : copy.staffSignin.revealCharsAria
                        }
                        title={copy.staffSignin.togglePwTitle}
                        onClick={() => setShowStaffPassword((p) => !p)}
                        className="absolute inset-y-0 end-2 inline-flex items-center px-1.5 text-slate-500 hover:text-slate-800"
                      >
                        {showStaffPassword ? (
                          <EyeOff className="h-4 w-4" aria-hidden="true" />
                        ) : (
                          <Eye className="h-4 w-4" aria-hidden="true" />
                        )}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={busy}
                    className="min-h-[44px] w-full rounded-xl bg-[#0066CC] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#0052A3] active:scale-[0.99] disabled:opacity-60"
                  >
                    {busy ? copy.staffSignin.submittingBtn : copy.staffSignin.submitBtn}
                  </button>
                </form>
              ) : null}

              {activeTab === "register" ? (
                <form onSubmit={handleRegisterSubmit} className="mt-4 space-y-4">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                        {copy.staffRegister.chooseFieldPrefix} {copy.roleLabels[regRole]}
                      </p>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <MoroccanComplianceBadge
                          domain={
                            regRole === "PHARMACIST"
                              ? "pharmacy"
                              : regRole === "LAB_TECH"
                                ? "lab"
                                : regRole === "NURSE"
                                  ? "nurse"
                                  : regRole === "DRIVER"
                                    ? "driver"
                                    : regRole === "HOSPITAL_ADMIN" || regRole === "CLINIC_STAFF"
                                      ? "hospital"
                                      : "doctor"
                          }
                          locale={locale}
                        />
                        <span className="rounded-xl border border-amber-300 bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-950">
                          {copy.staffRegister.adminVerificationRequired}
                        </span>
                      </div>
                    </div>
                    <div className="relative">
                      <select
                        id="reg-role"
                        aria-label={copy.staffRegister.accountTypeLabel}
                        tabIndex={-1}
                        value={regRole}
                        onChange={(e) => setRegRole(e.target.value as StaffWorkerRole)}
                        className="pointer-events-none absolute inset-0 h-full w-full opacity-0"
                      >
                        {STAFF_WORKER_ROLES.map((roleOption) => (
                          <option key={roleOption} value={roleOption}>
                            {copy.roleLabels[roleOption]}
                          </option>
                        ))}
                      </select>
                      <div
                        role="radiogroup"
                        aria-label={copy.staffRegister.roleCardsAria}
                        className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3"
                      >
                        {STAFF_WORKER_ROLES.map((roleOption) => {
                          const selected = regRole === roleOption;
                          return (
                            <button
                              key={roleOption}
                              type="button"
                              role="radio"
                              aria-checked={selected}
                              onClick={() => setRegRole(roleOption)}
                              className={`flex flex-col items-start rounded-xl p-3 text-start transition-colors active:scale-[0.99] ${
                                selected
                                  ? "bg-[#EBF4FF] ring-2 ring-[#0066CC]"
                                  : "bg-[#F3F8FD] border border-[#D7E4F2] hover:bg-[#E1EBF2]"
                              }`}
                            >
                              <div className="flex w-full items-center justify-between gap-1.5">
                                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-900">
                                  <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-white text-[#0066CC] shadow-2xs">
                                    {renderStaffRoleIcon(roleOption, "h-3.5 w-3.5")}
                                  </span>
                                  <span>{copy.roleLabels[roleOption]}</span>
                                </span>
                                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-900">
                                  {copy.staffRegister.adminVerifiedPill}
                                </span>
                              </div>
                              <span className="mt-1.5 text-[11px] leading-snug text-slate-600">
                                {copy.roleSummaries[roleOption]}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="reg-fullname"
                      className="block text-xs font-semibold uppercase tracking-wider text-slate-700"
                    >
                      {copy.staffRegister.fullLegalNameLabel}
                    </label>
                    <input
                      id="reg-fullname"
                      type="text"
                      required
                      value={regFullName}
                      onChange={(e) => setRegFullName(e.target.value)}
                      placeholder={copy.staffRegister.fullNamePlaceholder}
                      className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#0066CC] focus:outline-none focus:ring-2 focus:ring-[#0066CC]/20"
                    />
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label
                        htmlFor="reg-email"
                        className="block text-xs font-semibold uppercase tracking-wider text-slate-700"
                      >
                        {copy.staffRegister.workEmailRequiredLabel}
                      </label>
                      <input
                        id="reg-email"
                        type="email"
                        dir="ltr"
                        required
                        value={regEmail}
                        onChange={(e) => setRegEmail(e.target.value)}
                        placeholder={copy.staffRegister.workEmailPlaceholder}
                        className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#0066CC] focus:outline-none focus:ring-2 focus:ring-[#0066CC]/20"
                      />
                      <p className="mt-1 text-[11px] text-slate-600">
                        {copy.staffRegister.staffEmailHint}
                      </p>
                    </div>

                    <div>
                      <label
                        htmlFor="reg-phone"
                        className="block text-xs font-semibold uppercase tracking-wider text-slate-700"
                      >
                        {copy.staffRegister.mobilePhoneLabel}
                      </label>
                      <input
                        id="reg-phone"
                        type="tel"
                        dir="ltr"
                        value={regPhone}
                        onChange={(e) => setRegPhone(e.target.value)}
                        placeholder="+212600112233"
                        className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#0066CC] focus:outline-none focus:ring-2 focus:ring-[#0066CC]/20"
                      />
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="reg-password"
                      className="block text-xs font-semibold uppercase tracking-wider text-slate-700"
                    >
                      {copy.staffRegister.passwordMin8Label}
                    </label>
                    <input
                      id="reg-password"
                      type="password"
                      required
                      minLength={8}
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      placeholder={copy.staffRegister.passwordMin8Placeholder}
                      className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#0066CC] focus:outline-none focus:ring-2 focus:ring-[#0066CC]/20"
                    />
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs text-slate-700">
                    <p>
                      {copy.staffRegister.registeredForPrefix}{" "}
                      <strong className="font-semibold text-slate-900">
                        {formatCountryDisplayName(
                          selectedCountry,
                          selectedCountry,
                          locale,
                        )}
                      </strong>{" "}
                      {copy.staffRegister.networkSuffix}{" "}
                      {regRole === "DOCTOR"
                        ? copy.staffRegister.noteDoctor
                        : regRole === "DRIVER"
                          ? copy.staffRegister.noteDriver
                          : copy.staffRegister.noteStaff}
                    </p>
                  </div>

                  <PrivacyConsentCheckbox
                    id="pro-staff-consent"
                    checked={acceptedStaffTerms}
                    onChange={setAcceptedStaffTerms}
                    scope="STAFF"
                  />

                  <button
                    type="submit"
                    disabled={busy || !acceptedStaffTerms}
                    className="min-h-[44px] w-full rounded-xl bg-[#0066CC] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#0052A3] active:scale-[0.99] disabled:opacity-60"
                  >
                    {busy ? copy.staffRegister.submittingBtn : copy.staffRegister.submitBtn}
                  </button>
                </form>
              ) : null}

              {activeTab === "facility" ? (
                <form onSubmit={handleFacilitySubmit} className="mt-6 space-y-4">
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                        {copy.facilityForm.sectorLabel}
                      </span>
                      <MoroccanComplianceBadge
                        domain={
                          facKind === "PHARMACY"
                            ? "pharmacy"
                            : facKind === "DIAGNOSTIC_LAB"
                              ? "lab"
                              : "hospital"
                        }
                        locale={locale}
                      />
                    </div>

                    <div className="relative">
                      <select
                        id="fac-kind"
                        aria-label={copy.facilityForm.sectorLabel}
                        tabIndex={-1}
                        value={facKind}
                        onChange={(e) => setFacKind(e.target.value as FacilityKind)}
                        className="pointer-events-none absolute inset-0 h-full w-full opacity-0"
                      >
                        {FacilityKindSchema.options.map((kindOption) => (
                          <option key={kindOption} value={kindOption}>
                            {locale === "en"
                              ? FACILITY_KIND_LABELS[kindOption]
                              : formatFacilityKind(kindOption, locale)}
                          </option>
                        ))}
                      </select>
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                        {FacilityKindSchema.options.map((kindOption) => {
                          const selected = facKind === kindOption;
                          const Icon =
                            kindOption === "HOSPITAL"
                              ? Hospital
                              : kindOption === "PHARMACY"
                                ? Pill
                                : kindOption === "DIAGNOSTIC_LAB"
                                  ? FlaskConical
                                  : Building2;
                          const codeHint =
                            kindOption === "HOSPITAL"
                              ? "MA-HOSP-"
                              : kindOption === "PHARMACY"
                                ? "MA-PHARM-"
                                : kindOption === "DIAGNOSTIC_LAB"
                                  ? "MA-LAB-"
                                  : "MA-CLIN-";
                          return (
                            <button
                              key={kindOption}
                              type="button"
                              aria-pressed={selected}
                              onClick={() => setFacKind(kindOption)}
                              className={`flex flex-col items-start gap-1 rounded-xl border p-2.5 text-start transition-all active:scale-[0.98] ${
                                selected
                                  ? "border-[#0066CC] bg-[#EBF4FF] text-[#0052A3] ring-2 ring-[#0066CC]/25"
                                  : "border-[#D7E4F2] bg-[#F3F8FD] text-[#0F243E] hover:bg-white"
                              }`}
                            >
                              <Icon className="h-4 w-4 text-[#0066CC]" aria-hidden="true" />
                              <span className="text-xs font-bold leading-tight">
                                {locale === "en"
                                  ? FACILITY_KIND_LABELS[kindOption]
                                  : formatFacilityKind(kindOption, locale)}
                              </span>
                              <span
                                dir="ltr"
                                className="font-mono-tabular text-[10px] font-semibold text-slate-500"
                              >
                                {codeHint}XXXXX
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div>
                      <label
                        htmlFor="fac-name"
                        className="block text-xs font-semibold uppercase tracking-wider text-slate-700"
                      >
                        {copy.facilityForm.officialNameLabel}
                      </label>
                      <input
                        id="fac-name"
                        type="text"
                        required
                        value={facName}
                        onChange={(e) => setFacName(e.target.value)}
                        placeholder={copy.facilityForm.officialNamePlaceholder}
                        className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#0066CC] focus:outline-none focus:ring-2 focus:ring-[#0066CC]/20"
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between">
                      <label
                        htmlFor="fac-license"
                        className="block text-xs font-semibold uppercase tracking-wider text-slate-700"
                      >
                        {copy.facilityForm.ministryLicenseLabel(selectedCountry)}
                      </label>
                      {facLicense.trim().length > 0 ? (
                        <span
                          className={`text-xs font-semibold ${
                            licenseMatchesPack ? "text-[#0066CC]" : "text-red-700"
                          }`}
                        >
                          {licenseMatchesPack
                            ? copy.facilityForm.validFormat
                            : copy.facilityForm.checkFormat(
                                getLicenseExample(selectedCountry),
                              )}
                        </span>
                      ) : null}
                    </div>
                    <input
                      id="fac-license"
                      type="text"
                      dir="ltr"
                      required
                      value={facLicense}
                      onChange={(e) => setFacLicense(e.target.value)}
                      placeholder={getLicenseExample(selectedCountry)}
                      className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 font-mono-tabular text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#0066CC] focus:outline-none focus:ring-2 focus:ring-[#0066CC]/20"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="fac-address"
                      className="block text-xs font-semibold uppercase tracking-wider text-slate-700"
                    >
                      {copy.facilityForm.streetAddressLabel}
                    </label>
                    <input
                      id="fac-address"
                      type="text"
                      required
                      value={facAddress}
                      onChange={(e) => setFacAddress(e.target.value)}
                      placeholder={copy.facilityForm.streetAddressPlaceholder}
                      className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#0066CC] focus:outline-none focus:ring-2 focus:ring-[#0066CC]/20"
                    />
                  </div>

                  <div className="space-y-2 rounded-xl border border-[#D7E4F2] bg-[#F3F8FD] p-3.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#0F243E]">
                        <MapPin className="h-3.5 w-3.5 text-[#0066CC]" aria-hidden="true" />
                        <span>
                          {locale === "ar"
                            ? "المدينة والموقع الجغرافي (المغرب)"
                            : locale === "fr"
                              ? "Ville & Position GPS (Maroc)"
                              : "City & GPS Pin (Morocco)"}
                        </span>
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          if (typeof navigator === "undefined" || !navigator.geolocation) {
                            setStatusMessage({
                              tone: "info",
                              text:
                                locale === "ar"
                                  ? "اختر مدينتك المغربية من القائمة أدناه."
                                  : locale === "fr"
                                    ? "Sélectionnez votre ville marocaine ci-dessous."
                                    : "Select your Moroccan city preset below.",
                            });
                            return;
                          }
                          navigator.geolocation.getCurrentPosition(
                            (pos) => {
                              setFacLat(pos.coords.latitude.toFixed(4));
                              setFacLng(pos.coords.longitude.toFixed(4));
                            },
                            () => {
                              setStatusMessage({
                                tone: "info",
                                text:
                                  locale === "ar"
                                    ? "تعذر تحديد GPS تلقائياً — اختر مدينتك أدناه."
                                    : locale === "fr"
                                      ? "GPS indisponible — sélectionnez une ville ci-dessous."
                                      : "GPS permission declined — pick a Moroccan city below.",
                              });
                            },
                          );
                        }}
                        className="inline-flex items-center gap-1 rounded-full border border-[#D7E4F2] bg-white px-2.5 py-1 text-[11px] font-semibold text-[#0066CC] hover:bg-[#EBF4FF]"
                      >
                        <LocateFixed className="h-3 w-3" aria-hidden="true" />
                        <span>
                          {locale === "ar"
                            ? "موقعي الحالي"
                            : locale === "fr"
                              ? "Ma position GPS"
                              : "Use Current GPS"}
                        </span>
                      </button>
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      {MOROCCAN_CITIES.map((city) => {
                        const isCitySelected =
                          facLat.trim() !== "" &&
                          facLng.trim() !== "" &&
                          Math.abs(Number(facLat) - city.lat) < 0.01 &&
                          Math.abs(Number(facLng) - city.lng) < 0.01;
                        return (
                          <button
                            key={city.id}
                            type="button"
                            onClick={() => {
                              setFacLat(city.lat.toFixed(4));
                              setFacLng(city.lng.toFixed(4));
                            }}
                            className={`rounded-full px-3 py-1 text-xs font-semibold transition-all active:scale-[0.98] ${
                              isCitySelected
                                ? "bg-[#0066CC] text-white shadow-xs"
                                : "border border-[#D7E4F2] bg-white text-[#0F243E] hover:border-[#0066CC] hover:text-[#0066CC]"
                            }`}
                          >
                            {city.labels[locale]}
                          </button>
                        );
                      })}
                    </div>

                    <details className="pt-1">
                      <summary className="cursor-pointer select-none text-[11px] font-semibold text-slate-600 hover:text-[#0066CC]">
                        {locale === "ar"
                          ? `ضبط الإحداثيات الدقيقة (${facLat}, ${facLng})`
                          : locale === "fr"
                            ? `Affiner coordonnées GPS (${facLat}, ${facLng})`
                            : `Fine-tune GPS coordinates (${facLat}, ${facLng})`}
                      </summary>
                      <div className="mt-2 grid gap-3 sm:grid-cols-2">
                        <div>
                          <label
                            htmlFor="fac-lat"
                            className="block text-[11px] font-semibold uppercase tracking-wider text-slate-600"
                          >
                            {copy.facilityForm.latLabel}
                          </label>
                          <input
                            id="fac-lat"
                            type="number"
                            dir="ltr"
                            step="any"
                            placeholder={copy.facilityForm.latPlaceholder}
                            value={facLat}
                            onChange={(e) => setFacLat(e.target.value)}
                            className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 font-mono-tabular text-xs text-slate-900 placeholder:text-slate-400 focus:border-[#0066CC] focus:outline-none focus:ring-2 focus:ring-[#0066CC]/20"
                          />
                        </div>
                        <div>
                          <label
                            htmlFor="fac-lng"
                            className="block text-[11px] font-semibold uppercase tracking-wider text-slate-600"
                          >
                            {copy.facilityForm.lngLabel}
                          </label>
                          <input
                            id="fac-lng"
                            type="number"
                            dir="ltr"
                            step="any"
                            placeholder={copy.facilityForm.lngPlaceholder}
                            value={facLng}
                            onChange={(e) => setFacLng(e.target.value)}
                            className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 font-mono-tabular text-xs text-slate-900 placeholder:text-slate-400 focus:border-[#0066CC] focus:outline-none focus:ring-2 focus:ring-[#0066CC]/20"
                          />
                        </div>
                      </div>
                    </details>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <FileUploadDropzone
                      id="fac-license-file"
                      label={copy.facilityForm.licenseProofLabel}
                      hint={copy.facilityForm.licenseProofHint}
                      accept={ALLOWED_CERTIFICATION_MIME_TYPES.join(",")}
                      maxBytes={MAX_MEDIA_UPLOAD_BYTES}
                      selectedFile={facLicenseFile}
                      progressPercent={facUploadProgress}
                      disabled={busy}
                      onFileSelected={setFacLicenseFile}
                    />
                    <FileUploadDropzone
                      id="fac-photo-file"
                      label={copy.facilityForm.photoLabel}
                      hint={copy.facilityForm.photoHint}
                      accept={ALLOWED_AVATAR_MIME_TYPES.join(",")}
                      maxBytes={MAX_MEDIA_UPLOAD_BYTES}
                      selectedFile={facPhotoFile}
                      progressPercent={null}
                      disabled={busy}
                      onFileSelected={setFacPhotoFile}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={busy}
                    className="min-h-[44px] w-full rounded-xl bg-[#0066CC] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#0052A3] active:scale-[0.99] disabled:opacity-60"
                  >
                    {busy ? copy.facilityForm.submittingBtn : copy.facilityForm.submitBtn}
                  </button>
                </form>
              ) : null}

              {activeTab === "recovery" ? (
                <div className="mt-6">
                  <AccountRecoveryPanel
                    apiBaseUrl={apiBaseUrl}
                    initialEmail={currentUser?.email ?? ""}
                    defaultPurpose="VERIFY_EMAIL"
                    placeholderEmail="dr.karim@clinique.ma"
                    busy={busy}
                    onBusyChange={setBusy}
                    onFeedback={(status) => setStatusMessage(status)}
                    onPasswordResetComplete={(email) => {
                      setActiveTab("signin");
                      setLoginEmail(email);
                    }}
                    onContactVerified={(updated) => {
                      if (sessionToken && currentUser?.id === updated.id) {
                        setCurrentUser(updated);
                        writeStoredSession({ token: sessionToken, user: updated });
                      }
                    }}
                  />
                </div>
              ) : null}
            </>
          )}
        </section>

        {/* Right Column: Staff Quick Demo Accounts, Personal Credentials & Facilities Registry */}
        <aside className="min-w-0 space-y-4 lg:col-span-5">
          {process.env.NEXT_PUBLIC_HIDE_DEMO_ACCOUNTS !== "true" &&
          staffDemoPersonas.length > 0 ? (
            <section className="rounded-2xl border border-[#D7E4F2] bg-white p-5">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-600">
                  {copy.aside.demoTitle(selectedCountry)}
                </h2>
                <span className="text-[11px] font-medium text-slate-500">
                  {copy.aside.oneClickSwitch}
                </span>
              </div>
              <div className="grid min-w-0 w-full gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                {staffDemoPersonas.map((persona) => (
                  <div
                    key={persona.id}
                    className="flex min-w-0 w-full items-center gap-2 overflow-hidden rounded-xl border border-[#D7E4F2] bg-[#F3F8FD] p-2.5  transition-all hover:bg-emerald-50/40 hover:ring-2 hover:ring-emerald-600/30"
                  >
                    <EntityAvatar
                      name={persona.fullName}
                      role={persona.role}
                      subtitle={`${formatRoleLabel(persona.role, locale)} · ${persona.countryCode}`}
                      size="sm"
                    />
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        setLoginEmail(persona.email);
                        setLoginPassword(persona.demoPassword);
                        void executeStaffLogin(persona.email, persona.demoPassword);
                      }}
                      className="min-w-0 flex-1 text-start focus:outline-none disabled:opacity-60"
                    >
                      <div className="flex min-w-0 flex-wrap items-center justify-between gap-1">
                        <span className="truncate text-xs font-semibold text-slate-900">
                          {persona.fullName}
                        </span>
                        <span className="shrink-0 rounded-full bg-[#E8F1FA] px-2 py-0.5 text-[10px] font-semibold text-[#0066CC]">
                          {formatRoleLabel(persona.role, locale)}
                        </span>
                      </div>
                      <p className="mt-0.5 truncate text-[11px] text-slate-600">
                        {persona.headline}
                      </p>
                    </button>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {currentUser ? (
            <section className="rounded-2xl border border-[#D7E4F2] bg-white p-5">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-slate-950">
                  {copy.aside.signedInProfileTitle}
                </h2>
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="inline-flex items-center gap-1 rounded-xl bg-white px-3 py-1 text-xs font-medium text-slate-700 shadow-2xs hover:text-rose-700"
                >
                  <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>{copy.aside.signOutBtn}</span>
                </button>
              </div>
              <div className="mt-4 space-y-4">
                {isStaffWorkerRole(currentUser.role) &&
                (currentUser.accountStatus === "PENDING_APPROVAL" ||
                  !currentUser.credentialVerified) ? (
                  <div
                    role="status"
                    className="flex items-start gap-3 rounded-xl bg-amber-50 p-3.5 text-amber-950"
                  >
                    <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#D7E4F2] bg-[#F3F8FD] text-amber-800 ">
                      <ShieldAlert className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-bold uppercase tracking-wider text-amber-900">
                        {copy.aside.pendingTitle}
                      </p>
                      <p className="mt-0.5 text-xs leading-relaxed text-amber-900/90">
                        {copy.aside.pendingBody(
                          formatRoleLabel(currentUser.role, locale),
                        )}
                      </p>
                    </div>
                  </div>
                ) : isStaffWorkerRole(currentUser.role) ? (
                  <div className="flex items-center gap-2.5 rounded-xl bg-emerald-50 px-3.5 py-2.5 text-xs font-semibold text-emerald-900">
                    <ShieldCheck
                      className="h-4 w-4 shrink-0 text-[#0066CC]"
                      aria-hidden="true"
                    />
                    <span>{copy.aside.verifiedStaffBanner}</span>
                  </div>
                ) : null}

                <div className="flex items-center justify-between gap-3 rounded-xl border border-[#D7E4F2] bg-[#F3F8FD] p-3.5 ">
                  <div className="flex min-w-0 items-center gap-3">
                    <EntityAvatar
                      name={currentUser.fullName}
                      role={currentUser.role}
                      avatarUrl={currentUser.avatarUrl}
                      size="lg"
                    />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900">
                        <bdi dir="auto">{currentUser.fullName}</bdi>
                      </p>
                      <p className="text-xs font-semibold text-[#0066CC]">
                        {formatRoleLabel(currentUser.role, locale)} ·{" "}
                        {currentUser.countryCode}
                      </p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                            currentUser.emailVerified
                              ? "bg-emerald-50 text-emerald-800"
                              : "bg-slate-100 text-slate-700"
                          }`}
                        >
                          {currentUser.emailVerified
                            ? copy.aside.emailVerified
                            : copy.aside.emailUnverified}
                        </span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                            currentUser.phoneVerified
                              ? "bg-emerald-50 text-emerald-800"
                              : "bg-slate-100 text-slate-700"
                          }`}
                        >
                          {currentUser.phoneVerified
                            ? copy.aside.phoneVerified
                            : copy.aside.phoneUnverified}
                        </span>
                      </div>
                    </div>
                  </div>

                  <label className="inline-flex min-h-[34px] shrink-0 cursor-pointer items-center gap-1.5 rounded-xl bg-[#F3F8FD] border border-[#D7E4F2] px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-emerald-50 hover:text-[#0066CC]">
                    <Camera className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>
                      {avatarProgress !== null
                        ? `${avatarProgress}%`
                        : copy.aside.photoBtn}
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

                <ProfileCredentialsPanel
                  key={currentUser.id}
                  apiBaseUrl={apiBaseUrl}
                  token={sessionToken ?? ""}
                  userRole={currentUser.role}
                  documents={myUserMedia}
                  busy={busy}
                  onBusyChange={setBusy}
                  onDocumentsUpdated={async () => {
                    if (sessionToken) {
                      await refreshMyUserMedia(sessionToken);
                    }
                  }}
                  onFeedback={(tone, text) => setStatusMessage({ tone, text })}
                />
              </div>
            </section>
          ) : null}

          {currentUser || facilities.length > 0 ? (
            <section className="rounded-2xl border border-[#D7E4F2] bg-white p-5">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-bold text-slate-950">
                  {t("portal.facilityRegistry")}
                </h2>
                {sessionToken && currentUser ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      void refreshScopedFacilities(
                        sessionToken,
                        currentUser.countryCode,
                      )
                    }
                    className="inline-flex items-center gap-1 rounded-xl bg-white px-3 py-1 text-xs font-medium text-slate-700 shadow-2xs hover:text-[#0066CC]"
                  >
                    <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>{copy.aside.refreshBtn}</span>
                  </button>
                ) : null}
              </div>

              {facilities.length === 0 ? (
                <p className="mt-2.5 text-xs text-slate-500">
                  {copy.aside.noFacilitiesInRegion}
                </p>
              ) : (
                <ul className="mt-4 space-y-3">
                  {facilities.map((facility) => (
                    <li
                      key={facility.id}
                      className="rounded-2xl border border-[#D7E4F2] bg-[#F3F8FD] p-4 "
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">
                            {facility.name}
                          </p>
                          <p className="mt-0.5 text-xs text-slate-600">
                            {formatFacilityKind(facility.kind, locale)} ·{" "}
                            {facility.licenseNumber}
                          </p>
                        </div>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                            facility.verificationStatus === "VERIFIED"
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          {facility.verificationStatus === "VERIFIED"
                            ? copy.aside.facilityVerified
                            : copy.aside.facilityPending}
                        </span>
                      </div>
                      <p className="mt-2 text-xs text-slate-600">
                        {facility.address}
                      </p>

                      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                        <span
                          dir="ltr"
                          className="font-mono-tabular text-[11px] text-slate-500"
                        >
                          {facility.lat.toFixed(4)}, {facility.lng.toFixed(4)}
                        </span>

                        <div className="flex flex-wrap items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => void handleLoadFacilityDocs(facility.id)}
                            className="rounded-md border border-slate-300 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 hover:border-teal-700"
                          >
                            {copy.aside.docsBtn}
                          </button>

                          {currentUser?.id === facility.ownerUserId ||
                          currentUser?.role === "OPS_ADMIN" ? (
                            <label className="cursor-pointer rounded-md border border-slate-300 bg-white px-2 py-1 text-[11px] font-semibold text-teal-800 hover:border-teal-700">
                              <span>{copy.aside.attachLicenseBtn}</span>
                              <input
                                type="file"
                                accept={ALLOWED_CERTIFICATION_MIME_TYPES.join(",")}
                                className="sr-only"
                                onChange={(e) =>
                                  void handleUploadExtraFacilityDoc(
                                    facility.id,
                                    "MINISTRY_LICENSE",
                                    e.target.files?.[0] ?? null,
                                  )
                                }
                              />
                            </label>
                          ) : null}

                          {currentUser?.role === "OPS_ADMIN" &&
                          facility.verificationStatus !== "VERIFIED" ? (
                            <button
                              type="button"
                              onClick={() => void handleVerifyFacility(facility.id)}
                              className="rounded-xl bg-[#0066CC] px-3 py-1 text-xs font-semibold text-white hover:bg-[#0052A3]"
                            >
                              {copy.aside.verifyFacilityBtn}
                            </button>
                          ) : null}
                        </div>
                      </div>

                      {facilityDocsByFac[facility.id] &&
                      facilityDocsByFac[facility.id]!.length > 0 ? (
                        <div className="mt-2.5 space-y-1 border-t border-slate-200 pt-2">
                          {facilityDocsByFac[facility.id]!.map((doc) => (
                            <div
                              key={doc.id}
                              className="flex items-center justify-between gap-2 rounded border border-slate-200 bg-white px-2 py-1 text-[11px]"
                            >
                              <span className="inline-flex min-w-0 items-center gap-1.5 truncate">
                                <FileText
                                  className="h-3 w-3 shrink-0 text-teal-700"
                                  aria-hidden="true"
                                />
                                <span className="truncate font-medium text-slate-800">
                                  {doc.fileName}
                                </span>
                                <span className="font-mono-tabular text-slate-500">
                                  ({formatByteSize(doc.sizeBytes)} ·{" "}
                                  {getReviewStatusLabel(copy, doc.reviewStatus)})
                                </span>
                              </span>
                              <button
                                type="button"
                                onClick={() =>
                                  openImage({
                                    src: doc.downloadUrl,
                                    downloadUrl: doc.downloadUrl,
                                    mimeType: doc.mimeType,
                                    alt: doc.fileName,
                                    title: doc.fileName,
                                    subtitle: `${doc.category} · ${getReviewStatusLabel(copy, doc.reviewStatus)}`,
                                    badge: getReviewStatusLabel(
                                      copy,
                                      doc.reviewStatus,
                                    ),
                                  })
                                }
                                className="font-semibold text-teal-800 hover:underline"
                              >
                                {copy.aside.previewBtn}
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
