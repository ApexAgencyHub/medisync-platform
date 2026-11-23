"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { isStaffWorkerRole, type AccountStatus } from "@medisync/contracts";
import { updateAdminUserStatus } from "../api-client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  DispatchStatusSchema,
  DisputeCategorySchema,
  LoginSchema,
  UserRoleSchema,
  type AdminOverviewMetrics,
  type AdminUserMediaItem,
  type AppointmentSummary,
  type AuditEvent,
  type AuthenticatedUser,
  type CountryPack,
  type DispatchRequestSummary,
  type DispatchStatus,
  type DisputeCategory,
  type DisputeSummary,
  type FacilityMediaDocument,
  type FacilitySummary,
  type LabOrderSummary,
  type PharmacyOrderSummary,
  type PrescriptionSummary,
  type UserMediaDocument,
  type UserRole,
} from "@medisync/contracts";
import {
  listFacilities,
  loginUser,
  verifyFacilityStatus,
} from "@/features/auth-portal";
import { fetchAppointments } from "@/features/booking";
import {
  fetchLabOrders,
  fetchPrescriptions,
} from "@/features/clinical-workspace";
import { listDispatchRequests } from "@/features/maps-dispatch";
import { listPharmacyOrders } from "@/features/pharmacy-commerce";
import {
  formatCountryDisplayName,
  formatDispatchStatus,
  formatFacilityKind,
  formatRoleLabel,
  formatUrgencyLabel,
} from "@/shared/i18n/human-labels";
import { useLocale } from "@/shared/i18n/locale-store";
import { ADMIN_COPY } from "../admin-i18n";
import {
  ACTIVE_COUNTRY_CODE,
  resolveActivePack,
} from "@/shared/config/deployment";
import { EntityAvatar } from "@/shared/ui/EntityAvatar";
import { useImageLightbox } from "@/shared/ui/ImageLightboxProvider";
import {
  StatStrip,
  UiTabBar,
  WorkspaceHeader,
  useToastSetter,
} from "@/shared/ui/primitives";
import {
  MoroccanComplianceBadge,
  TactilePillGroup,
} from "@/shared/ui/TactileControls";
import {
  formatByteSize,
  listAdminFacilityMedia,
  listAdminUserMedia,
  listAllAdminUserMedia,
  reviewFacilityMediaDocument,
  reviewUserMediaDocument,
} from "@/features/media-certifications";
import { checkBackendOnline } from "@/shared/api/directory-client";
import { EntityPicker } from "@/shared/ui/EntityPicker";
import {
  clearStoredSession,
  readStoredSession,
  revokeClientSession,
  writeStoredSession,
} from "@/shared/auth/session-storage";
import {
  canManageAdminOps,
  syncPendingSessionStatus,
} from "@/shared/auth/role-capabilities";
import { WorkspaceRoleGuard } from "@/shared/auth/WorkspaceRoleGuard";
import {
  isPendingStaffVerification,
  VerificationGateNotice,
} from "@/shared/ui/VerificationGateNotice";
import {
  Activity,
  AlertTriangle,
  Building2,
  Download,
  Eye,
  FileCheck2,
  FileText,
  KeyRound,
  Navigation,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  UserPlus,
  Users,
  X,
} from "lucide-react";
const AdminDocumentsValidationPanel = dynamic(
  () =>
    import("./AdminDocumentsValidationPanel").then(
      (m) => m.AdminDocumentsValidationPanel,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="h-64 w-full animate-pulse rounded-2xl border border-[#D7E4F2] bg-white" />
    ),
  },
);
const AdminProvisionUserModal = dynamic(
  () =>
    import("./AdminProvisionUserModal").then(
      (m) => m.AdminProvisionUserModal,
    ),
  { ssr: false },
);

const DynamicAdminOperationsTrackerPanel = dynamic(
  () =>
    import("./AdminOperationsTrackerPanel").then(
      (m) => m.AdminOperationsTrackerPanel,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="h-64 w-full animate-pulse rounded-2xl border border-[#D7E4F2] bg-white" />
    ),
  },
);
import {
  fetchAdminAuditEvents,
  fetchAdminOverview,
  fetchAdminUsers,
  fetchDisputesList,
  overrideDispatchRequest,
  resolveDisputeTicket,
  submitDisputeTicket,
  updateAdminUserRole,
} from "../api-client";

type AdminTab =
  | "overview"
  | "documents"
  | "facilities"
  | "users"
  | "dispatches"
  | "operations"
  | "disputes"
  | "audit";

interface AdminWorkspaceProps {
  packs: readonly CountryPack[];
  apiBaseUrl: string;
}

const ALL_ROLES = UserRoleSchema.options;
const ALL_DISPATCH_STATUSES = DispatchStatusSchema.options;
const ALL_DISPUTE_CATEGORIES = DisputeCategorySchema.options;

const ROLE_BADGE_COLORS: Record<UserRole, string> = {
  OPS_ADMIN: "border-teal-300 bg-teal-50 text-teal-900",
  HOSPITAL_ADMIN: "border-sky-300 bg-sky-50 text-sky-900",
  DOCTOR: "border-emerald-300 bg-emerald-50 text-emerald-900",
  NURSE: "border-rose-300 bg-rose-50 text-rose-900",
  PHARMACIST: "border-indigo-300 bg-indigo-50 text-indigo-900",
  LAB_TECH: "border-cyan-300 bg-cyan-50 text-cyan-900",
  CLINIC_STAFF: "border-slate-300 bg-slate-100 text-slate-800",
  DRIVER: "border-amber-300 bg-amber-50 text-amber-900",
  CAREGIVER: "border-slate-300 bg-slate-50 text-slate-700",
  PATIENT: "border-slate-200 bg-slate-50 text-slate-700",
};

export function AdminWorkspace({ packs, apiBaseUrl }: AdminWorkspaceProps) {
  const { locale, t, isRtl } = useLocale();
  const a = ADMIN_COPY[locale];
  const m = a.messages;
  const { openImage } = useImageLightbox();
  const defaultCode = resolveActivePack(packs)?.code ?? ACTIVE_COUNTRY_CODE;
  const [selectedScope, setSelectedScope] = useState<string>(defaultCode);
  const [activeTab, setActiveTab] = useState<AdminTab>("overview");

  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<AuthenticatedUser | null>(
    null,
  );
  const [sessionHydrated, setSessionHydrated] = useState(false);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  const [overview, setOverview] = useState<AdminOverviewMetrics | null>(null);
  const [facilities, setFacilities] = useState<FacilitySummary[]>([]);
  const [users, setUsers] = useState<AuthenticatedUser[]>([]);
  const [dispatches, setDispatches] = useState<DispatchRequestSummary[]>([]);
  const [disputes, setDisputes] = useState<DisputeSummary[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditEvent[]>([]);
  const [facilityMedia, setFacilityMedia] = useState<FacilityMediaDocument[]>(
    [],
  );
  const [adminUserMedia, setAdminUserMedia] = useState<AdminUserMediaItem[]>(
    [],
  );
  const [pharmacyOrders, setPharmacyOrders] = useState<PharmacyOrderSummary[]>(
    [],
  );
  const [appointments, setAppointments] = useState<AppointmentSummary[]>([]);
  const [prescriptions, setPrescriptions] = useState<PrescriptionSummary[]>([]);
  const [labOrders, setLabOrders] = useState<LabOrderSummary[]>([]);
  const [userMediaByUser, setUserMediaByUser] = useState<
    Record<string, UserMediaDocument[]>
  >({});
  const [apiOnline, setApiOnline] = useState(false);

  // User Role Governance Editor & Filter State
  const [roleDrafts, setRoleDrafts] = useState<Record<string, UserRole>>({});
  const [countryDrafts] = useState<Record<string, string>>({});
  const [facilityDrafts, setFacilityDrafts] = useState<Record<string, string>>(
    {},
  );
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editingDispatchId, setEditingDispatchId] = useState<string | null>(null);
  const [disputeComposerOpen, setDisputeComposerOpen] = useState(false);
  const [roleReason, setRoleReason] = useState("");
  const [userSearchQuery, setUserSearchQuery] = useState("");
  const [userStatusFilter, setUserStatusFilter] = useState<
    "ALL" | AccountStatus
  >("ALL");
  const [userRoleFilter, setUserRoleFilter] = useState<"ALL" | UserRole>("ALL");
  const [provisionModalOpen, setProvisionModalOpen] = useState(false);

  // Facility & Dispute Filtering State
  const [facilitySearchQuery, setFacilitySearchQuery] = useState("");
  const [facilityStatusFilter, setFacilityStatusFilter] = useState<
    "ALL" | "PENDING_REVIEW" | "VERIFIED" | "SUSPENDED"
  >("ALL");
  const [facilityKindFilter, setFacilityKindFilter] = useState<string>("ALL");
  const [disputeStatusFilter, setDisputeStatusFilter] = useState<string>("ALL");

  // Dispatch Override State
  const [overrideStatusDrafts, setOverrideStatusDrafts] = useState<
    Record<string, DispatchStatus>
  >({});
  const [overrideDriverDrafts, setOverrideDriverDrafts] = useState<
    Record<string, string>
  >({});
  const [overrideNotes, setOverrideNotes] = useState<Record<string, string>>({});

  // Dispute Filing & Resolution State
  const [disputeCategory, setDisputeCategory] =
    useState<DisputeCategory>("DISPATCH_DELAY");
  const [disputeSubject, setDisputeSubject] = useState("");
  const [disputeDescription, setDisputeDescription] = useState("");
  const [disputeTargetId, setDisputeTargetId] = useState("");
  const [resolutionDrafts, setResolutionDrafts] = useState<
    Record<string, string>
  >({});

  // Audit Filters
  const [auditActionFilter, setAuditActionFilter] = useState("");
  const [auditResourceFilter, setAuditResourceFilter] = useState("");
  const [signInModalOpen, setSignInModalOpen] = useState(false);

  const [busy, setBusy] = useState(false);
  const setBanner = useToastSetter();

  const isPendingStaff = isPendingStaffVerification(currentUser);
  const isOpsAdmin = currentUser?.role === "OPS_ADMIN" && !isPendingStaff;
  const isAdminViewer = canManageAdminOps(currentUser);

  const effectiveCountryQuery =
    currentUser && !isOpsAdmin
      ? currentUser.countryCode
      : selectedScope === "ALL"
        ? undefined
        : selectedScope;

  const activePack =
    packs.find((pack) => pack.code === (effectiveCountryQuery ?? ACTIVE_COUNTRY_CODE)) ??
    resolveActivePack(packs);

  useEffect(() => {
    if (!signInModalOpen) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setSignInModalOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [signInModalOpen]);

  useEffect(() => {
    const stored = readStoredSession();
    if (stored) {
      setSessionToken(stored.token);
      setCurrentUser(stored.user);
      setSelectedScope(
        stored.user.role === "OPS_ADMIN" ? defaultCode : stored.user.countryCode,
      );
    }
    setSessionHydrated(true);

    let cancelled = false;
    checkBackendOnline().then((online) => {
      if (cancelled) return;
      setApiOnline(online);
      if (online && stored && isPendingStaffVerification(stored.user)) {
        void syncPendingSessionStatus(apiBaseUrl, stored).then((syncRes) => {
          if (cancelled) return;
          if (syncRes.status === "expired") {
            setSessionToken(null);
            setCurrentUser(null);
          } else if (syncRes.status === "updated" && syncRes.session) {
            setCurrentUser(syncRes.session.user);
            setSelectedScope(
              syncRes.session.user.role === "OPS_ADMIN"
                ? defaultCode
                : syncRes.session.user.countryCode,
            );
          }
        });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [apiBaseUrl, defaultCode]);

  useEffect(() => {
    if (!apiOnline || !sessionToken || !currentUser) return;
    void refreshGovernanceData(sessionToken, currentUser, selectedScope);
  }, [apiOnline, sessionToken, currentUser, selectedScope]);

  const disputeResourceOptions = useMemo(
    () => [
      ...facilities.map((f) => ({
        id: f.id,
        label: `${a.dispatches.facilityPrefix} ${f.name}`,
        sublabel: `${formatFacilityKind(f.kind, locale)} · ${f.licenseNumber}`,
      })),
      ...dispatches.map((d) => ({
        id: d.id,
        label: `${a.dispatches.dispatchPrefix} ${d.pickupAddress}`,
        sublabel: `${formatUrgencyLabel(d.urgency, locale)} · ${formatDispatchStatus(d.status, locale)}`,
      })),
    ],
    [a.dispatches.dispatchPrefix, a.dispatches.facilityPrefix, dispatches, facilities, locale],
  );

  async function refreshGovernanceData(
    token: string,
    user: AuthenticatedUser,
    scopeCountry: string,
  ) {
    const countryParam =
      user.role === "OPS_ADMIN"
        ? scopeCountry === "ALL"
          ? undefined
          : scopeCountry
        : user.countryCode;

    if (isPendingStaffVerification(user) || !canManageAdminOps(user)) {
      setOverview(null);
      setFacilities([]);
      setUsers([]);
      setDispatches([]);
      setDisputes([]);
      setAuditLogs([]);
      setFacilityMedia([]);
      setAdminUserMedia([]);
      setPharmacyOrders([]);
      setAppointments([]);
      setPrescriptions([]);
      setLabOrders([]);
      return;
    }

    const [
      overviewRes,
      facilitiesRes,
      usersRes,
      dispatchesRes,
      disputesRes,
      auditRes,
      facMediaRes,
      userMediaRes,
    ] = await Promise.all([
      fetchAdminOverview(apiBaseUrl, token, countryParam),
      listFacilities(apiBaseUrl, token, countryParam),
      fetchAdminUsers(apiBaseUrl, token, { countryCode: countryParam }),
      listDispatchRequests(
        apiBaseUrl,
        token,
        user.role === "OPS_ADMIN" ? countryParam : user.countryCode,
      ),
      fetchDisputesList(apiBaseUrl, token, {
        countryCode: countryParam,
      }),
      fetchAdminAuditEvents(apiBaseUrl, token, {
        countryCode: countryParam,
        limit: 50,
      }),
      listAdminFacilityMedia(apiBaseUrl, token, {
        ...(countryParam ? { countryCode: countryParam } : {}),
        limit: 80,
      }),
      listAllAdminUserMedia(apiBaseUrl, token, {
        ...(countryParam ? { countryCode: countryParam } : {}),
        limit: 80,
      }),
    ]);

    const hasUnauthorized = [
      overviewRes,
      facilitiesRes,
      usersRes,
      dispatchesRes,
      disputesRes,
      auditRes,
      facMediaRes,
      userMediaRes,
    ].some((res) => !res.ok && res.status === 401);

    if (hasUnauthorized) {
      clearStoredSession();
      setSessionToken(null);
      setCurrentUser(null);
      return;
    }

    if (overviewRes.ok) {
      setOverview(overviewRes.data.overview);
    }
    if (facilitiesRes.ok) {
      setFacilities(facilitiesRes.data.facilities);
    }
    if (usersRes.ok) {
      setUsers(usersRes.data.users);
    }
    if (dispatchesRes.ok) {
      setDispatches(dispatchesRes.data.dispatches);
    }
    if (disputesRes.ok) {
      setDisputes(disputesRes.data.disputes);
    }
    if (auditRes.ok) {
      setAuditLogs(auditRes.data.logs);
    }
    if (facMediaRes.ok) {
      setFacilityMedia(facMediaRes.data.documents);
    }
    if (userMediaRes.ok) {
      setAdminUserMedia(userMediaRes.data.documents);
    }
  }

  // Lazy-load the 4 heavy cross-platform operations feeds only when the Operations Tracker tab is opened
  useEffect(() => {
    if (
      activeTab !== "operations" ||
      !apiOnline ||
      !sessionToken ||
      !currentUser ||
      !canManageAdminOps(currentUser)
    ) {
      return;
    }
    let active = true;
    const countryParam =
      currentUser.role === "OPS_ADMIN"
        ? selectedScope === "ALL"
          ? undefined
          : selectedScope
        : currentUser.countryCode;

    void Promise.all([
      listPharmacyOrders(apiBaseUrl, sessionToken, countryParam),
      fetchAppointments(apiBaseUrl, sessionToken, countryParam),
      fetchPrescriptions(apiBaseUrl, sessionToken, countryParam),
      fetchLabOrders(apiBaseUrl, sessionToken, countryParam),
    ]).then(([pharmacyOrdersRes, appointmentsRes, prescriptionsRes, labOrdersRes]) => {
      if (!active) return;
      if (pharmacyOrdersRes.ok) setPharmacyOrders(pharmacyOrdersRes.data.orders);
      if (appointmentsRes.ok) setAppointments(appointmentsRes.data.appointments);
      if (prescriptionsRes.ok) setPrescriptions(prescriptionsRes.data.prescriptions);
      if (labOrdersRes.ok) setLabOrders(labOrdersRes.data.labOrders);
    });
    return () => {
      active = false;
    };
  }, [activeTab, apiBaseUrl, apiOnline, currentUser, selectedScope, sessionToken]);

  async function handleReviewFacilityDoc(
    mediaId: string,
    reviewStatus: "APPROVED" | "REJECTED",
    customNote?: string,
  ) {
    if (!sessionToken || !isOpsAdmin) return;
    setBusy(true);
    const res = await reviewFacilityMediaDocument(
      apiBaseUrl,
      sessionToken,
      mediaId,
      {
        reviewStatus,
        reviewerNote:
          customNote ||
          (reviewStatus === "APPROVED"
            ? "Certificate verified by Operations Compliance Desk."
            : "Certificate rejected during compliance inspection."),
      },
    );
    setBusy(false);

    if (!res.ok) {
      setBanner({
        tone: "error",
        text: m.docReviewFailed(res.error),
      });
      return;
    }

    setFacilityMedia((prev) =>
      prev.map((doc) => (doc.id === mediaId ? res.data.document : doc)),
    );
    if (currentUser) {
      void refreshGovernanceData(sessionToken, currentUser, selectedScope);
    }
    setBanner({
      tone: "success",
      text: m.docMarked(
        res.data.document.fileName,
        a.enums.reviewStatus[res.data.document.reviewStatus] ??
          res.data.document.reviewStatus,
      ),
    });
  }

  async function handleLoadUserCredentials(userId: string) {
    if (!sessionToken) return;
    const res = await listAdminUserMedia(apiBaseUrl, sessionToken, userId);
    if (res.ok) {
      setUserMediaByUser((prev) => ({
        ...prev,
        [userId]: res.data.documents,
      }));
    }
  }

  async function handleReviewUserCredential(
    userId: string,
    mediaId: string,
    reviewStatus: "APPROVED" | "REJECTED",
    customNote?: string,
  ) {
    if (!sessionToken || !isOpsAdmin) return;
    setBusy(true);
    const res = await reviewUserMediaDocument(
      apiBaseUrl,
      sessionToken,
      mediaId,
      {
        reviewStatus,
        reviewerNote:
          customNote ||
          (reviewStatus === "APPROVED"
            ? "Practitioner license validated by Ops Admin."
            : "Credential rejected by Ops Admin."),
      },
    );
    setBusy(false);
    if (!res.ok) {
      setBanner({
        tone: "error",
        text: m.credReviewFailed(res.error),
      });
      return;
    }

    setUserMediaByUser((prev) => ({
      ...prev,
      [userId]: (prev[userId] ?? []).map((doc) =>
        doc.id === mediaId ? res.data.document : doc,
      ),
    }));
    setAdminUserMedia((prev) =>
      prev.map((doc) =>
        doc.id === mediaId
          ? {
              ...doc,
              ...res.data.document,
              ...(reviewStatus === "APPROVED"
                ? { accountStatus: "ACTIVE", credentialVerified: true }
                : {}),
            }
          : doc,
      ),
    );
    if (currentUser) {
      void refreshGovernanceData(sessionToken, currentUser, selectedScope);
    }
    setBanner({
      tone: "success",
      text: m.docMarked(
        res.data.document.fileName,
        a.enums.reviewStatus[res.data.document.reviewStatus] ??
          res.data.document.reviewStatus,
      ),
    });
  }

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = LoginSchema.safeParse({
      email: loginEmail,
      password: loginPassword,
      portalTrack: "STAFF",
    });
    if (!parsed.success) {
      setBanner({
        tone: "error",
        text: m.invalidLoginInput,
      });
      return;
    }

    setBusy(true);
    const res = await loginUser(apiBaseUrl, parsed.data);
    if (!res.ok) {
      setBusy(false);
      setBanner({
        tone: "error",
        text:
          res.error === "API_UNREACHABLE"
            ? m.authUnreachable
            : m.authFailed(res.error),
      });
      return;
    }

    writeStoredSession(res.data);
    setSessionToken(res.data.token);
    setCurrentUser(res.data.user);
    const nextScope =
      res.data.user.role === "OPS_ADMIN" ? defaultCode : res.data.user.countryCode;
    setSelectedScope(nextScope);
    setLoginPassword("");

    await refreshGovernanceData(res.data.token, res.data.user, nextScope);
    setBusy(false);
    setSignInModalOpen(false);

    setBanner({
      tone: "success",
      text: m.signedInMsg(
        res.data.user.fullName,
        formatRoleLabel(res.data.user.role, locale),
        res.data.user.countryCode,
      ),
    });
  }

  function handleSignOut() {
    revokeClientSession(apiBaseUrl);
    setSessionToken(null);
    setCurrentUser(null);
    setOverview(null);
    setFacilities([]);
    setUsers([]);
    setDispatches([]);
    setDisputes([]);
    setAuditLogs([]);
    setFacilityMedia([]);
    setAdminUserMedia([]);
    setPharmacyOrders([]);
    setAppointments([]);
    setPrescriptions([]);
    setLabOrders([]);
    setBanner({
      tone: "info",
      text: m.signedOutRevoked,
    });
  }

  async function handleFacilityStatus(
    facilityId: string,
    nextStatus: "VERIFIED" | "SUSPENDED",
  ) {
    if (!sessionToken || !currentUser || !isOpsAdmin) return;
    setBusy(true);
    const res = await verifyFacilityStatus(
      apiBaseUrl,
      sessionToken,
      facilityId,
      nextStatus,
    );
    if (!res.ok) {
      setBusy(false);
      setBanner({
        tone: "error",
        text: m.facilityStatusRejected(res.error),
      });
      return;
    }
    setFacilities((prev) =>
      prev.map((item) => (item.id === facilityId ? res.data.facility : item)),
    );
    await refreshGovernanceData(sessionToken, currentUser, selectedScope);
    setBusy(false);
    setBanner({
      tone: "success",
      text: m.facilityStatusUpdated(
        res.data.facility.name,
        a.enums.facilityVerification[res.data.facility.verificationStatus] ??
          res.data.facility.verificationStatus,
      ),
    });
  }

  async function handleUpdateUserRole(targetUser: AuthenticatedUser): Promise<boolean> {
    if (!sessionToken || !currentUser || !isOpsAdmin) return false;
    const nextRole = roleDrafts[targetUser.id] ?? targetUser.role;
    const nextCountry =
      countryDrafts[targetUser.id] ?? targetUser.countryCode;

    setBusy(true);
    const res = await updateAdminUserRole(apiBaseUrl, sessionToken, targetUser.id, {
      role: nextRole,
      countryCode: nextCountry,
      reason: roleReason.trim() || a.users.defaultRoleReason,
    });
    if (!res.ok) {
      setBusy(false);
      setBanner({
        tone: "error",
        text: m.roleUpdateRejected(res.error),
      });
      return false;
    }

    await refreshGovernanceData(sessionToken, currentUser, selectedScope);
    setBusy(false);
    setBanner({
      tone: "success",
      text: m.roleReassigned(
        res.data.user.fullName,
        formatRoleLabel(res.data.user.role, locale),
        res.data.user.countryCode,
      ),
    });
    return true;
  }

  async function handleSaveUserRoleAndWorkplace(
    targetUser: AuthenticatedUser,
  ): Promise<boolean> {
    if (!sessionToken || !currentUser || !isOpsAdmin) return false;
    const nextRole = roleDrafts[targetUser.id] ?? targetUser.role;
    const nextCountry =
      countryDrafts[targetUser.id] ?? targetUser.countryCode;
    const draftFac = facilityDrafts[targetUser.id] ?? targetUser.facilityId ?? "";
    const currentFac = targetUser.facilityId ?? "";
    const supportsFacility =
      isStaffWorkerRole(nextRole) && nextRole !== "DRIVER";
    const desiredFacilityId = supportsFacility ? draftFac || null : null;
    const roleChanged =
      nextRole !== targetUser.role || nextCountry !== targetUser.countryCode;
    const workplaceChanged =
      supportsFacility
        ? draftFac !== currentFac
        : Boolean(currentFac) && roleChanged;

    if (!roleChanged && !workplaceChanged) {
      return handleUpdateUserRole(targetUser);
    }

    setBusy(true);
    let latestUser = targetUser;

    if (roleChanged) {
      const roleRes = await updateAdminUserRole(
        apiBaseUrl,
        sessionToken,
        targetUser.id,
        {
          role: nextRole,
          countryCode: nextCountry,
          reason: roleReason.trim() || a.users.defaultRoleReason,
        },
      );
      if (!roleRes.ok) {
        setBusy(false);
        setBanner({
          tone: "error",
          text: m.roleUpdateRejected(roleRes.error),
        });
        return false;
      }
      latestUser = roleRes.data.user;
    }

    if (workplaceChanged) {
      const statusRes = await updateAdminUserStatus(
        apiBaseUrl,
        sessionToken,
        targetUser.id,
        {
          accountStatus: latestUser.accountStatus,
          credentialVerified: latestUser.credentialVerified,
          facilityId: desiredFacilityId,
          reason:
            roleReason.trim() ||
            `Admin workplace assignment: ${desiredFacilityId ?? "unlinked"}`,
        },
      );
      if (!statusRes.ok) {
        await refreshGovernanceData(sessionToken, currentUser, selectedScope);
        setBusy(false);
        setBanner({
          tone: "error",
          text: m.staffVerifyFailed(statusRes.error),
        });
        return false;
      }
      latestUser = statusRes.data.user;
    }

    await refreshGovernanceData(sessionToken, currentUser, selectedScope);
    setBusy(false);
    setBanner({
      tone: "success",
      text: m.roleReassigned(
        latestUser.fullName,
        formatRoleLabel(latestUser.role, locale),
        latestUser.countryCode,
      ),
    });
    return true;
  }

  async function handleUpdateUserStatus(
    targetUser: AuthenticatedUser,
    nextStatus: AccountStatus,
    credentialVerified: boolean,
    explicitFacilityId?: string | null,
  ) {
    if (!sessionToken || !currentUser || !isOpsAdmin) return;
    setBusy(true);
    const draftFac = facilityDrafts[targetUser.id];
    const resolvedFacilityPatch =
      explicitFacilityId !== undefined
        ? explicitFacilityId
        : draftFac !== undefined
          ? draftFac || null
          : undefined;
    const res = await updateAdminUserStatus(
      apiBaseUrl,
      sessionToken,
      targetUser.id,
      {
        accountStatus: nextStatus,
        credentialVerified,
        ...(resolvedFacilityPatch !== undefined
          ? { facilityId: resolvedFacilityPatch }
          : {}),
        reason:
          roleReason.trim() ||
          `Admin verification action: ${nextStatus} (verified=${String(credentialVerified)})`,
      },
    );
    if (!res.ok) {
      setBusy(false);
      setBanner({
        tone: "error",
        text: m.staffVerifyFailed(res.error),
      });
      return;
    }

    await refreshGovernanceData(sessionToken, currentUser, selectedScope);
    setBusy(false);
    setBanner({
      tone: "success",
      text: m.staffVerifyUpdated(
        res.data.user.fullName,
        formatRoleLabel(res.data.user.role, locale),
        a.enums.accountStatus[res.data.user.accountStatus] ??
          res.data.user.accountStatus,
        res.data.user.credentialVerified,
      ),
    });
  }

  async function handleOverrideDispatch(
    dispatch: DispatchRequestSummary,
  ): Promise<boolean> {
    if (!sessionToken || !currentUser || !isAdminViewer) return false;
    const nextStatus = overrideStatusDrafts[dispatch.id] ?? dispatch.status;
    const selectedDriver = overrideDriverDrafts[dispatch.id]?.trim();
    const note =
      overrideNotes[dispatch.id]?.trim() || "Central command status intervention";

    setBusy(true);
    const res = await overrideDispatchRequest(
      apiBaseUrl,
      sessionToken,
      dispatch.id,
      {
        status: nextStatus,
        ...(selectedDriver ? { driverUserId: selectedDriver } : {}),
        note,
      },
    );
    if (!res.ok) {
      setBusy(false);
      setBanner({
        tone: "error",
        text: m.dispatchOverrideFailed(res.error),
      });
      return false;
    }

    await refreshGovernanceData(sessionToken, currentUser, selectedScope);
    setBusy(false);
    setBanner({
      tone: "success",
      text: m.dispatchOverridden(
        res.data.dispatch.id.slice(0, 8),
        formatDispatchStatus(res.data.dispatch.status, locale),
      ),
    });
    return true;
  }

  async function handleSubmitDispute(
    event: FormEvent<HTMLFormElement>,
  ): Promise<boolean> {
    event.preventDefault();
    if (!sessionToken || !currentUser) return false;

    setBusy(true);
    const res = await submitDisputeTicket(apiBaseUrl, sessionToken, {
      category: disputeCategory,
      subject: disputeSubject.trim(),
      description: disputeDescription.trim(),
      ...(disputeTargetId.trim()
        ? { targetResourceId: disputeTargetId.trim() }
        : {}),
    });

    if (!res.ok) {
      setBusy(false);
      setBanner({
        tone: "error",
        text: m.disputeFilingFailed(res.error),
      });
      return false;
    }

    setDisputeSubject("");
    setDisputeDescription("");
    setDisputeTargetId("");
    await refreshGovernanceData(sessionToken, currentUser, selectedScope);
    setBusy(false);
    setBanner({
      tone: "success",
      text: m.disputeLogged(
        res.data.dispute.subject,
        a.enums.disputeStatus[res.data.dispute.status] ??
          res.data.dispute.status,
      ),
    });
    return true;
  }

  async function handleResolveDispute(
    disputeId: string,
    status: "UNDER_REVIEW" | "RESOLVED" | "DISMISSED",
  ) {
    if (!sessionToken || !currentUser || !isAdminViewer) return;
    const resolutionNote =
      resolutionDrafts[disputeId]?.trim() ||
      `Marked ${status.toLowerCase().replace("_", " ")} by command desk.`;

    setBusy(true);
    const res = await resolveDisputeTicket(apiBaseUrl, sessionToken, disputeId, {
      status,
      resolutionNote,
    });
    if (!res.ok) {
      setBusy(false);
      setBanner({
        tone: "error",
        text: m.disputeResolveFailed(res.error),
      });
      return;
    }

    await refreshGovernanceData(sessionToken, currentUser, selectedScope);
    setBusy(false);
    setBanner({
      tone: "success",
      text: m.disputeTransitioned(
        res.data.dispute.id.slice(0, 8),
        a.enums.disputeStatus[res.data.dispute.status] ??
          res.data.dispute.status,
      ),
    });
  }

  async function handleFilterAudit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!sessionToken || !isAdminViewer) return;
    setBusy(true);
    const res = await fetchAdminAuditEvents(apiBaseUrl, sessionToken, {
      countryCode: effectiveCountryQuery,
      action: auditActionFilter.trim() || undefined,
      resourceType: auditResourceFilter.trim() || undefined,
      limit: 50,
    });
    setBusy(false);
    if (!res.ok) {
      setBanner({
        tone: "error",
        text: m.auditQueryFailed(res.error),
      });
      return;
    }
    setAuditLogs(res.data.logs);
  }

  const countryDrivers = users.filter((u) => u.role === "DRIVER");
  const pendingStaffUsers = users.filter(
    (u) =>
      isStaffWorkerRole(u.role) &&
      (u.accountStatus === "PENDING_APPROVAL" || !u.credentialVerified),
  );

  const facilityNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const fac of facilities) {
      map.set(fac.id, fac.name);
    }
    return map;
  }, [facilities]);

  const filteredFacilities = useMemo(() => {
    const q = facilitySearchQuery.trim().toLowerCase();
    return facilities.filter((fac) => {
      if (
        facilityStatusFilter !== "ALL" &&
        fac.verificationStatus !== facilityStatusFilter
      ) {
        return false;
      }
      if (facilityKindFilter !== "ALL" && fac.kind !== facilityKindFilter) {
        return false;
      }
      if (!q) return true;
      return (
        fac.name.toLowerCase().includes(q) ||
        fac.licenseNumber.toLowerCase().includes(q) ||
        fac.address.toLowerCase().includes(q)
      );
    });
  }, [facilities, facilityKindFilter, facilitySearchQuery, facilityStatusFilter]);

  const filteredUsers = useMemo(() => {
    const q = userSearchQuery.trim().toLowerCase();
    return users.filter((u) => {
      if (userStatusFilter !== "ALL" && u.accountStatus !== userStatusFilter) {
        return false;
      }
      if (userRoleFilter !== "ALL" && u.role !== userRoleFilter) {
        return false;
      }
      if (!q) return true;
      return (
        u.fullName.toLowerCase().includes(q) ||
        (u.email?.toLowerCase().includes(q) ?? false) ||
        (u.phone?.toLowerCase().includes(q) ?? false) ||
        u.id.toLowerCase().includes(q)
      );
    });
  }, [userRoleFilter, userSearchQuery, userStatusFilter, users]);

  const filteredDisputes = useMemo(() => {
    if (disputeStatusFilter === "ALL") return disputes;
    return disputes.filter((d) => d.status === disputeStatusFilter);
  }, [disputeStatusFilter, disputes]);

  function handleExportAuditCsv() {
    if (auditLogs.length === 0) return;
    const esc = (v: unknown) =>
      `"${String(v ?? "").replace(/"/g, '""')}"`;
    const header = [
      "eventId",
      "occurredAtIso",
      "countryCode",
      "actorRole",
      "actorId",
      "action",
      "resourceType",
      "resourceId",
      "metadata",
    ].join(",");
    const rows = auditLogs.map((log) =>
      [
        esc(log.eventId),
        esc(log.occurredAtIso),
        esc(log.countryCode),
        esc(log.actorRole),
        esc(log.actorId),
        esc(log.action),
        esc(log.resourceType),
        esc(log.resourceId),
        esc(log.metadata ? JSON.stringify(log.metadata) : "{}"),
      ].join(","),
    );
    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `medisync-audit-${selectedScope.toLowerCase()}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const totalUploadedDocsCount =
    adminUserMedia.length + facilityMedia.length;
  const pendingDocsCount =
    overview?.pendingReviewDocuments ??
    adminUserMedia.filter(
      (d) => d.uploadStatus === "UPLOADED" && d.reviewStatus === "PENDING_REVIEW",
    ).length +
      facilityMedia.filter(
        (d) =>
          d.uploadStatus === "UPLOADED" && d.reviewStatus === "PENDING_REVIEW",
      ).length;

  const docsTabLabel =
    locale === "fr"
      ? `Pièces & Agréments (${totalUploadedDocsCount})`
      : locale === "ar"
        ? `التحقق من الملفات (${totalUploadedDocsCount})`
        : `Files & Licenses (${totalUploadedDocsCount})`;
  const opsTrackerTabLabel =
    locale === "fr"
      ? "Suivi Global & Ventes"
      : locale === "ar"
        ? "تتبع العمليات والمبيعات"
        : "Live Tracker";
  const pendingPapersKpiLabel =
    locale === "fr"
      ? "Pièces à valider"
      : locale === "ar"
        ? "ملفات قيد المراجعة"
        : "Files to Validate";
  const pharmacySalesKpiLabel =
    locale === "fr"
      ? "Ventes Pharmacie"
      : locale === "ar"
        ? "مبيعات الصيدليات"
        : "Pharmacy Sales";

  const kpiCards = [
    {
      label: a.kpis.pendingStaffVerify,
      value: overview ? String(pendingStaffUsers.length) : "-",
      detail: `${a.kpis.totalUsersDetail(users.length)}${overview ? ` · ${overview.totalNurses} ${formatRoleLabel("NURSE", locale)}` : ""}`,
    },
    {
      label: pendingPapersKpiLabel,
      value: overview ? String(pendingDocsCount) : "-",
      detail: `${totalUploadedDocsCount} ${locale === "fr" ? "fichiers" : locale === "ar" ? "ملفات" : "total files"}`,
    },
    {
      label: a.kpis.pendingLicenses,
      value: overview ? String(overview.pendingVerificationFacilities) : "-",
      detail: overview
        ? a.kpis.totalFacilitiesDetail(overview.totalFacilities)
        : a.kpis.syncRequired,
    },
    {
      label: a.kpis.activeDispatches,
      value: overview ? String(overview.activeDispatches) : "-",
      detail: overview
        ? `${overview.completedDispatches} ${locale === "fr" ? "terminées" : locale === "ar" ? "مكتملة" : "completed"}`
        : a.kpis.liveEmsDetail,
    },
    {
      label: pharmacySalesKpiLabel,
      value: overview ? String(overview.totalPharmacyOrders) : "-",
      detail: overview
        ? `${(overview.pharmacyRevenueMinor / 100).toFixed(2)} ${activePack?.currencyCode ?? "MAD"}`
        : a.kpis.syncRequired,
    },
    {
      label: a.kpis.bookedVisits,
      value: overview ? String(overview.activeAppointments) : "-",
      detail: a.kpis.confirmedCheckedInDetail,
    },
    {
      label: a.kpis.issuedRxQr,
      value: overview ? String(overview.openPrescriptions) : "-",
      detail: a.kpis.awaitingPharmacyDetail,
    },
    {
      label: a.kpis.openDisputes,
      value: overview ? String(overview.openDisputes) : "-",
      detail: `${a.kpis.openLabOrders}: ${overview ? overview.pendingLabOrders : "-"}`,
    },
  ];

  const tabs: readonly { id: AdminTab; label: string }[] = [
    { id: "overview", label: a.tabs.overview },
    { id: "documents", label: docsTabLabel },
    { id: "facilities", label: a.tabs.facilities(facilities.length) },
    { id: "users", label: a.tabs.users(users.length) },
    { id: "dispatches", label: a.tabs.dispatches(dispatches.length) },
    { id: "operations", label: opsTrackerTabLabel },
    { id: "disputes", label: a.tabs.disputes(disputes.length) },
    { id: "audit", label: a.tabs.audit(auditLogs.length) },
  ];

  return (
    <div dir={isRtl ? "rtl" : "ltr"} className="space-y-4">
      <WorkspaceHeader
        title={t("admin.heading")}
        countryCode={activePack?.code ?? defaultCode}
        countryName={formatCountryDisplayName(
          activePack?.code ?? defaultCode,
          activePack?.name ?? defaultCode,
          locale,
        )}
        currencyCode={activePack?.currencyCode ?? defaultCode}
        emergencyHotline={activePack?.emergencyHotlines.ambulance ?? ""}
        user={currentUser}
        guestLabel={a.header.guestLabel}
        hideGuestSignIn
        onSignOut={handleSignOut}
        actions={
          <div className="flex flex-wrap items-center gap-1.5">
            {currentUser && sessionToken ? (
              <>
                {isOpsAdmin ? (
                  <div
                    role="radiogroup"
                    aria-label={a.header.jurisdictionAria}
                    className="inline-flex items-center gap-1 rounded-xl border border-[#D7E4F2] bg-[#F3F8FD] p-1"
                  >
                    <button
                      type="button"
                      role="radio"
                      aria-checked={selectedScope === defaultCode}
                      onClick={() => setSelectedScope(defaultCode)}
                      className={`h-8 rounded-lg px-2.5 text-xs font-semibold transition ${
                        selectedScope === defaultCode
                          ? "bg-[#0066CC] text-white shadow-2xs"
                          : "text-[#4A627D] hover:bg-white hover:text-[#0F243E]"
                      }`}
                    >
                      {formatCountryDisplayName(
                        defaultCode,
                        activePack?.name ?? defaultCode,
                        locale,
                      )}{" "}
                      ({defaultCode})
                    </button>
                    <button
                      type="button"
                      role="radio"
                      aria-checked={selectedScope === "ALL"}
                      onClick={() => setSelectedScope("ALL")}
                      className={`h-8 rounded-lg px-2.5 text-xs font-semibold transition ${
                        selectedScope === "ALL"
                          ? "bg-[#0066CC] text-white shadow-2xs"
                          : "text-[#4A627D] hover:bg-white hover:text-[#0F243E]"
                      }`}
                    >
                      {a.header.allRegionsOption}
                    </button>
                  </div>
                ) : currentUser.role === "HOSPITAL_ADMIN" ? (
                  <Link
                    href="/hospital"
                    className="inline-flex h-10 items-center rounded-full bg-emerald-50 px-4 text-xs font-semibold text-emerald-800 transition hover:bg-emerald-100"
                  >
                    {a.header.hospitalReceptionLink}
                  </Link>
                ) : null}
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    void refreshGovernanceData(
                      sessionToken,
                      currentUser,
                      selectedScope,
                    )
                  }
                  className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-[#F3F8FD] border border-[#D7E4F2] px-4 text-xs font-semibold text-slate-700 transition hover:bg-[#E1EBF2] hover:text-[#0066CC] disabled:opacity-50"
                >
                  <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                  <span className="hidden sm:inline">{a.header.refreshBtn}</span>
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setSignInModalOpen(true)}
                className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-[#0066CC] px-4 text-xs font-semibold text-white shadow-2xs transition hover:bg-[#0052A3]"
              >
                <KeyRound className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{a.header.signInBtn}</span>
              </button>
            )}
          </div>
        }
      />

      <VerificationGateNotice user={currentUser} compact />

      <WorkspaceRoleGuard
        user={currentUser}
        hydrated={sessionHydrated}
        allowedRoles={["OPS_ADMIN"]}
        workspaceTitle={a.header.guardTitle}
        requiredRoleDescription={a.header.guardRoles}
        hideRecruitment
        primaryActionLabel={a.header.guardPrimaryBtn}
        onPrimaryAction={() => setSignInModalOpen(true)}
      >
      {overview ? (
        <StatStrip
          ariaLabel={a.header.overviewMetricsAria}
          columns={4}
          items={kpiCards.map((kpi, idx) => ({
            label: kpi.label,
            value: kpi.value,
            detail: kpi.detail,
            tone:
              idx === 0 || idx === 1 || idx === 2
                ? "amber"
                : idx === 3
                  ? "crimson"
                  : idx === 4 || idx === 5
                    ? "emerald"
                    : "neutral",
          }))}
        />
      ) : null}

      <section className="min-w-0 space-y-4">
        <UiTabBar
          tabs={tabs}
          activeTab={activeTab}
          onSelect={setActiveTab}
          ariaLabel={a.header.tabsAria}
        />

          {activeTab === "overview" ? (
            <div className="space-y-4">
              {pendingDocsCount > 0 ? (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#D7E4F2] bg-white px-4 py-3 text-xs">
                  <div className="flex items-center gap-2.5">
                    <FileCheck2 className="h-4 w-4 text-[#0066CC]" aria-hidden="true" />
                    <p className="font-semibold text-[#0F243E]">
                      {locale === "fr"
                        ? `${pendingDocsCount} pièce(s) en attente de validation`
                        : locale === "ar"
                          ? `${pendingDocsCount} وثيقة في انتظار المصادقة`
                          : `${pendingDocsCount} file(s) awaiting validation`}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTab("documents")}
                    className="inline-flex h-8 items-center rounded-lg bg-[#0066CC] px-3.5 text-xs font-semibold text-white hover:bg-[#0052A3]"
                  >
                    {docsTabLabel}
                  </button>
                </div>
              ) : null}

              {pendingStaffUsers.length > 0 ? (
                <div className="space-y-3 rounded-2xl border border-amber-300 bg-amber-50/60 p-5 shadow-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-amber-200 bg-white text-amber-800">
                        <ShieldCheck className="h-5 w-5" aria-hidden="true" />
                      </span>
                      <div>
                        <h2 className="text-base font-semibold text-amber-950">
                          {a.overview.pendingQueueTitle(pendingStaffUsers.length)}
                        </h2>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveTab("users")}
                      className="rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-950 hover:bg-amber-100"
                    >
                      {a.overview.openStaffQueueBtn}
                    </button>
                  </div>

                  <div className="space-y-2">
                    {pendingStaffUsers.map((pendingUser) => (
                      <div
                        key={pendingUser.id}
                        className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-white p-3"
                      >
                        <div className="flex min-w-0 items-center gap-2.5">
                          <EntityAvatar
                            name={pendingUser.fullName}
                            role={pendingUser.role}
                            avatarUrl={pendingUser.avatarUrl}
                            size="sm"
                          />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-slate-900">
                              <bdi dir="auto">{pendingUser.fullName}</bdi> ·{" "}
                              {formatRoleLabel(pendingUser.role, locale)}
                            </p>
                            <p className="truncate text-xs text-slate-600">
                              <span dir="ltr">
                                {pendingUser.email ??
                                  pendingUser.phone ??
                                  pendingUser.id}
                              </span>{" "}
                              · {pendingUser.countryCode} ·{" "}
                              {a.overview.statusPrefix}{" "}
                              {a.enums.accountStatus[pendingUser.accountStatus] ??
                                pendingUser.accountStatus}
                            </p>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setActiveTab("users");
                              void handleLoadUserCredentials(pendingUser.id);
                            }}
                            className="min-h-[38px] rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-teal-700"
                          >
                            {a.overview.inspectCredentialsBtn}
                          </button>
                          {isOpsAdmin ? (
                            <>
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() =>
                                  void handleUpdateUserStatus(
                                    pendingUser,
                                    "SUSPENDED",
                                    false,
                                  )
                                }
                                className="min-h-[38px] rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-800 hover:bg-red-100 disabled:opacity-50"
                              >
                                {a.overview.rejectSuspendBtn}
                              </button>
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() =>
                                  void handleUpdateUserStatus(
                                    pendingUser,
                                    "ACTIVE",
                                    true,
                                  )
                                }
                                className="min-h-[38px] rounded-lg bg-[#0066CC] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#0052A3] disabled:opacity-50"
                              >
                                {a.overview.verifyActivateBtn}
                              </button>
                            </>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="space-y-4 rounded-2xl border border-[#D7E4F2] bg-white p-5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Activity className="h-4 w-4 text-[#0066CC]" />
                    <h2 className="text-base font-semibold text-slate-950">
                      {a.overview.recentActivityTitle}
                    </h2>
                  </div>
                  <span className="text-xs font-medium text-slate-500">
                    {a.overview.tamperEvidentBadge}
                  </span>
                </div>

              {overview?.recentAuditLogs && overview.recentAuditLogs.length > 0 ? (
                <div className="space-y-2">
                  {overview.recentAuditLogs.map((log) => (
                    <article
                      key={log.eventId}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#D7E4F2] bg-[#F3F8FD] px-4 py-3 text-xs "
                    >
                      <div className="space-y-0.5">
                        <p className="font-mono-tabular font-semibold text-slate-900">
                          <span dir="ltr">{log.action}</span>{" "}
                          <span className="font-normal text-slate-500">
                            {a.overview.auditOnPrefix}{" "}
                            <span dir="ltr">
                              {log.resourceType}:{log.resourceId.slice(0, 8)}
                            </span>
                          </span>
                        </p>
                        <p className="text-slate-600">
                          {a.overview.auditActorPrefix}{" "}
                          {formatRoleLabel(log.actorRole, locale)} (
                          <span dir="ltr">{log.actorId.slice(0, 8)}</span>) ·{" "}
                          {log.countryCode}
                        </p>
                      </div>
                      <time dir="ltr" className="font-mono-tabular text-[11px] text-slate-500">
                        {log.occurredAtIso}
                      </time>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">
                  {a.overview.emptyOverviewHint}
                </p>
              )}
            </div>
          </div>
          ) : null}

          {activeTab === "documents" ? (
            <AdminDocumentsValidationPanel
              userDocuments={adminUserMedia}
              facilityDocuments={facilityMedia}
              isOpsAdmin={isOpsAdmin}
              busy={busy}
              onReviewUserDocument={handleReviewUserCredential}
              onReviewFacilityDocument={handleReviewFacilityDoc}
            />
          ) : null}

          {activeTab === "operations" ? (
            <DynamicAdminOperationsTrackerPanel
              pharmacyOrders={pharmacyOrders}
              appointments={appointments}
              prescriptions={prescriptions}
              labOrders={labOrders}
              currencyCode={activePack?.currencyCode ?? "MAD"}
            />
          ) : null}

          {activeTab === "facilities" ? (
            <div className="space-y-4 rounded-2xl border border-[#D7E4F2] bg-white p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-[#0066CC]" />
                    <h2 className="text-base font-semibold text-slate-950">
                      {a.facilities.heading}
                    </h2>
                  </div>
                  <MoroccanComplianceBadge domain="admin" locale={locale} />
                </div>
                <span className="font-mono-tabular text-xs text-slate-500">
                  {a.facilities.showingCount(filteredFacilities.length, facilities.length)}
                </span>
              </div>

              <div className="space-y-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex h-9 min-w-[200px] flex-1 items-center gap-1.5 rounded-xl border border-[#D7E4F2] bg-[#F8FBFE] px-3.5 focus-within:border-[#0066CC] focus-within:bg-white">
                    <Search className="h-3.5 w-3.5 shrink-0 text-slate-500" aria-hidden="true" />
                    <input
                      type="search"
                      value={facilitySearchQuery}
                      onChange={(e) => setFacilitySearchQuery(e.target.value)}
                      placeholder={a.facilities.searchPlaceholder}
                      aria-label={a.facilities.searchAria}
                      className="min-w-0 flex-1 bg-transparent text-xs text-slate-900 focus:outline-none"
                    />
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {(["ALL", "PENDING_REVIEW", "VERIFIED", "SUSPENDED"] as const).map(
                      (st) => (
                        <button
                          key={st}
                          type="button"
                          onClick={() => setFacilityStatusFilter(st)}
                          className={`h-8 rounded-full border px-3 text-[11px] font-semibold transition ${
                            facilityStatusFilter === st
                              ? "border-[#0066CC] bg-[#0066CC] text-white"
                              : "border-[#D7E4F2] bg-white text-slate-700 hover:border-[#0066CC] hover:text-[#0066CC]"
                          }`}
                        >
                          {st === "ALL"
                            ? a.facilities.filterAll
                            : st === "PENDING_REVIEW"
                              ? a.facilities.filterPending
                              : st === "VERIFIED"
                                ? a.facilities.filterVerified
                                : a.facilities.filterSuspended}
                        </button>
                      ),
                    )}
                  </div>
                </div>
                <TactilePillGroup
                  ariaLabel={a.facilities.kindAria}
                  size="xs"
                  layout="segmented"
                  value={facilityKindFilter}
                  onChange={setFacilityKindFilter}
                  options={[
                    { value: "ALL", label: a.facilities.allTypesOption },
                    { value: "HOSPITAL", label: a.facilities.hospitalsOption },
                    { value: "CLINIC", label: a.facilities.clinicsOption },
                    { value: "PHARMACY", label: a.facilities.pharmaciesOption },
                    { value: "DIAGNOSTIC_LAB", label: a.facilities.labsOption },
                  ]}
                />
              </div>

              {filteredFacilities.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">
                  {a.facilities.emptyFilter}
                </p>
              ) : (
                <div className="space-y-3">
                  {filteredFacilities.map((fac) => {
                    const attachedDocs = facilityMedia.filter(
                      (doc) => doc.facilityId === fac.id,
                    );
                    return (
                      <article
                        key={fac.id}
                        className="space-y-3 rounded-2xl border border-[#D7E4F2] bg-[#F3F8FD] p-4 "
                      >
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="text-sm font-semibold text-slate-900">
                                {fac.name}
                              </h3>
                              <span className="rounded bg-slate-100 px-2 py-0.5 font-mono-tabular text-[11px] font-semibold text-slate-700">
                                {formatFacilityKind(fac.kind, locale)}
                              </span>
                              <span
                                className={`rounded border px-2 py-0.5 font-mono-tabular text-[11px] font-semibold ${
                                  fac.verificationStatus === "VERIFIED"
                                    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                                    : fac.verificationStatus === "SUSPENDED"
                                      ? "border-red-200 bg-red-50 text-red-800"
                                      : "border-amber-200 bg-amber-50 text-amber-800"
                                }`}
                              >
                                {a.enums.facilityVerification[fac.verificationStatus] ??
                                  fac.verificationStatus}
                              </span>
                            </div>
                            <p className="font-mono-tabular text-xs text-slate-600">
                              {fac.countryCode} · {a.facilities.licensePrefix}{" "}
                              <span dir="ltr">{fac.licenseNumber}</span>
                            </p>
                            <p className="text-xs text-slate-500">
                              {fac.address}
                            </p>
                          </div>

                          {isOpsAdmin ? (
                            <div className="flex shrink-0 gap-2">
                              <button
                                type="button"
                                disabled={
                                  busy || fac.verificationStatus === "VERIFIED"
                                }
                                onClick={() =>
                                  void handleFacilityStatus(fac.id, "VERIFIED")
                                }
                                className="min-h-[36px] rounded-xl bg-[#0066CC] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#0052A3] disabled:opacity-45"
                              >
                                {a.facilities.verifyBtn}
                              </button>
                              <button
                                type="button"
                                disabled={
                                  busy || fac.verificationStatus === "SUSPENDED"
                                }
                                onClick={() =>
                                  void handleFacilityStatus(fac.id, "SUSPENDED")
                                }
                                className="min-h-[36px] rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-800 hover:bg-red-100 disabled:opacity-45"
                              >
                                {a.facilities.suspendBtn}
                              </button>
                            </div>
                          ) : null}
                        </div>

                        {attachedDocs.length > 0 ? (
                          <div className="space-y-1.5 border-t border-slate-100 pt-2.5">
                            <p className="font-mono-tabular text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                              {a.facilities.submittedDocsTitle(attachedDocs.length)}
                            </p>
                            {attachedDocs.map((doc) => {
                              const docStatusLabel =
                                a.enums.reviewStatus[doc.reviewStatus] ??
                                doc.reviewStatus;
                              return (
                              <div
                                key={doc.id}
                                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs"
                              >
                                <div className="flex min-w-0 items-center gap-2">
                                  <FileText
                                    className="h-3.5 w-3.5 shrink-0 text-teal-700"
                                    aria-hidden="true"
                                  />
                                  <span className="truncate font-semibold text-slate-900">
                                    {doc.fileName}
                                  </span>
                                  <span className="font-mono-tabular text-[11px] text-slate-500">
                                    {doc.category} ·{" "}
                                    {formatByteSize(doc.sizeBytes)} ·{" "}
                                    {docStatusLabel}
                                  </span>
                                </div>
                                <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                                  {doc.uploadStatus === "UPLOADED" ? (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        openImage({
                                          src: doc.downloadUrl,
                                          downloadUrl: doc.downloadUrl,
                                          mimeType: doc.mimeType,
                                          alt: doc.fileName,
                                          title: doc.fileName,
                                          subtitle: `${fac.name} · ${doc.category} · ${docStatusLabel}`,
                                          badge: docStatusLabel,
                                        })
                                      }
                                      className="inline-flex min-h-[30px] items-center gap-1 rounded border border-slate-300 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 hover:border-teal-700"
                                    >
                                      <Eye
                                        className="h-3 w-3"
                                        aria-hidden="true"
                                      />
                                      <span>{a.facilities.inspectBtn}</span>
                                    </button>
                                  ) : null}
                                  {isOpsAdmin &&
                                  doc.uploadStatus === "UPLOADED" ? (
                                    <>
                                      <button
                                        type="button"
                                        disabled={
                                          busy ||
                                          doc.reviewStatus === "APPROVED"
                                        }
                                        onClick={() =>
                                          void handleReviewFacilityDoc(
                                            doc.id,
                                            "APPROVED",
                                          )
                                        }
                                        className="min-h-[30px] rounded bg-[#0066CC] px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-[#0052A3] disabled:opacity-45"
                                      >
                                        {a.facilities.approveBtn}
                                      </button>
                                      <button
                                        type="button"
                                        disabled={
                                          busy ||
                                          doc.reviewStatus === "REJECTED"
                                        }
                                        onClick={() =>
                                          void handleReviewFacilityDoc(
                                            doc.id,
                                            "REJECTED",
                                          )
                                        }
                                        className="min-h-[30px] rounded border border-red-200 bg-red-50 px-2.5 py-1 text-[11px] font-semibold text-red-800 hover:bg-red-100 disabled:opacity-45"
                                      >
                                        {a.facilities.rejectBtn}
                                      </button>
                                    </>
                                  ) : null}
                                </div>
                              </div>
                            );
                            })}
                          </div>
                        ) : null}
                      </article>
                    );
                  })}
                </div>
              )}
            </div>
          ) : null}

          {activeTab === "users" ? (
            <div className="space-y-4 rounded-2xl border border-[#D7E4F2] bg-white p-5">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-[#0066CC]" />
                  <h2 className="text-base font-semibold text-slate-950">
                    {a.users.heading(filteredUsers.length)}
                  </h2>
                </div>
                {isOpsAdmin ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      type="text"
                      value={roleReason}
                      onChange={(e) => setRoleReason(e.target.value)}
                      aria-label={a.users.roleReasonAria}
                      placeholder={a.users.roleReasonPlaceholder}
                      className="h-9 rounded-xl border border-transparent bg-white px-3.5 py-1.5 text-xs text-slate-800 shadow-2xs"
                    />
                    <button
                      type="button"
                      onClick={() => setProvisionModalOpen(true)}
                      className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-[#0066CC] px-4 text-xs font-semibold text-white transition hover:bg-[#0052A3] active:scale-[0.98]"
                    >
                      <UserPlus className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>{a.users.provisionBtn}</span>
                    </button>
                  </div>
                ) : null}
              </div>

              <div className="space-y-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex h-9 min-w-[200px] flex-1 items-center gap-1.5 rounded-xl border border-[#D7E4F2] bg-[#F8FBFE] px-3.5 focus-within:border-[#0066CC] focus-within:bg-white">
                    <Search className="h-3.5 w-3.5 shrink-0 text-slate-500" aria-hidden="true" />
                    <input
                      type="search"
                      value={userSearchQuery}
                      onChange={(e) => setUserSearchQuery(e.target.value)}
                      placeholder={a.users.searchPlaceholder}
                      aria-label={a.users.searchAria}
                      className="min-w-0 flex-1 bg-transparent text-xs text-slate-900 focus:outline-none"
                    />
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {(["ALL", "PENDING_APPROVAL", "ACTIVE", "SUSPENDED"] as const).map(
                      (st) => (
                        <button
                          key={st}
                          type="button"
                          onClick={() => setUserStatusFilter(st)}
                          className={`h-8 rounded-full border px-3 text-[11px] font-semibold transition ${
                            userStatusFilter === st
                              ? "border-[#0066CC] bg-[#0066CC] text-white"
                              : "border-[#D7E4F2] bg-white text-slate-700 hover:border-[#0066CC] hover:text-[#0066CC]"
                          }`}
                        >
                          {st === "ALL"
                            ? a.users.filterAllStatuses
                            : st === "PENDING_APPROVAL"
                              ? a.users.filterPending
                              : st === "ACTIVE"
                                ? a.users.filterActive
                                : a.users.filterSuspended}
                        </button>
                      ),
                    )}
                  </div>
                </div>
                <TactilePillGroup
                  ariaLabel={a.users.roleFilterAria}
                  size="xs"
                  value={userRoleFilter}
                  onChange={(next) => setUserRoleFilter(next)}
                  options={[
                    { value: "ALL" as const, label: a.users.allRolesOption },
                    ...ALL_ROLES.map((r) => ({
                      value: r,
                      label: formatRoleLabel(r, locale),
                    })),
                  ]}
                />
              </div>

              {filteredUsers.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">
                  {a.users.emptyFilter}
                </p>
              ) : (
                <div className="space-y-2.5">
                  {filteredUsers.map((user) => {
                    const draftRole = roleDrafts[user.id] ?? user.role;
                    const draftFacilityId =
                      facilityDrafts[user.id] ?? user.facilityId ?? "";
                    const isEditingThisUser = editingUserId === user.id;
                    const assignedFacilityName = user.facilityId
                      ? facilityNameById.get(user.facilityId) ?? user.facilityId.slice(0, 8)
                      : null;
                    const isSelfOpsGuard =
                      currentUser?.id === user.id && draftRole !== "OPS_ADMIN";

                    return (
                      <article
                        key={user.id}
                        className="flex flex-col gap-3 rounded-2xl border border-[#D7E4F2] bg-[#F3F8FD] p-4 "
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex min-w-0 flex-1 items-center gap-2.5">
                            <EntityAvatar
                              name={user.fullName}
                              role={user.role}
                              avatarUrl={user.avatarUrl}
                              size="sm"
                            />
                            <div className="min-w-0 flex-1">
                              <h3 className="truncate text-sm font-semibold text-slate-900">
                                <bdi dir="auto">{user.fullName}</bdi>
                              </h3>
                              <p className="truncate text-xs text-slate-500">
                                <span dir="ltr">
                                  {user.email ?? user.phone ?? a.users.noEmail}
                                </span>
                                {assignedFacilityName ? (
                                  <span> · {assignedFacilityName}</span>
                                ) : null}
                              </p>
                            </div>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={`rounded border px-2 py-0.5 text-[11px] font-semibold ${
                                user.accountStatus === "PENDING_APPROVAL"
                                  ? "border-amber-300 bg-amber-50 text-amber-950"
                                  : user.accountStatus === "SUSPENDED"
                                    ? "border-red-300 bg-red-50 text-red-900"
                                    : "border-emerald-300 bg-emerald-50 text-emerald-900"
                              }`}
                            >
                              {user.accountStatus === "PENDING_APPROVAL"
                                ? a.users.statusPendingApproval
                                : user.accountStatus === "SUSPENDED"
                                  ? a.users.statusSuspended
                                  : user.credentialVerified
                                    ? a.users.statusVerifiedActive
                                    : a.users.statusActive}
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                void handleLoadUserCredentials(user.id)
                              }
                              className="rounded border border-slate-300 bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-700 hover:border-teal-700"
                            >
                              {a.users.credentialsBtn}
                            </button>
                            <span
                              className={`rounded border px-2 py-0.5 text-[11px] font-semibold ${ROLE_BADGE_COLORS[user.role]}`}
                            >
                              {formatRoleLabel(user.role, locale)} · {user.countryCode}
                            </span>
                          </div>
                        </div>

                        {userMediaByUser[user.id] &&
                        userMediaByUser[user.id]!.length > 0 ? (
                          <div className="space-y-1 border-t border-slate-100 pt-2">
                            {userMediaByUser[user.id]!.map((doc) => {
                              const docStatusLabel =
                                a.enums.reviewStatus[doc.reviewStatus] ??
                                doc.reviewStatus;
                              return (
                              <div
                                key={doc.id}
                                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs"
                              >
                                <span className="truncate font-medium text-slate-800">
                                  {doc.fileName} ({doc.category} ·{" "}
                                  {docStatusLabel})
                                </span>
                                <div className="flex items-center gap-1.5">
                                  {doc.uploadStatus === "UPLOADED" ? (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        openImage({
                                          src: doc.downloadUrl,
                                          downloadUrl: doc.downloadUrl,
                                          mimeType: doc.mimeType,
                                          alt: doc.fileName,
                                          title: doc.fileName,
                                          subtitle: `${user.fullName} · ${doc.category}`,
                                          badge: docStatusLabel,
                                        })
                                      }
                                      className="rounded border border-slate-300 bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-700"
                                    >
                                      {a.users.inspectBtn}
                                    </button>
                                  ) : null}
                                  {isOpsAdmin &&
                                  doc.uploadStatus === "UPLOADED" ? (
                                    <>
                                      <button
                                        type="button"
                                        disabled={
                                          busy ||
                                          doc.reviewStatus === "APPROVED"
                                        }
                                        onClick={() =>
                                          void handleReviewUserCredential(
                                            user.id,
                                            doc.id,
                                            "APPROVED",
                                          )
                                        }
                                        className="rounded bg-[#0066CC] px-2 py-0.5 text-[11px] font-semibold text-white disabled:opacity-45"
                                      >
                                        {a.users.approveBtn}
                                      </button>
                                      <button
                                        type="button"
                                        disabled={
                                          busy ||
                                          doc.reviewStatus === "REJECTED"
                                        }
                                        onClick={() =>
                                          void handleReviewUserCredential(
                                            user.id,
                                            doc.id,
                                            "REJECTED",
                                          )
                                        }
                                        className="rounded border border-red-200 bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-800 disabled:opacity-45"
                                      >
                                        {a.users.rejectBtn}
                                      </button>
                                    </>
                                  ) : null}
                                </div>
                              </div>
                            );
                            })}
                          </div>
                        ) : null}

                        {isOpsAdmin ? (
                          <div className="space-y-3 border-t border-slate-100 pt-3">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <button
                                type="button"
                                onClick={() =>
                                  setEditingUserId(isEditingThisUser ? null : user.id)
                                }
                                className={`inline-flex min-h-[34px] items-center gap-1.5 rounded-xl border px-3 py-1 text-xs font-semibold transition ${
                                  isEditingThisUser
                                    ? "border-[#0066CC] bg-[#EBF4FF] text-[#0052A3]"
                                    : "border-[#D7E4F2] bg-white text-[#2F4661] hover:border-[#0066CC]"
                                }`}
                              >
                                <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
                                <span>
                                  {isEditingThisUser
                                    ? locale === "fr"
                                      ? "Fermer l'éditeur"
                                      : locale === "ar"
                                        ? "إغلاق التعديل"
                                        : "Close Editor"
                                    : locale === "fr"
                                      ? "Modifier Rôle / Établissement"
                                      : locale === "ar"
                                        ? "تعديل الدور / المؤسسة"
                                        : "Edit Role & Workplace"}
                                </span>
                              </button>

                              <div className="flex flex-wrap items-center gap-2">
                                {isStaffWorkerRole(user.role) &&
                                (user.accountStatus === "PENDING_APPROVAL" ||
                                  !user.credentialVerified) ? (
                                  <button
                                    type="button"
                                    disabled={busy}
                                    onClick={() =>
                                      void handleUpdateUserStatus(user, "ACTIVE", true)
                                    }
                                    className="min-h-[34px] rounded-xl bg-[#0066CC] px-3.5 py-1 text-xs font-semibold text-white hover:bg-[#0052A3] disabled:opacity-45"
                                  >
                                    {a.users.verifyActivateBtn}
                                  </button>
                                ) : user.id !== currentUser?.id ? (
                                  <button
                                    type="button"
                                    disabled={busy}
                                    onClick={() =>
                                      void handleUpdateUserStatus(
                                        user,
                                        user.accountStatus === "SUSPENDED"
                                          ? "ACTIVE"
                                          : "SUSPENDED",
                                        user.credentialVerified,
                                      )
                                    }
                                    className="min-h-[34px] rounded-xl border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700 hover:border-red-600 hover:text-red-700 disabled:opacity-45"
                                  >
                                    {user.accountStatus === "SUSPENDED"
                                      ? a.users.reactivateBtn
                                      : a.users.suspendBtn}
                                  </button>
                                ) : null}
                              </div>
                            </div>

                            {isEditingThisUser ? (
                              <div className="space-y-3 rounded-xl border border-[#BFDBFE] bg-white p-3.5">
                                <div className="space-y-1.5">
                                  <p className="text-[11px] font-semibold text-[#556E89]">
                                    {a.users.roleSelectAria(user.fullName)}
                                  </p>
                                  <TactilePillGroup
                                    ariaLabel={a.users.roleSelectAria(user.fullName)}
                                    size="xs"
                                    value={draftRole}
                                    onChange={(next) =>
                                      setRoleDrafts((prev) => ({
                                        ...prev,
                                        [user.id]: next,
                                      }))
                                    }
                                    options={ALL_ROLES.map((roleOpt) => ({
                                      value: roleOpt,
                                      label: formatRoleLabel(roleOpt, locale),
                                    }))}
                                  />
                                </div>

                                {isStaffWorkerRole(draftRole) && draftRole !== "DRIVER" ? (
                                  <EntityPicker
                                    id={`admin-user-fac-${user.id}`}
                                    label={a.users.facilitySelectAria(user.fullName)}
                                    placeholder={a.users.facilitySelectAria(user.fullName)}
                                    emptyLabel={a.users.noFacilityLinkedOption}
                                    value={draftFacilityId}
                                    onChange={(nextFac) =>
                                      setFacilityDrafts((prev) => ({
                                        ...prev,
                                        [user.id]: nextFac,
                                      }))
                                    }
                                    options={facilities
                                      .filter((f) => f.countryCode === user.countryCode)
                                      .map((fac) => ({
                                        id: fac.id,
                                        label: fac.name,
                                        sublabel: formatFacilityKind(fac.kind, locale),
                                      }))}
                                  />
                                ) : null}

                                <div className="flex flex-wrap items-center justify-end gap-2">
                                  <button
                                    type="button"
                                    disabled={busy || isSelfOpsGuard}
                                    onClick={async () => {
                                      const saved = await handleSaveUserRoleAndWorkplace(user);
                                      if (saved) setEditingUserId(null);
                                    }}
                                    className="min-h-[36px] rounded-xl bg-[#0066CC] px-4 py-1 text-xs font-semibold text-white hover:bg-[#0052A3] disabled:opacity-45"
                                  >
                                    {isSelfOpsGuard
                                      ? a.users.selfDemotionBlocked
                                      : a.users.applyRoleBtn}
                                  </button>
                                </div>
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                      </article>
                    );
                  })}
                </div>
              )}
            </div>
          ) : null}

          {activeTab === "dispatches" ? (
            <div className="space-y-4 rounded-2xl border border-[#D7E4F2] bg-white p-5">
              <div className="flex items-center gap-2">
                <Navigation className="h-4 w-4 text-[#0066CC]" />
                <h2 className="text-base font-semibold text-slate-950">
                  {a.dispatches.heading}
                </h2>
              </div>

              {dispatches.length === 0 ? (
                <p className="rounded-2xl border border-[#D7E4F2] bg-[#F3F8FD] p-6 text-center text-sm text-slate-500 ">
                  {a.dispatches.empty}
                </p>
              ) : (
                <div className="space-y-3">
                  {dispatches.map((disp) => {
                    const draftStatus =
                      overrideStatusDrafts[disp.id] ?? disp.status;
                    const draftDriver =
                      overrideDriverDrafts[disp.id] ?? disp.driverUserId ?? "";

                    return (
                      <article
                        key={disp.id}
                        className="space-y-3 rounded-2xl border border-[#D7E4F2] bg-[#F3F8FD] p-4 "
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <p className="font-mono-tabular text-xs font-semibold text-slate-900">
                              {formatUrgencyLabel(disp.urgency, locale)} ·{" "}
                              {disp.countryCode} ·{" "}
                              <span dir="ltr">{disp.id.slice(0, 8)}</span>
                            </p>
                            <p className="text-sm font-medium text-slate-800">
                              {disp.pickupAddress}
                            </p>
                            {disp.notes ? (
                              <p className="mt-0.5 text-xs text-slate-500">
                                {disp.notes}
                              </p>
                            ) : null}
                          </div>
                          <span className="rounded border border-teal-200 bg-teal-50 px-2 py-0.5 font-mono-tabular text-xs font-semibold text-teal-900">
                            {formatDispatchStatus(disp.status, locale)}
                          </span>
                        </div>

                        {isAdminViewer ? (
                          <div className="space-y-2.5 border-t border-slate-100 pt-3">
                            <div className="flex justify-end">
                              <button
                                type="button"
                                onClick={() =>
                                  setEditingDispatchId(
                                    editingDispatchId === disp.id ? null : disp.id,
                                  )
                                }
                                className={`inline-flex min-h-[32px] items-center gap-1.5 rounded-xl border px-3 text-xs font-semibold transition ${
                                  editingDispatchId === disp.id
                                    ? "border-[#0066CC] bg-[#EBF4FF] text-[#0052A3]"
                                    : "border-[#D7E4F2] bg-white text-[#2F4661] hover:border-[#0066CC]"
                                }`}
                              >
                                <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
                                <span>
                                  {editingDispatchId === disp.id
                                    ? locale === "fr"
                                      ? "Fermer"
                                      : locale === "ar"
                                        ? "إغلاق"
                                        : "Close"
                                    : a.dispatches.commitBtn}
                                </span>
                              </button>
                            </div>

                            {editingDispatchId === disp.id ? (
                              <div className="space-y-3 rounded-xl border border-[#BFDBFE] bg-white p-3.5">
                                <TactilePillGroup
                                  ariaLabel={a.dispatches.statusSelectAria(disp.id)}
                                  size="xs"
                                  value={draftStatus}
                                  onChange={(next) =>
                                    setOverrideStatusDrafts((prev) => ({
                                      ...prev,
                                      [disp.id]: next,
                                    }))
                                  }
                                  options={ALL_DISPATCH_STATUSES.map((st) => ({
                                    value: st,
                                    label: formatDispatchStatus(st, locale),
                                  }))}
                                />

                                <EntityPicker
                                  id={`admin-disp-driver-${disp.id}`}
                                  label={a.dispatches.driverSelectAria(disp.id)}
                                  placeholder={a.dispatches.driverSelectAria(disp.id)}
                                  emptyLabel={a.dispatches.keepUnassignedOption}
                                  value={draftDriver}
                                  onChange={(nextDrv) =>
                                    setOverrideDriverDrafts((prev) => ({
                                      ...prev,
                                      [disp.id]: nextDrv,
                                    }))
                                  }
                                  options={countryDrivers
                                    .filter((d) => d.countryCode === disp.countryCode)
                                    .map((drv) => ({
                                      id: drv.id,
                                      label: drv.fullName,
                                      sublabel: drv.countryCode,
                                    }))}
                                />

                                <div className="flex flex-wrap gap-1">
                                  {(locale === "fr"
                                    ? ["Réaffecté unité proche", "Orientation SAMU 141", "Annulé par l'appelant"]
                                    : locale === "ar"
                                      ? ["إعادة تعيين أقرب سيارة", "توجيه SAMU 141", "ملغى من المتصل"]
                                      : ["Reassigned nearest unit", "SAMU 141 bay diversion", "Cancelled by caller"]
                                  ).map((chip) => (
                                    <button
                                      key={chip}
                                      type="button"
                                      onClick={() =>
                                        setOverrideNotes((prev) => ({
                                          ...prev,
                                          [disp.id]: chip,
                                        }))
                                      }
                                      className="rounded-full border border-[#D7E4F2] bg-[#F3F8FD] px-2.5 py-0.5 text-[10.5px] font-semibold text-[#0052A3] hover:border-[#0066CC]"
                                    >
                                      {chip}
                                    </button>
                                  ))}
                                </div>

                                <div className="flex flex-wrap gap-2">
                                  <input
                                    type="text"
                                    value={overrideNotes[disp.id] ?? ""}
                                    onChange={(e) =>
                                      setOverrideNotes((prev) => ({
                                        ...prev,
                                        [disp.id]: e.target.value,
                                      }))
                                    }
                                    placeholder={a.dispatches.overridePlaceholder}
                                    className="min-h-[36px] min-w-[180px] flex-1 rounded-xl border border-[#CBDDF0] bg-white px-3 py-1 text-xs text-slate-900"
                                  />
                                  <button
                                    type="button"
                                    disabled={busy}
                                    onClick={async () => {
                                      const saved = await handleOverrideDispatch(disp);
                                      if (saved) setEditingDispatchId(null);
                                    }}
                                    className="min-h-[36px] rounded-xl bg-[#0066CC] px-4 py-1 text-xs font-semibold text-white hover:bg-[#0052A3] disabled:opacity-50"
                                  >
                                    {a.dispatches.commitBtn}
                                  </button>
                                </div>
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                      </article>
                    );
                  })}
                </div>
              )}
            </div>
          ) : null}

          {activeTab === "disputes" ? (
            <div className="space-y-4">
              {disputeComposerOpen ? (
              <form
                onSubmit={async (e) => {
                  const ok = await handleSubmitDispute(e);
                  if (ok) setDisputeComposerOpen(false);
                }}
                className="space-y-3 rounded-2xl border border-[#BFDBFE] bg-[#F8FBFE] p-5"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-[#0066CC]" />
                    <h2 className="text-base font-semibold text-slate-900">
                      {a.disputes.formHeading}
                    </h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => setDisputeComposerOpen(false)}
                    aria-label={
                      locale === "fr"
                        ? "Fermer le formulaire de litige"
                        : locale === "ar"
                          ? "إغلاق نموذج النزاع"
                          : "Close dispute form"
                    }
                    className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-[#D7E4F2] bg-white text-slate-500 hover:text-slate-900"
                  >
                    <X className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>

                <div className="space-y-2">
                  <span className="block text-xs font-semibold text-slate-700">
                    {a.disputes.categoryLabel}
                  </span>
                  <TactilePillGroup
                    ariaLabel={a.disputes.categoryLabel}
                    size="xs"
                    value={disputeCategory}
                    onChange={(next) => setDisputeCategory(next)}
                    options={ALL_DISPUTE_CATEGORIES.map((cat) => ({
                      value: cat,
                      label: a.enums.disputeCategory[cat] ?? cat,
                    }))}
                  />
                </div>

                <EntityPicker
                  id="admin-dispute-target"
                  label={a.disputes.targetLabel}
                  placeholder={a.disputes.targetPlaceholder}
                  emptyLabel={a.disputes.targetEmpty}
                  options={disputeResourceOptions}
                  value={disputeTargetId}
                  onChange={setDisputeTargetId}
                />

                <label className="block space-y-1 text-xs font-medium text-slate-700">
                  <span>{a.disputes.subjectLabel}</span>
                  <input
                    type="text"
                    required
                    minLength={3}
                    value={disputeSubject}
                    onChange={(e) => setDisputeSubject(e.target.value)}
                    placeholder={a.disputes.subjectPlaceholder}
                    className="w-full rounded-xl border border-[#CBDDF0] bg-white px-3 py-2 text-sm text-slate-900"
                  />
                </label>

                <label className="block space-y-1 text-xs font-medium text-slate-700">
                  <span>{a.disputes.descriptionLabel}</span>
                  <textarea
                    required
                    minLength={5}
                    rows={3}
                    value={disputeDescription}
                    onChange={(e) => setDisputeDescription(e.target.value)}
                    placeholder={a.disputes.descriptionPlaceholder}
                    className="w-full rounded-xl border border-[#CBDDF0] bg-white px-3 py-2 text-sm text-slate-900"
                  />
                </label>

                <button
                  type="submit"
                  disabled={busy || !sessionToken}
                  className="min-h-[40px] rounded-xl bg-[#0066CC] px-5 py-2 text-xs font-semibold text-white hover:bg-[#0052A3] disabled:opacity-50"
                >
                  {a.disputes.submitBtn}
                </button>
              </form>
              ) : null}

              <div className="space-y-3 rounded-2xl border border-[#D7E4F2] bg-white p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-[#0066CC]" />
                    <h2 className="text-base font-semibold text-slate-950">
                      {a.disputes.queueHeading(filteredDisputes.length)}
                    </h2>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setDisputeComposerOpen((prev) => !prev)}
                      className="inline-flex h-8 items-center gap-1 rounded-xl bg-[#0066CC] px-3 text-xs font-semibold text-white transition hover:bg-[#0052A3]"
                    >
                      <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>{a.disputes.formHeading}</span>
                    </button>
                    {(["ALL", "OPEN", "UNDER_REVIEW", "RESOLVED", "DISMISSED"] as const).map(
                      (st) => (
                        <button
                          key={st}
                          type="button"
                          onClick={() => setDisputeStatusFilter(st)}
                          className={`h-8 rounded-full px-3 text-[11px] font-semibold transition ${
                            disputeStatusFilter === st
                              ? "bg-[#0066CC] text-white"
                              : "bg-white text-slate-700 shadow-2xs hover:text-[#0066CC]"
                          }`}
                        >
                          {st === "ALL"
                            ? a.disputes.filterAll
                            : locale === "en"
                              ? st.replace("_", " ")
                              : a.enums.disputeStatus[st] ?? st}
                        </button>
                      ),
                    )}
                  </div>
                </div>

                {filteredDisputes.length === 0 ? (
                  <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">
                    {a.disputes.empty}
                  </p>
                ) : (
                  <div className="space-y-3">
                    {filteredDisputes.map((ticket) => (
                      <article
                        key={ticket.id}
                        className="space-y-2.5 rounded-2xl border border-slate-200 p-4"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <p className="font-mono-tabular text-xs text-slate-500">
                              {ticket.countryCode} ·{" "}
                              {a.enums.disputeCategory[ticket.category] ??
                                ticket.category}{" "}
                              · {a.disputes.reporterPrefix} {ticket.reporterName} (
                              {formatRoleLabel(ticket.reporterRole, locale)})
                            </p>
                            <h3 className="text-sm font-semibold text-slate-900">
                              {ticket.subject}
                            </h3>
                          </div>
                          <span
                            className={`rounded border px-2 py-0.5 font-mono-tabular text-[11px] font-semibold ${
                              ticket.status === "RESOLVED"
                                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                                : ticket.status === "DISMISSED"
                                  ? "border-slate-200 bg-slate-100 text-slate-600"
                                  : "border-amber-200 bg-amber-50 text-amber-900"
                            }`}
                          >
                            {a.enums.disputeStatus[ticket.status] ?? ticket.status}
                          </span>
                        </div>
                        <p className="text-xs leading-relaxed text-slate-700">
                          {ticket.description}
                        </p>
                        {ticket.resolutionNote ? (
                          <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-700">
                            <strong>{a.disputes.resolutionNotePrefix}</strong>{" "}
                            {ticket.resolutionNote}
                          </p>
                        ) : null}

                        {isAdminViewer ? (
                          <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-2.5">
                            <input
                              type="text"
                              value={resolutionDrafts[ticket.id] ?? ""}
                              onChange={(e) =>
                                setResolutionDrafts((prev) => ({
                                  ...prev,
                                  [ticket.id]: e.target.value,
                                }))
                              }
                              placeholder={a.disputes.resolutionPlaceholder}
                              className="min-h-[36px] flex-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs text-slate-900"
                            />
                            <button
                              type="button"
                              disabled={busy || ticket.status === "UNDER_REVIEW"}
                              onClick={() =>
                                void handleResolveDispute(ticket.id, "UNDER_REVIEW")
                              }
                              className="min-h-[36px] rounded-lg border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-950 hover:bg-amber-100 disabled:opacity-50"
                            >
                              {a.disputes.markUnderReviewBtn}
                            </button>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() =>
                                void handleResolveDispute(ticket.id, "RESOLVED")
                              }
                              className="min-h-[36px] rounded-xl bg-[#0066CC] px-4 py-1 text-xs font-semibold text-white hover:bg-[#0052A3] disabled:opacity-50"
                            >
                              {a.disputes.resolveBtn}
                            </button>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() =>
                                void handleResolveDispute(ticket.id, "DISMISSED")
                              }
                              className="min-h-[36px] rounded-lg border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                            >
                              {a.disputes.dismissBtn}
                            </button>
                          </div>
                        ) : null}
                      </article>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : null}

          {activeTab === "audit" ? (
            <div className="space-y-4 rounded-2xl border border-[#D7E4F2] bg-white p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <FileCheck2 className="h-4 w-4 text-[#0066CC]" />
                  <h2 className="text-base font-semibold text-slate-950">
                    {a.audit.heading(auditLogs.length)}
                  </h2>
                </div>
                <button
                  type="button"
                  disabled={auditLogs.length === 0}
                  onClick={handleExportAuditCsv}
                  className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-white px-3.5 text-xs font-semibold text-slate-700 shadow-2xs transition hover:text-[#0066CC] disabled:opacity-50"
                >
                  <Download className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>{a.audit.exportCsvBtn}</span>
                </button>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {[
                  "",
                  "USER_LOGIN",
                  "USER_ROLE_UPDATED",
                  "USER_STATUS_UPDATED",
                  "USER_PROVISIONED_BY_ADMIN",
                  "USER_PASSWORD_CHANGED",
                  "USER_SESSIONS_REVOKED",
                  "FACILITY_VERIFICATION_UPDATED",
                  "ADMIN_DISPATCH_OVERRIDE",
                ].map((act) => (
                  <button
                    key={act || "ALL"}
                    type="button"
                    onClick={() => setAuditActionFilter(act)}
                    className={`h-7 rounded-full px-3 font-mono-tabular text-[11px] font-semibold transition ${
                      auditActionFilter === act
                        ? "bg-[#0066CC] text-white"
                        : "bg-white text-slate-700 shadow-2xs hover:text-[#0066CC]"
                    }`}
                  >
                    {act || a.audit.allActionsBtn}
                  </button>
                ))}
              </div>

              <div className="flex flex-wrap gap-1.5">
                {[
                  "",
                  "USER",
                  "FACILITY",
                  "DISPATCH",
                  "PRESCRIPTION",
                  "PHARMACY_ORDER",
                  "APPOINTMENT",
                ].map((resType) => (
                  <button
                    key={resType || "ALL_RES"}
                    type="button"
                    onClick={() => setAuditResourceFilter(resType)}
                    className={`h-7 rounded-full border px-3 font-mono-tabular text-[11px] font-semibold transition ${
                      auditResourceFilter === resType
                        ? "border-[#0F9D88] bg-[#0F9D88] text-white"
                        : "border-[#D7E4F2] bg-[#F3F8FD] text-[#2F4661] hover:border-[#0066CC] hover:bg-white"
                    }`}
                  >
                    {resType || (locale === "fr" ? "Toutes ressources" : locale === "ar" ? "كل الموارد" : "All Resources")}
                  </button>
                ))}
              </div>

              <form
                onSubmit={handleFilterAudit}
                className="grid gap-2 sm:grid-cols-3"
              >
                <input
                  type="text"
                  dir="ltr"
                  value={auditActionFilter}
                  onChange={(e) => setAuditActionFilter(e.target.value)}
                  placeholder={a.audit.actionInputPlaceholder}
                  className="min-h-[38px] rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-mono-tabular text-xs text-slate-900"
                />
                <input
                  type="text"
                  dir="ltr"
                  value={auditResourceFilter}
                  onChange={(e) => setAuditResourceFilter(e.target.value)}
                  placeholder={a.audit.resourceInputPlaceholder}
                  className="min-h-[38px] rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-mono-tabular text-xs text-slate-900"
                />
                <button
                  type="submit"
                  disabled={busy || !isAdminViewer}
                  className="min-h-[38px] rounded-xl bg-[#0066CC] px-4 py-1.5 text-xs font-semibold text-white hover:bg-[#0052A3] disabled:opacity-50"
                >
                  {a.audit.applyFilterBtn}
                </button>
              </form>

              {auditLogs.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">
                  {a.audit.empty}
                </p>
              ) : (
                <div className="space-y-2">
                  {auditLogs.map((log) => (
                    <article
                      key={log.eventId}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-100 bg-slate-50 px-3.5 py-2.5 text-xs"
                    >
                      <div className="min-w-0 space-y-0.5">
                        <p dir="ltr" className="font-mono-tabular font-semibold text-slate-900">
                          {log.action}
                        </p>
                        <p className="text-slate-600">
                          {log.countryCode} ·{" "}
                          <span dir="ltr">
                            {log.resourceType}:{log.resourceId.slice(0, 8)}
                          </span>{" "}
                          · {a.audit.actorPrefix}{" "}
                          {formatRoleLabel(log.actorRole, locale)} (
                          <span dir="ltr">{log.actorId.slice(0, 8)}</span>)
                        </p>
                        {log.metadata && Object.keys(log.metadata).length > 0 ? (
                          <p dir="ltr" className="truncate font-mono-tabular text-[11px] text-slate-500">
                            {Object.entries(log.metadata)
                              .filter(([, v]) => v !== null && v !== undefined)
                              .map(([k, v]) => {
                                if (k.endsWith("Minor")) {
                                  const numeric =
                                    typeof v === "number"
                                      ? v
                                      : typeof v === "string" && /^-?\d+$/.test(v)
                                        ? Number(v)
                                        : Number.NaN;
                                  if (Number.isFinite(numeric)) {
                                    return `${k.slice(0, -5)}=${(numeric / 100).toFixed(2)}`;
                                  }
                                }
                                return `${k}=${String(v)}`;
                              })
                              .join(" · ")}
                          </p>
                        ) : null}
                      </div>
                      <time dir="ltr" className="font-mono-tabular text-[11px] text-slate-500">
                        {log.occurredAtIso}
                      </time>
                    </article>
                  ))}
                </div>
              )}
            </div>
          ) : null}
        </section>
      </WorkspaceRoleGuard>

      {signInModalOpen && !currentUser ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={a.signInModal.ariaLabel}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-xs"
          onClick={() => setSignInModalOpen(false)}
        >
          <form
            onSubmit={handleLogin}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <KeyRound className="h-4 w-4 text-[#0066CC]" aria-hidden="true" />
                <h2 className="text-base font-bold text-slate-950">
                  {a.signInModal.title}
                </h2>
              </div>
              <button
                type="button"
                aria-label={a.signInModal.closeAria}
                onClick={() => setSignInModalOpen(false)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            <label className="block space-y-1 text-xs font-semibold text-slate-700">
              <span>{a.signInModal.emailLabel}</span>
              <input
                type="email"
                dir="ltr"
                required
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                placeholder="ops@medisync.global"
                className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900"
              />
            </label>
            <label className="block space-y-1 text-xs font-semibold text-slate-700">
              <span>{a.signInModal.passwordLabel}</span>
              <input
                type="password"
                required
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                placeholder={a.signInModal.passwordPlaceholder}
                className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900"
              />
            </label>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setSignInModalOpen(false)}
                className="h-10 rounded-xl border border-slate-200 px-4 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                {a.signInModal.cancelBtn}
              </button>
              <button
                type="submit"
                disabled={busy}
                className="h-10 rounded-xl bg-[#0066CC] px-5 text-xs font-semibold text-white hover:bg-[#0052A3] disabled:opacity-60"
              >
                {busy ? a.signInModal.verifyingBtn : a.signInModal.submitBtn}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {provisionModalOpen && sessionToken && currentUser && isOpsAdmin ? (
        <AdminProvisionUserModal
          apiBaseUrl={apiBaseUrl}
          token={sessionToken}
          packs={packs}
          facilities={facilities}
          defaultCountryCode={
            selectedScope === "ALL" ? defaultCode : selectedScope
          }
          onClose={() => setProvisionModalOpen(false)}
          onCreated={() => {
            void refreshGovernanceData(sessionToken, currentUser, selectedScope);
          }}
        />
      ) : null}
    </div>
  );
}
