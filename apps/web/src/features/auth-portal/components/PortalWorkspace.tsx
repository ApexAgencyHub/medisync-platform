"use client";

import { useState, type FormEvent } from "react";
import {
  CreateFacilitySchema,
  FacilityKindSchema,
  LoginSchema,
  PublicSelfRegisterRoleSchema,
  RegisterUserSchema,
  type AuthenticatedUser,
  type CountryPack,
  type FacilityKind,
  type FacilitySummary,
  type PublicSelfRegisterRole,
} from "@medisync/contracts";
import { validateFacilityLicense } from "@medisync/country-packs";
import {
  Building2,
  CheckCircle2,
  KeyRound,
  LogOut,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  UserPlus,
} from "lucide-react";
import {
  createFacility,
  listFacilities,
  loginUser,
  registerUser,
  verifyFacilityStatus,
} from "../api-client";

type PortalTab = "signin" | "register" | "facility";

interface PortalWorkspaceProps {
  packs: readonly CountryPack[];
  apiBaseUrl: string;
}

const ROLE_LABELS: Record<PublicSelfRegisterRole, string> = {
  PATIENT: "Patient",
  CAREGIVER: "Caregiver / Family",
  DOCTOR: "Physician / Specialist",
  CLINIC_STAFF: "Clinic Coordinator",
  HOSPITAL_ADMIN: "Hospital Administrator",
  DRIVER: "Medical Transport Driver",
  PHARMACIST: "Licensed Pharmacist",
  LAB_TECH: "Diagnostic Lab Technologist",
};

const FACILITY_KIND_LABELS: Record<FacilityKind, string> = {
  CLINIC: "Medical Clinic",
  HOSPITAL: "Acute Hospital",
  PHARMACY: "Dispensing Pharmacy",
  DIAGNOSTIC_LAB: "Diagnostic Laboratory",
};

export function PortalWorkspace({ packs, apiBaseUrl }: PortalWorkspaceProps) {
  const defaultPackCode = packs[0]?.code ?? "INTL";
  const [activeTab, setActiveTab] = useState<PortalTab>("signin");
  const [selectedCountry, setSelectedCountry] = useState<string>(defaultPackCode);

  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<AuthenticatedUser | null>(null);
  const [facilities, setFacilities] = useState<FacilitySummary[]>([]);

  const [busy, setBusy] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{
    tone: "info" | "success" | "error";
    text: string;
  } | null>(null);

  // Sign-In Form State
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  // Registration Form State
  const [regEmail, setRegEmail] = useState("");
  const [regFullName, setRegFullName] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regRole, setRegRole] = useState<PublicSelfRegisterRole>("PATIENT");

  // Facility Onboarding Form State
  const [facName, setFacName] = useState("");
  const [facKind, setFacKind] = useState<FacilityKind>("CLINIC");
  const [facLicense, setFacLicense] = useState("");
  const [facAddress, setFacAddress] = useState("");
  const [facLat, setFacLat] = useState("33.5731");
  const [facLng, setFacLng] = useState("-7.5898");

  const activePack =
    packs.find((p) => p.code === selectedCountry) ?? packs[0] ?? null;

  const licenseMatchesPack =
    facLicense.trim().length > 0 &&
    validateFacilityLicense(selectedCountry, facLicense);

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
          ? `Could not reach API at ${apiBaseUrl}. Ensure PostgreSQL + API server are running.`
          : `Unable to load scoped facilities (${res.error}).`,
    });
  }

  async function handleLoginSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = LoginSchema.safeParse({
      email: loginEmail,
      password: loginPassword,
    });
    if (!parsed.success) {
      setStatusMessage({
        tone: "error",
        text: "Enter a valid email address and password.",
      });
      return;
    }

    setBusy(true);
    setStatusMessage(null);
    const res = await loginUser(apiBaseUrl, parsed.data);
    setBusy(false);

    if (!res.ok) {
      setStatusMessage({
        tone: "error",
        text:
          res.error === "API_UNREACHABLE"
            ? `API server unreachable at ${apiBaseUrl}. Start apps/api with Docker PostGIS to authenticate.`
            : `Sign-in rejected (${res.error}).`,
      });
      return;
    }

    setSessionToken(res.data.token);
    setCurrentUser(res.data.user);
    setSelectedCountry(res.data.user.countryCode);
    setStatusMessage({
      tone: "success",
      text: `Authenticated as ${res.data.user.fullName} (${res.data.user.role} · ${res.data.user.countryCode}).`,
    });
    await refreshScopedFacilities(res.data.token, res.data.user.countryCode);
  }

  async function handleRegisterSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = RegisterUserSchema.safeParse({
      email: regEmail,
      password: regPassword,
      fullName: regFullName,
      role: regRole,
      countryCode: selectedCountry,
    });

    if (!parsed.success) {
      setStatusMessage({
        tone: "error",
        text: "Provide a valid email, full name (min 2 chars), and password (min 8 chars).",
      });
      return;
    }

    setBusy(true);
    setStatusMessage(null);
    const res = await registerUser(apiBaseUrl, parsed.data);
    setBusy(false);

    if (!res.ok) {
      setStatusMessage({
        tone: "error",
        text:
          res.error === "API_UNREACHABLE"
            ? `API server unreachable at ${apiBaseUrl}. Start apps/api with Docker PostGIS to register accounts.`
            : `Registration failed (${res.error}).`,
      });
      return;
    }

    setSessionToken(res.data.token);
    setCurrentUser(res.data.user);
    setStatusMessage({
      tone: "success",
      text: `Registered ${res.data.user.role} account under CountryPack ${res.data.user.countryCode}.`,
    });
    await refreshScopedFacilities(res.data.token, res.data.user.countryCode);
  }

  async function handleFacilitySubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!sessionToken || !currentUser) {
      setStatusMessage({
        tone: "error",
        text: "Sign in or register with a clinical or admin role before registering a medical facility.",
      });
      return;
    }

    const parsed = CreateFacilitySchema.safeParse({
      name: facName,
      kind: facKind,
      countryCode: selectedCountry,
      licenseNumber: facLicense,
      lat: Number(facLat),
      lng: Number(facLng),
      address: facAddress,
    });

    if (!parsed.success) {
      setStatusMessage({
        tone: "error",
        text: "Complete all facility fields and supply valid GPS coordinates (-90..90 lat, -180..180 lng).",
      });
      return;
    }

    if (!validateFacilityLicense(parsed.data.countryCode, parsed.data.licenseNumber)) {
      setStatusMessage({
        tone: "error",
        text: `License "${parsed.data.licenseNumber}" does not match jurisdiction pattern for ${parsed.data.countryCode}.`,
      });
      return;
    }

    setBusy(true);
    setStatusMessage(null);
    const res = await createFacility(apiBaseUrl, sessionToken, parsed.data);
    setBusy(false);

    if (!res.ok) {
      setStatusMessage({
        tone: "error",
        text:
          res.error === "API_UNREACHABLE"
            ? `API server unreachable at ${apiBaseUrl}.`
            : `Facility submission rejected (${res.error}).`,
      });
      return;
    }

    setFacilities((prev) => [res.data.facility, ...prev]);
    setFacName("");
    setFacLicense("");
    setFacAddress("");
    setStatusMessage({
      tone: "success",
      text: `Facility "${res.data.facility.name}" indexed in PostGIS (${res.data.facility.verificationStatus}).`,
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
        text: `Verification update failed (${res.error}).`,
      });
      return;
    }
    setFacilities((prev) =>
      prev.map((item) => (item.id === facilityId ? res.data.facility : item)),
    );
    setStatusMessage({
      tone: "success",
      text: `Verified "${res.data.facility.name}" for public patient discovery.`,
    });
  }

  function handleSignOut() {
    setSessionToken(null);
    setCurrentUser(null);
    setFacilities([]);
    setStatusMessage({
      tone: "info",
      text: "Signed out of local browser session.",
    });
  }

  return (
    <div className="space-y-6">
      {/* Jurisdiction Context Bar */}
      <section
        aria-label="Jurisdiction Selection Bar"
        className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs"
      >
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="font-mono-tabular text-xs font-semibold uppercase tracking-wider text-teal-800">
              Sovereign Identity & Facility Onboarding
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
              Clinical & Ops Access Portal
            </h1>
            {activePack ? (
              <p className="mt-1 text-sm text-slate-600">
                Jurisdiction: <strong className="text-slate-900">{activePack.name}</strong> ·
                Layout <span className="font-mono-tabular">{activePack.direction.toUpperCase()}</span> ·
                Emergency{" "}
                <span className="font-mono-tabular font-semibold text-red-700">
                  {activePack.emergencyHotlines.ambulance}
                </span>{" "}
                · License Regex{" "}
                <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono-tabular text-xs text-slate-800">
                  {activePack.licenseNumberPattern}
                </code>
              </p>
            ) : null}
          </div>

          <div
            className="flex flex-wrap gap-2"
            role="group"
            aria-label="Portal CountryPack selector"
          >
            {packs.map((pack) => {
              const selected = pack.code === selectedCountry;
              return (
                <button
                  key={pack.code}
                  type="button"
                  onClick={() => setSelectedCountry(pack.code)}
                  className={`min-h-[40px] rounded-lg border px-3 py-1.5 font-mono-tabular text-xs font-semibold transition-colors active:scale-[0.99] ${
                    selected
                      ? "border-teal-800 bg-teal-800 text-white"
                      : "border-slate-200 bg-slate-50 text-slate-700 hover:border-teal-700 hover:text-teal-800"
                  }`}
                >
                  {pack.code}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {statusMessage ? (
        <div
          role="status"
          className={`flex items-start gap-2.5 rounded-xl border px-4 py-3 text-sm font-medium ${
            statusMessage.tone === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-900"
              : statusMessage.tone === "error"
                ? "border-red-200 bg-red-50 text-red-900"
                : "border-slate-200 bg-white text-slate-800"
          }`}
        >
          {statusMessage.tone === "success" ? (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" aria-hidden="true" />
          ) : statusMessage.tone === "error" ? (
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-red-700" aria-hidden="true" />
          ) : (
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-teal-800" aria-hidden="true" />
          )}
          <span>{statusMessage.text}</span>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-12">
        {/* Left Column: Auth & Onboarding Workspace */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs lg:col-span-7">
          <div
            role="tablist"
            aria-label="Portal workflow modes"
            className="grid grid-cols-3 gap-2 rounded-xl bg-slate-100 p-1"
          >
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "signin"}
              onClick={() => setActiveTab("signin")}
              className={`flex min-h-[44px] items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-colors sm:text-sm ${
                activeTab === "signin"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <KeyRound className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>Sign In</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "register"}
              onClick={() => setActiveTab("register")}
              className={`flex min-h-[44px] items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-colors sm:text-sm ${
                activeTab === "register"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <UserPlus className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>Register</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "facility"}
              onClick={() => setActiveTab("facility")}
              className={`flex min-h-[44px] items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-colors sm:text-sm ${
                activeTab === "facility"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Building2 className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>Onboard Facility</span>
            </button>
          </div>

          {activeTab === "signin" ? (
            <form onSubmit={handleLoginSubmit} className="mt-6 space-y-4">
              <div>
                <label
                  htmlFor="login-email"
                  className="block text-xs font-semibold uppercase tracking-wider text-slate-700"
                >
                  Work or Patient Email
                </label>
                <input
                  id="login-email"
                  type="email"
                  required
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  placeholder="dr.karim@clinic.ma"
                  className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-700/20"
                />
              </div>

              <div>
                <label
                  htmlFor="login-password"
                  className="block text-xs font-semibold uppercase tracking-wider text-slate-700"
                >
                  Password
                </label>
                <input
                  id="login-password"
                  type="password"
                  required
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-700/20"
                />
              </div>

              <button
                type="submit"
                disabled={busy}
                className="min-h-[44px] w-full rounded-xl bg-teal-800 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-teal-900 active:scale-[0.99] disabled:opacity-60"
              >
                {busy ? "Verifying Credentials..." : "Sign In to MediSync"}
              </button>
            </form>
          ) : null}

          {activeTab === "register" ? (
            <form onSubmit={handleRegisterSubmit} className="mt-6 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="reg-fullname"
                    className="block text-xs font-semibold uppercase tracking-wider text-slate-700"
                  >
                    Full Legal Name
                  </label>
                  <input
                    id="reg-fullname"
                    type="text"
                    required
                    value={regFullName}
                    onChange={(e) => setRegFullName(e.target.value)}
                    placeholder="Dr. Amina Benali"
                    className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-700/20"
                  />
                </div>

                <div>
                  <label
                    htmlFor="reg-role"
                    className="block text-xs font-semibold uppercase tracking-wider text-slate-700"
                  >
                    Ecosystem Actor Role
                  </label>
                  <select
                    id="reg-role"
                    value={regRole}
                    onChange={(e) =>
                      setRegRole(e.target.value as PublicSelfRegisterRole)
                    }
                    className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-700/20"
                  >
                    {PublicSelfRegisterRoleSchema.options.map((roleOption) => (
                      <option key={roleOption} value={roleOption}>
                        {ROLE_LABELS[roleOption]} ({roleOption})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="reg-email"
                    className="block text-xs font-semibold uppercase tracking-wider text-slate-700"
                  >
                    Email Address
                  </label>
                  <input
                    id="reg-email"
                    type="email"
                    required
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    placeholder="amina@hospital.ma"
                    className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-700/20"
                  />
                </div>

                <div>
                  <label
                    htmlFor="reg-password"
                    className="block text-xs font-semibold uppercase tracking-wider text-slate-700"
                  >
                    Password (min 8 chars)
                  </label>
                  <input
                    id="reg-password"
                    type="password"
                    required
                    minLength={8}
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    placeholder="Minimum 8 characters"
                    className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-700/20"
                  />
                </div>
              </div>

              <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                Country scope will lock to{" "}
                <strong className="font-mono-tabular text-slate-900">{selectedCountry}</strong>.
                System super-admin (<code className="font-mono-tabular">OPS_ADMIN</code>) accounts are
                excluded from self-registration by Zod boundary policy.
              </p>

              <button
                type="submit"
                disabled={busy}
                className="min-h-[44px] w-full rounded-xl bg-teal-800 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-teal-900 active:scale-[0.99] disabled:opacity-60"
              >
                {busy ? "Creating Sovereign Account..." : "Create Account"}
              </button>
            </form>
          ) : null}

          {activeTab === "facility" ? (
            <form onSubmit={handleFacilitySubmit} className="mt-6 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="fac-name"
                    className="block text-xs font-semibold uppercase tracking-wider text-slate-700"
                  >
                    Facility Official Name
                  </label>
                  <input
                    id="fac-name"
                    type="text"
                    required
                    value={facName}
                    onChange={(e) => setFacName(e.target.value)}
                    placeholder="Clinique Atlas Casablanca"
                    className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-700/20"
                  />
                </div>

                <div>
                  <label
                    htmlFor="fac-kind"
                    className="block text-xs font-semibold uppercase tracking-wider text-slate-700"
                  >
                    Facility Sector
                  </label>
                  <select
                    id="fac-kind"
                    value={facKind}
                    onChange={(e) => setFacKind(e.target.value as FacilityKind)}
                    className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-700/20"
                  >
                    {FacilityKindSchema.options.map((kindOption) => (
                      <option key={kindOption} value={kindOption}>
                        {FACILITY_KIND_LABELS[kindOption]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="fac-license"
                    className="block text-xs font-semibold uppercase tracking-wider text-slate-700"
                  >
                    Ministry License ({selectedCountry})
                  </label>
                  {facLicense.trim().length > 0 ? (
                    <span
                      className={`font-mono-tabular text-xs font-semibold ${
                        licenseMatchesPack ? "text-emerald-700" : "text-red-700"
                      }`}
                    >
                      {licenseMatchesPack ? "Pattern Valid" : "Invalid Jurisdiction Format"}
                    </span>
                  ) : null}
                </div>
                <input
                  id="fac-license"
                  type="text"
                  required
                  value={facLicense}
                  onChange={(e) => setFacLicense(e.target.value)}
                  placeholder="MA-CLIN-90812"
                  className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 font-mono-tabular text-sm text-slate-900 placeholder:text-slate-400 focus:border-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-700/20"
                />
              </div>

              <div>
                <label
                  htmlFor="fac-address"
                  className="block text-xs font-semibold uppercase tracking-wider text-slate-700"
                >
                  Street Address
                </label>
                <input
                  id="fac-address"
                  type="text"
                  required
                  value={facAddress}
                  onChange={(e) => setFacAddress(e.target.value)}
                  placeholder="18 Boulevard d'Anfa, Casablanca"
                  className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-700/20"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="fac-lat"
                    className="block text-xs font-semibold uppercase tracking-wider text-slate-700"
                  >
                    Latitude (WGS84)
                  </label>
                  <input
                    id="fac-lat"
                    type="number"
                    step="any"
                    required
                    value={facLat}
                    onChange={(e) => setFacLat(e.target.value)}
                    className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 font-mono-tabular text-sm text-slate-900 focus:border-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-700/20"
                  />
                </div>
                <div>
                  <label
                    htmlFor="fac-lng"
                    className="block text-xs font-semibold uppercase tracking-wider text-slate-700"
                  >
                    Longitude (WGS84)
                  </label>
                  <input
                    id="fac-lng"
                    type="number"
                    step="any"
                    required
                    value={facLng}
                    onChange={(e) => setFacLng(e.target.value)}
                    className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 font-mono-tabular text-sm text-slate-900 focus:border-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-700/20"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={busy}
                className="min-h-[44px] w-full rounded-xl bg-teal-800 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-teal-900 active:scale-[0.99] disabled:opacity-60"
              >
                {busy ? "Indexing in PostGIS..." : "Submit Facility for Verification"}
              </button>
            </form>
          ) : null}
        </section>

        {/* Right Column: Session State & Scoped Registry */}
        <aside className="space-y-4 lg:col-span-5">
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-900">
                Active Identity Scope
              </h2>
              {currentUser ? (
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Sign Out</span>
                </button>
              ) : null}
            </div>

            {currentUser ? (
              <dl className="mt-4 space-y-2 text-sm">
                <div className="flex justify-between gap-2 border-b border-slate-100 pb-2">
                  <dt className="text-slate-500">Actor</dt>
                  <dd className="font-semibold text-slate-900">{currentUser.fullName}</dd>
                </div>
                <div className="flex justify-between gap-2 border-b border-slate-100 pb-2">
                  <dt className="text-slate-500">RBAC Role</dt>
                  <dd className="font-mono-tabular font-semibold text-teal-800">
                    {currentUser.role}
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-slate-500">Tenant Country</dt>
                  <dd className="font-mono-tabular font-semibold text-slate-900">
                    {currentUser.countryCode}
                  </dd>
                </div>
              </dl>
            ) : (
              <p className="mt-3 text-sm leading-relaxed text-slate-600">
                No active token in this tab yet. Sign in or register on the left to inspect
                country-scoped PostGIS facilities and RBAC controls.
              </p>
            )}
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-base font-semibold text-slate-900">
                Scoped Facility Registry
              </h2>
              {sessionToken && currentUser ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    void refreshScopedFacilities(sessionToken, currentUser.countryCode)
                  }
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:border-teal-700 hover:text-teal-800"
                >
                  <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Refresh</span>
                </button>
              ) : null}
            </div>

            {facilities.length === 0 ? (
              <p className="mt-3 text-sm text-slate-500">
                {currentUser
                  ? "No verified or owned facilities in your country scope yet."
                  : "Sign in to load verified clinics, hospitals, pharmacies, and diagnostic labs for your jurisdiction."}
              </p>
            ) : (
              <ul className="mt-4 space-y-3">
                {facilities.map((facility) => (
                  <li
                    key={facility.id}
                    className="rounded-xl border border-slate-200 bg-slate-50 p-3.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">
                          {facility.name}
                        </p>
                        <p className="mt-0.5 font-mono-tabular text-xs text-slate-600">
                          {facility.kind} · {facility.licenseNumber}
                        </p>
                      </div>
                      <span
                        className={`rounded-full px-2 py-0.5 font-mono-tabular text-[11px] font-semibold ${
                          facility.verificationStatus === "VERIFIED"
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {facility.verificationStatus}
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-slate-600">{facility.address}</p>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <span className="font-mono-tabular text-[11px] text-slate-500">
                        {facility.lat.toFixed(4)}, {facility.lng.toFixed(4)}
                      </span>
                      {currentUser?.role === "OPS_ADMIN" &&
                      facility.verificationStatus !== "VERIFIED" ? (
                        <button
                          type="button"
                          onClick={() => void handleVerifyFacility(facility.id)}
                          className="rounded-md bg-teal-800 px-2.5 py-1 text-xs font-semibold text-white hover:bg-teal-900"
                        >
                          Verify Facility
                        </button>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
