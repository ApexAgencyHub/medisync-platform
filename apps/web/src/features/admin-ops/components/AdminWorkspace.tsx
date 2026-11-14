"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  DispatchStatusSchema,
  DisputeCategorySchema,
  LoginSchema,
  UserRoleSchema,
  type AdminOverviewMetrics,
  type AuditEvent,
  type AuthenticatedUser,
  type CountryPack,
  type DispatchRequestSummary,
  type DispatchStatus,
  type DisputeCategory,
  type DisputeSummary,
  type FacilityMediaDocument,
  type FacilitySummary,
  type UserMediaDocument,
  type UserRole,
} from "@medisync/contracts";
import {
  listFacilities,
  loginUser,
  verifyFacilityStatus,
} from "@/features/auth-portal";
import { listDispatchRequests } from "@/features/maps-dispatch";
import { formatRoleLabel } from "@/shared/i18n/human-labels";
import { useLocale } from "@/shared/i18n/locale-store";
import { EntityAvatar } from "@/shared/ui/EntityAvatar";
import { useImageLightbox } from "@/shared/ui/ImageLightboxProvider";
import {
  formatByteSize,
  listAdminFacilityMedia,
  listAdminUserMedia,
  reviewFacilityMediaDocument,
  reviewUserMediaDocument,
} from "@/features/media-certifications";
import { checkBackendOnline } from "@/shared/api/directory-client";
import { EntityPicker } from "@/shared/ui/EntityPicker";
import {
  clearStoredSession,
  readStoredSession,
  writeStoredSession,
} from "@/shared/auth/session-storage";
import {
  Activity,
  AlertTriangle,
  Building2,
  CheckCircle2,
  Eye,
  FileCheck2,
  FileText,
  KeyRound,
  LogOut,
  Navigation,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Users,
} from "lucide-react";
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
  | "facilities"
  | "users"
  | "dispatches"
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
  PHARMACIST: "border-indigo-300 bg-indigo-50 text-indigo-900",
  LAB_TECH: "border-cyan-300 bg-cyan-50 text-cyan-900",
  CLINIC_STAFF: "border-slate-300 bg-slate-100 text-slate-800",
  DRIVER: "border-amber-300 bg-amber-50 text-amber-900",
  CAREGIVER: "border-slate-300 bg-slate-50 text-slate-700",
  PATIENT: "border-slate-200 bg-slate-50 text-slate-700",
};

export function AdminWorkspace({ packs, apiBaseUrl }: AdminWorkspaceProps) {
  const { t } = useLocale();
  const { openImage } = useImageLightbox();
  const [selectedScope, setSelectedScope] = useState<string>("ALL");
  const [activeTab, setActiveTab] = useState<AdminTab>("overview");

  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<AuthenticatedUser | null>(
    null,
  );
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
  const [userMediaByUser, setUserMediaByUser] = useState<
    Record<string, UserMediaDocument[]>
  >({});
  const [apiOnline, setApiOnline] = useState(false);

  // User Role Governance Editor State
  const [roleDrafts, setRoleDrafts] = useState<Record<string, UserRole>>({});
  const [countryDrafts, setCountryDrafts] = useState<Record<string, string>>({});
  const [roleReason, setRoleReason] = useState("Standard permission review");

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

  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState<{
    tone: "info" | "success" | "error";
    text: string;
  } | null>(null);

  const isOpsAdmin = currentUser?.role === "OPS_ADMIN";
  const isAdminViewer =
    currentUser?.role === "OPS_ADMIN" ||
    currentUser?.role === "HOSPITAL_ADMIN";

  const effectiveCountryQuery =
    currentUser && !isOpsAdmin
      ? currentUser.countryCode
      : selectedScope === "ALL"
        ? undefined
        : selectedScope;

  const activePack =
    packs.find((pack) => pack.code === (effectiveCountryQuery ?? "INTL")) ??
    packs[0] ??
    null;

  useEffect(() => {
    const stored = readStoredSession();
    if (stored) {
      setSessionToken(stored.token);
      setCurrentUser(stored.user);
      setSelectedScope(
        stored.user.role === "OPS_ADMIN" ? "ALL" : stored.user.countryCode,
      );
    }

    let cancelled = false;
    checkBackendOnline().then((online) => {
      if (!cancelled) setApiOnline(online);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!apiOnline || !sessionToken || !currentUser) return;
    void refreshGovernanceData(sessionToken, currentUser, selectedScope);
  }, [apiOnline, sessionToken, currentUser, selectedScope]);

  const disputeResourceOptions = useMemo(
    () => [
      ...facilities.map((f) => ({
        id: f.id,
        label: `Facility: ${f.name}`,
        sublabel: `${f.kind} · ${f.licenseNumber}`,
      })),
      ...dispatches.map((d) => ({
        id: d.id,
        label: `Dispatch: ${d.pickupAddress}`,
        sublabel: `${d.urgency} · ${d.status}`,
      })),
    ],
    [facilities, dispatches],
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

    const adminCapable =
      user.role === "OPS_ADMIN" || user.role === "HOSPITAL_ADMIN";

    const disputesPromise = fetchDisputesList(apiBaseUrl, token, {
      countryCode: countryParam,
    });

    if (!adminCapable) {
      const dispRes = await disputesPromise;
      if (dispRes.ok) {
        setDisputes(dispRes.data.disputes);
      }
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
    ] = await Promise.all([
      fetchAdminOverview(apiBaseUrl, token, countryParam),
      listFacilities(apiBaseUrl, token, countryParam),
      fetchAdminUsers(apiBaseUrl, token, { countryCode: countryParam }),
      listDispatchRequests(apiBaseUrl, token, countryParam ?? user.countryCode),
      disputesPromise,
      fetchAdminAuditEvents(apiBaseUrl, token, {
        countryCode: countryParam,
        limit: 50,
      }),
      listAdminFacilityMedia(apiBaseUrl, token, {
        ...(countryParam ? { countryCode: countryParam } : {}),
        limit: 80,
      }),
    ]);

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
  }

  async function handleReviewFacilityDoc(
    mediaId: string,
    reviewStatus: "APPROVED" | "REJECTED",
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
          reviewStatus === "APPROVED"
            ? "Certificate verified by Operations Compliance Desk."
            : "Certificate rejected during compliance inspection.",
      },
    );
    setBusy(false);

    if (!res.ok) {
      setBanner({
        tone: "error",
        text: `Document review failed: ${res.error}`,
      });
      return;
    }

    setFacilityMedia((prev) =>
      prev.map((doc) => (doc.id === mediaId ? res.data.document : doc)),
    );
    setBanner({
      tone: "success",
      text: `${res.data.document.fileName} marked ${res.data.document.reviewStatus}.`,
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
          reviewStatus === "APPROVED"
            ? "Practitioner license validated by Ops Admin."
            : "Credential rejected by Ops Admin.",
      },
    );
    setBusy(false);
    if (!res.ok) {
      setBanner({
        tone: "error",
        text: `Credential review failed: ${res.error}`,
      });
      return;
    }

    setUserMediaByUser((prev) => ({
      ...prev,
      [userId]: (prev[userId] ?? []).map((doc) =>
        doc.id === mediaId ? res.data.document : doc,
      ),
    }));
    setBanner({
      tone: "success",
      text: `${res.data.document.fileName} marked ${res.data.document.reviewStatus}.`,
    });
  }

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = LoginSchema.safeParse({
      email: loginEmail,
      password: loginPassword,
    });
    if (!parsed.success) {
      setBanner({
        tone: "error",
        text: "Enter a valid operator email address and password.",
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
            ? `API unreachable at ${apiBaseUrl}. Ensure PostgreSQL, Redis & API are running.`
            : `Authentication failed (${res.error}).`,
      });
      return;
    }

    writeStoredSession(res.data);
    setSessionToken(res.data.token);
    setCurrentUser(res.data.user);
    const nextScope =
      res.data.user.role === "OPS_ADMIN" ? "ALL" : res.data.user.countryCode;
    setSelectedScope(nextScope);
    setLoginPassword("");

    await refreshGovernanceData(res.data.token, res.data.user, nextScope);
    setBusy(false);

    setBanner({
      tone: "success",
      text: `Signed in as ${res.data.user.fullName} (${res.data.user.role} · ${res.data.user.countryCode}).`,
    });
  }

  function handleSignOut() {
    clearStoredSession();
    setSessionToken(null);
    setCurrentUser(null);
    setOverview(null);
    setFacilities([]);
    setUsers([]);
    setDispatches([]);
    setDisputes([]);
    setAuditLogs([]);
    setBanner({
      tone: "info",
      text: "Signed out across all MediSync Global portals.",
    });
  }

  async function handleScopeChange(nextScope: string) {
    setSelectedScope(nextScope);
    if (sessionToken && currentUser) {
      setBusy(true);
      await refreshGovernanceData(sessionToken, currentUser, nextScope);
      setBusy(false);
    }
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
        text: `Facility status change rejected (${res.error}).`,
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
      text: `Updated "${res.data.facility.name}" status to ${res.data.facility.verificationStatus}.`,
    });
  }

  async function handleUpdateUserRole(targetUser: AuthenticatedUser) {
    if (!sessionToken || !currentUser || !isOpsAdmin) return;
    const nextRole = roleDrafts[targetUser.id] ?? targetUser.role;
    const nextCountry = (
      countryDrafts[targetUser.id] ?? targetUser.countryCode
    )
      .trim()
      .toUpperCase();

    setBusy(true);
    const res = await updateAdminUserRole(apiBaseUrl, sessionToken, targetUser.id, {
      role: nextRole,
      countryCode: nextCountry,
      reason: roleReason.trim() || undefined,
    });
    if (!res.ok) {
      setBusy(false);
      setBanner({
        tone: "error",
        text: `Role update rejected (${res.error}).`,
      });
      return;
    }

    await refreshGovernanceData(sessionToken, currentUser, selectedScope);
    setBusy(false);
    setBanner({
      tone: "success",
      text: `Reassigned ${res.data.user.fullName} to ${res.data.user.role} (${res.data.user.countryCode}).`,
    });
  }

  async function handleOverrideDispatch(dispatch: DispatchRequestSummary) {
    if (!sessionToken || !currentUser || !isAdminViewer) return;
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
        text: `Dispatch override failed (${res.error}).`,
      });
      return;
    }

    await refreshGovernanceData(sessionToken, currentUser, selectedScope);
    setBusy(false);
    setBanner({
      tone: "success",
      text: `Dispatch ${res.data.dispatch.id.slice(0, 8)} status updated to ${res.data.dispatch.status} on live boards.`,
    });
  }

  async function handleSubmitDispute(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!sessionToken || !currentUser) return;

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
        text: `Dispute filing failed (${res.error}).`,
      });
      return;
    }

    setDisputeSubject("");
    setDisputeDescription("");
    setDisputeTargetId("");
    await refreshGovernanceData(sessionToken, currentUser, selectedScope);
    setBusy(false);
    setBanner({
      tone: "success",
      text: `Dispute "${res.data.dispute.subject}" logged (${res.data.dispute.status}).`,
    });
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
        text: `Dispute resolution failed (${res.error}).`,
      });
      return;
    }

    await refreshGovernanceData(sessionToken, currentUser, selectedScope);
    setBusy(false);
    setBanner({
      tone: "success",
      text: `Dispute ${res.data.dispute.id.slice(0, 8)} transitioned to ${res.data.dispute.status}.`,
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
        text: `Audit query failed (${res.error}).`,
      });
      return;
    }
    setAuditLogs(res.data.logs);
  }

  const countryDrivers = users.filter((u) => u.role === "DRIVER");

  const kpiCards = [
    {
      label: "Registered Users",
      value: overview ? String(overview.totalUsers) : "-",
      detail: overview?.countryCode ?? "Global Scope",
    },
    {
      label: "Pending Licenses",
      value: overview ? String(overview.pendingVerificationFacilities) : "-",
      detail: overview ? `${overview.totalFacilities} total facilities` : "Sync required",
    },
    {
      label: "Active Dispatches",
      value: overview ? String(overview.activeDispatches) : "-",
      detail: "Live EMS pipeline",
    },
    {
      label: "Booked Visits",
      value: overview ? String(overview.activeAppointments) : "-",
      detail: "Confirmed & checked-in",
    },
    {
      label: "Issued Rx QR",
      value: overview ? String(overview.openPrescriptions) : "-",
      detail: "Awaiting pharmacy scan",
    },
    {
      label: "Open Lab Orders",
      value: overview ? String(overview.pendingLabOrders) : "-",
      detail: "Ordered or sampled",
    },
    {
      label: "Open Disputes",
      value: overview ? String(overview.openDisputes) : "-",
      detail: "Safety & service quality queue",
    },
  ];

  const tabs: readonly { id: AdminTab; label: string }[] = [
    { id: "overview", label: "Overview" },
    { id: "facilities", label: `Facilities (${facilities.length})` },
    { id: "users", label: `Staff & Users (${users.length})` },
    { id: "dispatches", label: `Dispatches (${dispatches.length})` },
    { id: "disputes", label: `Disputes (${disputes.length})` },
    { id: "audit", label: `Activity Log (${auditLogs.length})` },
  ];

  return (
    <div className="space-y-6">
      {/* Header & Region Selector */}
      <section
        aria-label="Master Administration Command Bar"
        className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs"
      >
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="font-mono-tabular text-xs font-semibold uppercase tracking-wider text-teal-800">
              {t("admin.eyebrow")}
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
              {t("admin.heading")}
            </h1>
            {activePack ? (
              <p className="mt-1 text-sm text-slate-600">
                Region Focus:{" "}
                <strong className="text-slate-900">
                  {selectedScope === "ALL" && isOpsAdmin
                    ? "Global All-Countries View"
                    : activePack.name}
                </strong>{" "}
                · Ambulance{" "}
                <span className="font-mono-tabular font-semibold text-red-700">
                  {activePack.emergencyHotlines.ambulance}
                </span>{" "}
                · Currency{" "}
                <span className="font-mono-tabular">
                  {activePack.currencyCode}
                </span>
              </p>
            ) : null}
          </div>

          <div
            className="flex flex-wrap gap-2"
            role="group"
            aria-label="Admin region filter"
          >
            {isOpsAdmin || !currentUser ? (
              <button
                type="button"
                onClick={() => void handleScopeChange("ALL")}
                className={`min-h-[40px] rounded-lg border px-3 py-1.5 font-mono-tabular text-xs font-semibold transition-colors ${
                  selectedScope === "ALL"
                    ? "border-teal-800 bg-teal-800 text-white"
                    : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
                }`}
              >
                ALL · Global
              </button>
            ) : null}
            {packs.map((pack) => {
              const selected =
                (currentUser && !isOpsAdmin
                  ? currentUser.countryCode
                  : selectedScope) === pack.code;
              const disabled = Boolean(
                currentUser && !isOpsAdmin && currentUser.countryCode !== pack.code,
              );
              return (
                <button
                  key={pack.code}
                  type="button"
                  disabled={disabled}
                  onClick={() => void handleScopeChange(pack.code)}
                  className={`min-h-[40px] rounded-lg border px-3 py-1.5 font-mono-tabular text-xs font-semibold transition-colors ${
                    selected
                      ? "border-teal-800 bg-teal-800 text-white"
                      : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
                  } ${disabled ? "cursor-not-allowed opacity-45" : ""}`}
                >
                  {pack.code}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Regional Overview Metrics */}
      <section aria-label="Operational overview metrics">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
          {kpiCards.map((kpi) => (
            <article
              key={kpi.label}
              className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs"
            >
              <p className="text-xs font-medium text-slate-500">{kpi.label}</p>
              <p className="mt-1 font-mono-tabular text-2xl font-bold text-slate-900">
                {kpi.value}
              </p>
              <p className="mt-0.5 font-mono-tabular text-[11px] text-slate-500">
                {kpi.detail}
              </p>
            </article>
          ))}
        </div>
      </section>

      {banner ? (
        <div
          role={banner.tone === "error" ? "alert" : "status"}
          className={`flex items-start gap-2.5 rounded-xl border px-4 py-3 text-sm ${
            banner.tone === "error"
              ? "border-red-200 bg-red-50 text-red-900"
              : banner.tone === "success"
                ? "border-teal-200 bg-teal-50 text-teal-900"
                : "border-slate-200 bg-white text-slate-800"
          }`}
        >
          {banner.tone === "error" ? (
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
          ) : (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          )}
          <span className="break-words">{banner.text}</span>
        </div>
      ) : null}

      {/* Staff Session + Regional Oversight Workspace */}
      <div className="grid gap-6 lg:grid-cols-12">
        <aside className="min-w-0 space-y-4 lg:col-span-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
            {currentUser ? (
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-3">
                    <EntityAvatar
                      name={currentUser.fullName}
                      role={currentUser.role}
                      avatarUrl={currentUser.avatarUrl}
                      size="md"
                    />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold uppercase tracking-wide text-teal-800">
                        Signed-in Account
                      </p>
                      <h2 className="truncate text-lg font-semibold text-slate-900">
                        {currentUser.fullName}
                      </h2>
                      <p className="truncate text-xs text-slate-500">
                        {currentUser.email}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleSignOut}
                    className="inline-flex min-h-[36px] shrink-0 items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                    Sign out
                  </button>
                </div>

                <dl className="grid grid-cols-2 gap-2 rounded-xl border border-slate-100 bg-slate-50 p-3 text-xs">
                  <div>
                    <dt className="text-slate-500">Access Level</dt>
                    <dd className="font-semibold text-slate-900">
                      {formatRoleLabel(currentUser.role)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Care Region</dt>
                    <dd className="font-mono-tabular font-semibold text-slate-900">
                      {currentUser.countryCode}
                    </dd>
                  </div>
                </dl>

                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    if (sessionToken && currentUser) {
                      void refreshGovernanceData(
                        sessionToken,
                        currentUser,
                        selectedScope,
                      );
                    }
                  }}
                  className="inline-flex min-h-[40px] w-full items-center justify-center gap-2 rounded-lg bg-teal-800 px-3 py-2 text-xs font-semibold text-white hover:bg-teal-900 disabled:opacity-60"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Refresh Live Status
                </button>

                {!isAdminViewer ? (
                  <p className="rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-900">
                    Signed in as {formatRoleLabel(currentUser.role)}. Network
                    oversight tabs require Platform or Hospital Admin access; you
                    may still submit and track service issue reports.
                  </p>
                ) : null}
              </div>
            ) : (
              <form onSubmit={handleLogin} className="space-y-3">
                <div className="flex items-center gap-2">
                  <KeyRound className="h-4 w-4 text-teal-800" />
                  <h2 className="text-base font-semibold text-slate-900">
                    Sign In for Operations
                  </h2>
                </div>
                <p className="text-xs leading-relaxed text-slate-600">
                  Sign in with a Platform Admin, Hospital Admin, or member account
                  to view live facility activity or report a care issue.
                </p>
                <label className="block space-y-1 text-xs font-medium text-slate-700">
                  <span>Email Address</span>
                  <input
                    type="email"
                    required
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    placeholder="ops@medisync.global"
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                  />
                </label>
                <label className="block space-y-1 text-xs font-medium text-slate-700">
                  <span>Password</span>
                  <input
                    type="password"
                    required
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="Minimum 10 characters"
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                  />
                </label>
                <button
                  type="submit"
                  disabled={busy}
                  className="min-h-[42px] w-full rounded-lg bg-teal-800 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-900 disabled:opacity-60"
                >
                  {busy ? "Verifying Credentials..." : "Sign In to Admin Desk"}
                </button>
              </form>
            )}
          </div>
        </aside>

        {/* Main Operational Tabs */}
        <section className="min-w-0 space-y-4 lg:col-span-8">
          <div
            className="flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-xs"
            role="tablist"
            aria-label="Admin workspace views"
          >
            {tabs.map((tab) => {
              const selected = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  role="tab"
                  aria-selected={selected}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`min-h-[40px] rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors ${
                    selected
                      ? "bg-teal-800 text-white"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {activeTab === "overview" ? (
            <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-teal-800" />
                  <h2 className="text-base font-semibold text-slate-900">
                    Recent Activity & Compliance Log
                  </h2>
                </div>
                <span className="text-xs font-medium text-slate-500">
                  Tamper-evident record
                </span>
              </div>

              {overview?.recentAuditLogs && overview.recentAuditLogs.length > 0 ? (
                <div className="space-y-2">
                  {overview.recentAuditLogs.map((log) => (
                    <article
                      key={log.eventId}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-100 bg-slate-50 px-3.5 py-2.5 text-xs"
                    >
                      <div className="space-y-0.5">
                        <p className="font-mono-tabular font-semibold text-slate-900">
                          {log.action}{" "}
                          <span className="font-normal text-slate-500">
                            on {log.resourceType}:{log.resourceId.slice(0, 8)}
                          </span>
                        </p>
                        <p className="text-slate-600">
                          Actor {log.actorRole} ({log.actorId.slice(0, 8)}) ·{" "}
                          {log.countryCode}
                        </p>
                      </div>
                      <time className="font-mono-tabular text-[11px] text-slate-500">
                        {log.occurredAtIso}
                      </time>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">
                  Sign in as a Platform Admin or Hospital Admin and click
                  Refresh to inspect live network activity and metrics.
                </p>
              )}
            </div>
          ) : null}

          {activeTab === "facilities" ? (
            <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-teal-800" />
                <h2 className="text-base font-semibold text-slate-900">
                  License Verification & Suspension
                </h2>
              </div>

              {facilities.length === 0 ? (
                <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">
                  No facilities loaded in this scope yet.
                </p>
              ) : (
                <div className="space-y-3">
                  {facilities.map((fac) => {
                    const attachedDocs = facilityMedia.filter(
                      (doc) => doc.facilityId === fac.id,
                    );
                    return (
                      <article
                        key={fac.id}
                        className="space-y-3 rounded-xl border border-slate-200 p-4"
                      >
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="text-sm font-semibold text-slate-900">
                                {fac.name}
                              </h3>
                              <span className="rounded bg-slate-100 px-2 py-0.5 font-mono-tabular text-[11px] font-semibold text-slate-700">
                                {fac.kind}
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
                                {fac.verificationStatus}
                              </span>
                            </div>
                            <p className="font-mono-tabular text-xs text-slate-600">
                              {fac.countryCode} · License {fac.licenseNumber}
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
                                className="min-h-[36px] rounded-lg bg-teal-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-900 disabled:opacity-45"
                              >
                                Verify
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
                                Suspend
                              </button>
                            </div>
                          ) : null}
                        </div>

                        {attachedDocs.length > 0 ? (
                          <div className="space-y-1.5 border-t border-slate-100 pt-2.5">
                            <p className="font-mono-tabular text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                              Submitted Certifications & Photos ({attachedDocs.length})
                            </p>
                            {attachedDocs.map((doc) => (
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
                                    {doc.reviewStatus}
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
                                          subtitle: `${fac.name} · ${doc.category} · ${doc.reviewStatus}`,
                                          badge: doc.reviewStatus,
                                        })
                                      }
                                      className="inline-flex min-h-[30px] items-center gap-1 rounded border border-slate-300 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 hover:border-teal-700"
                                    >
                                      <Eye
                                        className="h-3 w-3"
                                        aria-hidden="true"
                                      />
                                      <span>Inspect</span>
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
                                        className="min-h-[30px] rounded bg-emerald-700 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-emerald-800 disabled:opacity-45"
                                      >
                                        Approve
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
                                        Reject
                                      </button>
                                    </>
                                  ) : null}
                                </div>
                              </div>
                            ))}
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
            <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-teal-800" />
                  <h2 className="text-base font-semibold text-slate-900">
                    Team Roles & Regional Access
                  </h2>
                </div>
                {isOpsAdmin ? (
                  <input
                    type="text"
                    value={roleReason}
                    onChange={(e) => setRoleReason(e.target.value)}
                    aria-label="Audit reason for role changes"
                    placeholder="Reason recorded in audit log"
                    className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-800"
                  />
                ) : null}
              </div>

              {users.length === 0 ? (
                <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">
                  No user directory rows loaded. Sign in as admin to inspect accounts.
                </p>
              ) : (
                <div className="space-y-2.5">
                  {users.map((user) => {
                    const draftRole = roleDrafts[user.id] ?? user.role;
                    const draftCountry =
                      countryDrafts[user.id] ?? user.countryCode;
                    const isSelfOpsGuard =
                      currentUser?.id === user.id && draftRole !== "OPS_ADMIN";

                    return (
                      <article
                        key={user.id}
                        className="flex flex-col gap-3 rounded-xl border border-slate-200 p-4"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2.5">
                            <EntityAvatar
                              name={user.fullName}
                              role={user.role}
                              avatarUrl={user.avatarUrl}
                              size="sm"
                            />
                            <div>
                              <h3 className="text-sm font-semibold text-slate-900">
                                {user.fullName}
                              </h3>
                              <p className="text-xs text-slate-500">
                                {user.email}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                void handleLoadUserCredentials(user.id)
                              }
                              className="rounded border border-slate-300 bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-700 hover:border-teal-700"
                            >
                              Credentials
                            </button>
                            <span
                              className={`rounded border px-2 py-0.5 text-[11px] font-semibold ${ROLE_BADGE_COLORS[user.role]}`}
                            >
                              {formatRoleLabel(user.role)} · {user.countryCode}
                            </span>
                          </div>
                        </div>

                        {userMediaByUser[user.id] &&
                        userMediaByUser[user.id]!.length > 0 ? (
                          <div className="space-y-1 border-t border-slate-100 pt-2">
                            {userMediaByUser[user.id]!.map((doc) => (
                              <div
                                key={doc.id}
                                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs"
                              >
                                <span className="truncate font-medium text-slate-800">
                                  {doc.fileName} ({doc.category} ·{" "}
                                  {doc.reviewStatus})
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
                                          badge: doc.reviewStatus,
                                        })
                                      }
                                      className="rounded border border-slate-300 bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-700"
                                    >
                                      Inspect
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
                                        className="rounded bg-emerald-700 px-2 py-0.5 text-[11px] font-semibold text-white disabled:opacity-45"
                                      >
                                        Approve
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
                                        Reject
                                      </button>
                                    </>
                                  ) : null}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : null}

                        {isOpsAdmin ? (
                          <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
                            <select
                              aria-label={`Role for ${user.fullName}`}
                              value={draftRole}
                              onChange={(e) =>
                                setRoleDrafts((prev) => ({
                                  ...prev,
                                  [user.id]: UserRoleSchema.parse(e.target.value),
                                }))
                              }
                              className="min-h-[36px] rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-900"
                            >
                              {ALL_ROLES.map((roleOpt) => (
                                <option key={roleOpt} value={roleOpt}>
                                  {roleOpt}
                                </option>
                              ))}
                            </select>

                            <input
                              type="text"
                              aria-label={`CountryCode for ${user.fullName}`}
                              value={draftCountry}
                              maxLength={4}
                              onChange={(e) =>
                                setCountryDrafts((prev) => ({
                                  ...prev,
                                  [user.id]: e.target.value.toUpperCase(),
                                }))
                              }
                              className="min-h-[36px] w-20 rounded-lg border border-slate-300 bg-white px-2.5 py-1 font-mono-tabular text-xs font-semibold text-slate-900"
                            />

                            <button
                              type="button"
                              disabled={busy || isSelfOpsGuard}
                              onClick={() => void handleUpdateUserRole(user)}
                              className="min-h-[36px] rounded-lg bg-teal-800 px-3 py-1 text-xs font-semibold text-white hover:bg-teal-900 disabled:opacity-45"
                            >
                              {isSelfOpsGuard ? "Self-Demotion Blocked" : "Apply Role"}
                            </button>
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
            <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
              <div className="flex items-center gap-2">
                <Navigation className="h-4 w-4 text-teal-800" />
                <h2 className="text-base font-semibold text-slate-900">
                  Live Dispatch Manual Overrides
                </h2>
              </div>

              {dispatches.length === 0 ? (
                <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">
                  No active medical transport requests in this region.
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
                        className="space-y-3 rounded-xl border border-slate-200 p-4"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <p className="font-mono-tabular text-xs font-semibold text-slate-900">
                              {disp.urgency} · {disp.countryCode} ·{" "}
                              {disp.id.slice(0, 8)}
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
                            {disp.status}
                          </span>
                        </div>

                        {isAdminViewer ? (
                          <div className="grid gap-2 border-t border-slate-100 pt-3 sm:grid-cols-4">
                            <select
                              aria-label={`Override status for ${disp.id}`}
                              value={draftStatus}
                              onChange={(e) =>
                                setOverrideStatusDrafts((prev) => ({
                                  ...prev,
                                  [disp.id]: DispatchStatusSchema.parse(
                                    e.target.value,
                                  ),
                                }))
                              }
                              className="min-h-[36px] rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-900"
                            >
                              {ALL_DISPATCH_STATUSES.map((st) => (
                                <option key={st} value={st}>
                                  {st}
                                </option>
                              ))}
                            </select>

                            <select
                              aria-label={`Assign driver for ${disp.id}`}
                              value={draftDriver}
                              onChange={(e) =>
                                setOverrideDriverDrafts((prev) => ({
                                  ...prev,
                                  [disp.id]: e.target.value,
                                }))
                              }
                              className="min-h-[36px] rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs text-slate-900"
                            >
                              <option value="">Keep / Unassigned</option>
                              {countryDrivers
                                .filter((d) => d.countryCode === disp.countryCode)
                                .map((drv) => (
                                  <option key={drv.id} value={drv.id}>
                                    {drv.fullName} ({drv.countryCode})
                                  </option>
                                ))}
                            </select>

                            <input
                              type="text"
                              value={overrideNotes[disp.id] ?? ""}
                              onChange={(e) =>
                                setOverrideNotes((prev) => ({
                                  ...prev,
                                  [disp.id]: e.target.value,
                                }))
                              }
                              placeholder="Override note (min 3 chars)"
                              className="min-h-[36px] rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs text-slate-900"
                            />

                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => void handleOverrideDispatch(disp)}
                              className="min-h-[36px] rounded-lg bg-teal-800 px-3 py-1 text-xs font-semibold text-white hover:bg-teal-900 disabled:opacity-50"
                            >
                              Commit Override
                            </button>
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
              <form
                onSubmit={handleSubmitDispute}
                className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs"
              >
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-teal-800" />
                  <h2 className="text-base font-semibold text-slate-900">
                    Report Care Issue or Service Dispute
                  </h2>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block space-y-1 text-xs font-medium text-slate-700">
                    <span>Category</span>
                    <select
                      value={disputeCategory}
                      onChange={(e) =>
                        setDisputeCategory(
                          DisputeCategorySchema.parse(e.target.value),
                        )
                      }
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                    >
                      {ALL_DISPUTE_CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </label>

                  <EntityPicker
                    id="admin-dispute-target"
                    label="Affected Facility or Dispatch (Optional)"
                    placeholder="Filter by facility or dispatch..."
                    emptyLabel="General platform incident"
                    options={disputeResourceOptions}
                    value={disputeTargetId}
                    onChange={setDisputeTargetId}
                  />
                </div>

                <label className="block space-y-1 text-xs font-medium text-slate-700">
                  <span>Subject</span>
                  <input
                    type="text"
                    required
                    minLength={3}
                    value={disputeSubject}
                    onChange={(e) => setDisputeSubject(e.target.value)}
                    placeholder="Summary of clinical, dispatch, or compliance issue"
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                  />
                </label>

                <label className="block space-y-1 text-xs font-medium text-slate-700">
                  <span>Detailed Incident Description</span>
                  <textarea
                    required
                    minLength={5}
                    rows={3}
                    value={disputeDescription}
                    onChange={(e) => setDisputeDescription(e.target.value)}
                    placeholder="Provide timeline, facility, or incident details..."
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                  />
                </label>

                <button
                  type="submit"
                  disabled={busy || !sessionToken}
                  className="min-h-[40px] rounded-lg bg-teal-800 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-900 disabled:opacity-50"
                >
                  Submit Dispute Ticket
                </button>
              </form>

              <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-teal-800" />
                  <h2 className="text-base font-semibold text-slate-900">
                    Active Disputes Queue
                  </h2>
                </div>

                {disputes.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">
                    No disputes recorded in this scope.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {disputes.map((ticket) => (
                      <article
                        key={ticket.id}
                        className="space-y-2.5 rounded-xl border border-slate-200 p-4"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <p className="font-mono-tabular text-xs text-slate-500">
                              {ticket.countryCode} · {ticket.category} · Reporter{" "}
                              {ticket.reporterName} ({ticket.reporterRole})
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
                            {ticket.status}
                          </span>
                        </div>
                        <p className="text-xs leading-relaxed text-slate-700">
                          {ticket.description}
                        </p>
                        {ticket.resolutionNote ? (
                          <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-700">
                            <strong>Resolution Note:</strong> {ticket.resolutionNote}
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
                              placeholder="Resolution decision note..."
                              className="min-h-[36px] flex-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs text-slate-900"
                            />
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() =>
                                void handleResolveDispute(ticket.id, "RESOLVED")
                              }
                              className="min-h-[36px] rounded-lg bg-teal-800 px-3 py-1 text-xs font-semibold text-white hover:bg-teal-900 disabled:opacity-50"
                            >
                              Resolve
                            </button>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() =>
                                void handleResolveDispute(ticket.id, "DISMISSED")
                              }
                              className="min-h-[36px] rounded-lg border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                            >
                              Dismiss
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
            <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
              <div className="flex items-center gap-2">
                <FileCheck2 className="h-4 w-4 text-teal-800" />
                <h2 className="text-base font-semibold text-slate-900">
                  Searchable Activity Log
                </h2>
              </div>

              <form
                onSubmit={handleFilterAudit}
                className="grid gap-2 sm:grid-cols-3"
              >
                <input
                  type="text"
                  value={auditActionFilter}
                  onChange={(e) => setAuditActionFilter(e.target.value)}
                  placeholder="Filter action (e.g. USER_ROLE_UPDATED)"
                  className="min-h-[38px] rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-mono-tabular text-xs text-slate-900"
                />
                <input
                  type="text"
                  value={auditResourceFilter}
                  onChange={(e) => setAuditResourceFilter(e.target.value)}
                  placeholder="Resource type (e.g. dispatch_request)"
                  className="min-h-[38px] rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-mono-tabular text-xs text-slate-900"
                />
                <button
                  type="submit"
                  disabled={busy || !isAdminViewer}
                  className="min-h-[38px] rounded-lg bg-teal-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-900 disabled:opacity-50"
                >
                  Apply Audit Filter
                </button>
              </form>

              {auditLogs.length === 0 ? (
                <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">
                  No audit events match the active filter.
                </p>
              ) : (
                <div className="space-y-2">
                  {auditLogs.map((log) => (
                    <article
                      key={log.eventId}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-100 bg-slate-50 px-3.5 py-2.5 text-xs"
                    >
                      <div>
                        <p className="font-mono-tabular font-semibold text-slate-900">
                          {log.action}
                        </p>
                        <p className="text-slate-600">
                          {log.countryCode} · {log.resourceType}:
                          {log.resourceId.slice(0, 8)} · Actor {log.actorRole} (
                          {log.actorId.slice(0, 8)})
                        </p>
                      </div>
                      <time className="font-mono-tabular text-[11px] text-slate-500">
                        {log.occurredAtIso}
                      </time>
                    </article>
                  ))}
                </div>
              )}
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}
