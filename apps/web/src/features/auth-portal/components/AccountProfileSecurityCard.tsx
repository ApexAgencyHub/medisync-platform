"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import type {
  AuthResponse,
  AuthenticatedUser,
  FacilitySummary,
} from "@medisync/contracts";
import {
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  LogOut,
  MailCheck,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  UserCheck,
  Users,
} from "lucide-react";
import { formatFacilityKind, formatRoleLabel } from "@/shared/i18n/human-labels";
import { getPrimaryWorkspaceForUser } from "@/shared/auth/role-capabilities";
import { useLocale } from "@/shared/i18n/locale-store";
import { EntityPicker } from "@/shared/ui/EntityPicker";
import { useToastSetter } from "@/shared/ui/primitives";
import { PORTAL_COPY } from "../portal-i18n";
import {
  changeUserPassword,
  confirmVerificationCode,
  requestVerificationCode,
  revokeAllOtherSessions,
  updateUserProfile,
} from "../api-client";

interface AccountProfileSecurityCardProps {
  apiBaseUrl: string;
  token: string;
  user: AuthenticatedUser;
  facilities: readonly FacilitySummary[];
  onSessionUpdated: (auth: AuthResponse, message?: string) => void;
  onUserUpdated: (user: AuthenticatedUser, message?: string) => void;
  onOpenSwitchAccount: () => void;
  onSignOut: () => void;
  hidePrimaryLink?: boolean;
}

export function AccountProfileSecurityCard({
  apiBaseUrl,
  token,
  user,
  facilities,
  onSessionUpdated,
  onUserUpdated,
  onOpenSwitchAccount,
  onSignOut,
  hidePrimaryLink = false,
}: AccountProfileSecurityCardProps) {
  const { locale, isRtl } = useLocale();
  const copy = PORTAL_COPY[locale];
  const pc = copy.profileCard;
  const msg = copy.messages;
  const setBanner = useToastSetter();

  const [fullName, setFullName] = useState(user.fullName);
  const [phone, setPhone] = useState(user.phone ?? "");
  const [facilityId, setFacilityId] = useState(user.facilityId ?? "");
  const [profileBusy, setProfileBusy] = useState(false);

  // Inline email/phone verification OTP state
  const [verifyPurpose, setVerifyPurpose] = useState<
    "VERIFY_EMAIL" | "VERIFY_PHONE" | null
  >(null);
  const [verifyCode, setVerifyCode] = useState("");
  const [verifyPreviewHint, setVerifyPreviewHint] = useState<string | null>(null);
  const [verifyBusy, setVerifyBusy] = useState(false);

  // Password change & session revocation state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showPasswords, setShowPasswords] = useState(false);
  const [securityBusy, setSecurityBusy] = useState(false);

  useEffect(() => {
    setFullName(user.fullName);
    setPhone(user.phone ?? "");
    setFacilityId(user.facilityId ?? "");
  }, [user.fullName, user.phone, user.facilityId]);

  const primaryWorkspace = getPrimaryWorkspaceForUser(user, locale);
  const showFacilitySelect =
    user.role !== "PATIENT" &&
    user.role !== "CAREGIVER" &&
    user.role !== "DRIVER";

  async function handleSaveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (fullName.trim().length < 2) {
      setBanner({
        tone: "error",
        text: msg.fullNameMin2,
      });
      return;
    }

    setProfileBusy(true);
    const trimmedPhone = phone.trim();
    const res = await updateUserProfile(apiBaseUrl, token, {
      fullName: fullName.trim(),
      phone: trimmedPhone.length >= 6 ? trimmedPhone : null,
      ...(showFacilitySelect
        ? { facilityId: facilityId ? facilityId : null }
        : {}),
    });
    setProfileBusy(false);

    if (!res.ok) {
      setBanner({
        tone: "error",
        text: msg.profileUpdateFailed(res.error),
      });
      return;
    }

    onUserUpdated(res.data.user, msg.profileSaved);
    setBanner({
      tone: "success",
      text: msg.profileSynced,
    });
  }

  async function handleStartContactVerify(
    purpose: "VERIFY_EMAIL" | "VERIFY_PHONE",
  ) {
    if (!user.email) {
      setBanner({
        tone: "warning",
        text: msg.emailRequiredForVerify,
      });
      return;
    }
    setVerifyBusy(true);
    const res = await requestVerificationCode(apiBaseUrl, {
      email: user.email,
      purpose,
      ...(purpose === "VERIFY_PHONE" && phone.trim().length >= 6
        ? { phone: phone.trim() }
        : {}),
    });
    setVerifyBusy(false);

    if (!res.ok) {
      setBanner({
        tone: "error",
        text: msg.verifyCodeRequestFailed(res.error),
      });
      return;
    }

    setVerifyPurpose(purpose);
    setVerifyCode("");
    setVerifyPreviewHint(res.data.devPreviewCode ?? null);
    setBanner({
      tone: "info",
      text: msg.verifyCodeReady(
        purpose === "VERIFY_EMAIL" ? "email" : "sms",
        res.data.devPreviewCode ?? undefined,
        res.data.deliveryChannel,
      ),
    });
  }

  async function handleConfirmContactOtp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user.email || !verifyPurpose || verifyCode.trim().length !== 6) return;

    setVerifyBusy(true);
    const res = await confirmVerificationCode(apiBaseUrl, {
      email: user.email,
      code: verifyCode.trim(),
      purpose: verifyPurpose,
      ...(verifyPurpose === "VERIFY_PHONE" && phone.trim().length >= 6
        ? { phone: phone.trim() }
        : {}),
    });
    setVerifyBusy(false);

    if (!res.ok) {
      setBanner({
        tone: "error",
        text: msg.codeConfirmFailed(res.error),
      });
      return;
    }

    setVerifyPurpose(null);
    setVerifyCode("");
    setVerifyPreviewHint(null);
    onUserUpdated(
      res.data.user,
      verifyPurpose === "VERIFY_EMAIL"
        ? msg.emailVerifiedNote
        : msg.phoneVerifiedNote,
    );
    setBanner({
      tone: "success",
      text:
        verifyPurpose === "VERIFY_EMAIL"
          ? msg.emailVerifiedBanner
          : msg.phoneVerifiedBanner,
    });
  }

  async function handleChangePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!currentPassword || newPassword.length < 8) {
      setBanner({
        tone: "error",
        text: msg.passwordChangeValidation,
      });
      return;
    }

    setSecurityBusy(true);
    const res = await changeUserPassword(apiBaseUrl, token, {
      currentPassword,
      newPassword,
    });
    setSecurityBusy(false);

    if (!res.ok) {
      setBanner({
        tone: "error",
        text:
          res.error === "INVALID_CURRENT_PASSWORD"
            ? msg.invalidCurrentPassword
            : res.error === "PASSWORD_NOT_SET_USE_RESET"
              ? msg.noPasswordSetUseReset
              : msg.passwordUpdateFailed(res.error),
      });
      return;
    }

    setCurrentPassword("");
    setNewPassword("");
    onSessionUpdated(res.data, msg.passwordRotated);
    setBanner({
      tone: "success",
      text: msg.passwordChangedRevoked,
    });
  }

  async function handleRevokeOtherSessions() {
    setSecurityBusy(true);
    const res = await revokeAllOtherSessions(apiBaseUrl, token);
    setSecurityBusy(false);

    if (!res.ok) {
      setBanner({
        tone: "error",
        text: msg.revokeFailed(res.error),
      });
      return;
    }

    onSessionUpdated({ token: res.data.token, user }, msg.otherSessionsRevoked);
    setBanner({
      tone: "success",
      text: msg.onlyThisBrowserSignedIn,
    });
  }

  return (
    <div id="account-profile" dir={isRtl ? "rtl" : "ltr"} className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3 pb-2">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-800">
              <UserCheck className="h-3.5 w-3.5" aria-hidden="true" />
              {formatRoleLabel(user.role, locale)} · {user.countryCode}
            </span>
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                user.accountStatus === "ACTIVE"
                  ? "bg-emerald-50 text-emerald-800"
                  : "bg-amber-50 text-amber-900"
              }`}
            >
              {user.accountStatus === "ACTIVE" ? (
                <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
              ) : (
                <ShieldAlert className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              {user.accountStatus === "ACTIVE"
                ? user.credentialVerified
                  ? pc.verifiedAccountBadge
                  : pc.activeAccountBadge
                : pc.pendingVerificationBadge}
            </span>
          </div>
          <h2 className="text-lg font-bold tracking-tight text-slate-950">
            {pc.accountProfileTitle}
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {!hidePrimaryLink ? (
            <Link
              href={primaryWorkspace.href}
              className="inline-flex h-9 items-center gap-1 rounded-xl bg-[#0066CC] px-3.5 text-xs font-semibold text-white transition hover:bg-[#0052A3] active:scale-[0.98]"
            >
              <span>{primaryWorkspace.label}</span>
              <span aria-hidden="true" className="inline-block rtl:rotate-180">→</span>
            </Link>
          ) : null}
          <button
            type="button"
            onClick={onOpenSwitchAccount}
            className="inline-flex h-9 items-center gap-1 rounded-xl border border-[#CBDDF0] bg-[#F3F8FD] px-3 text-xs font-semibold text-[#0F243E] transition hover:border-[#0E1114] hover:bg-white active:scale-[0.98]"
          >
            <Users className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{pc.switchAccountBtn}</span>
          </button>
        </div>
      </div>

      {/* Section 1: Personal Identity & Facility Assignment */}
      <form
        onSubmit={(e) => void handleSaveProfile(e)}
        className="space-y-3 rounded-2xl border border-[#D7E4F2] bg-white p-5"
      >
        <div className="flex items-center justify-between gap-2 border-b border-[#E5EAEE] pb-2.5">
          <h3 className="font-mono-tabular text-[11px] font-semibold uppercase tracking-[0.1em] text-[#46515E]">
            {pc.identitySectionTitle}
          </h3>
          {user.lastLoginAtIso ? (
            <span className="font-mono-tabular text-[11px] text-[#707D8C]">
              {pc.lastLoginPrefix} {user.lastLoginAtIso.slice(0, 16).replace("T", " ")} UTC
            </span>
          ) : null}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block space-y-1 text-xs font-semibold text-[#0F243E]">
            <span>{pc.fullNameLabel}</span>
            <input
              type="text"
              required
              minLength={2}
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="h-10 w-full rounded-xl border border-[#CBDDF0] bg-white px-3 text-sm text-[#0F243E] focus:border-[#0066CC] focus:outline-none focus:ring-2 focus:ring-[#0066CC]/20"
            />
          </label>

          <label className="block space-y-1 text-xs font-semibold text-[#0F243E]">
            <span>{pc.mobileE164Label}</span>
            <input
              type="tel"
              dir="ltr"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+212661234567"
              className="h-10 w-full rounded-xl border border-[#CBDDF0] bg-white px-3 font-mono-tabular text-sm text-[#0F243E] focus:border-[#0066CC] focus:outline-none focus:ring-2 focus:ring-[#0066CC]/20"
            />
          </label>
        </div>

        {showFacilitySelect ? (
          <EntityPicker
            id="profile-workplace-facility"
            label={pc.primaryWorkplaceLabel}
            placeholder={pc.primaryWorkplaceLabel}
            emptyLabel={pc.unassignedOption}
            value={facilityId}
            onChange={setFacilityId}
            options={facilities.map((fac) => ({
              id: fac.id,
              label: fac.name,
              sublabel: formatFacilityKind(fac.kind, locale),
            }))}
          />
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="font-mono-tabular text-slate-600">
              {user.email ?? pc.noEmailSet}
            </span>
            {!user.emailVerified && user.email ? (
              <button
                type="button"
                disabled={verifyBusy}
                onClick={() => void handleStartContactVerify("VERIFY_EMAIL")}
                className="inline-flex items-center gap-1 rounded-xl bg-white px-3 py-1 text-[11px] font-semibold text-[#0066CC] shadow-2xs hover:bg-emerald-50 disabled:opacity-50"
              >
                <MailCheck className="h-3 w-3" aria-hidden="true" />
                <span>{pc.verifyEmailBtn}</span>
              </button>
            ) : user.emailVerified ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                {pc.emailVerifiedBadge}
              </span>
            ) : null}
            {!user.phoneVerified && phone.trim().length >= 6 && user.email ? (
              <button
                type="button"
                disabled={verifyBusy}
                onClick={() => void handleStartContactVerify("VERIFY_PHONE")}
                className="inline-flex items-center gap-1 rounded-xl bg-white px-3 py-1 text-[11px] font-semibold text-[#0066CC] shadow-2xs hover:bg-emerald-50 disabled:opacity-50"
              >
                <Smartphone className="h-3 w-3" aria-hidden="true" />
                <span>{pc.verifySmsBtn}</span>
              </button>
            ) : user.phoneVerified ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                {pc.phoneVerifiedBadge}
              </span>
            ) : null}
          </div>

          <button
            type="submit"
            disabled={profileBusy}
            className="inline-flex h-9 items-center rounded-xl bg-[#0066CC] px-4 text-xs font-bold text-white transition hover:bg-[#0052A3] active:scale-[0.98] disabled:opacity-60"
          >
            {profileBusy ? pc.savingBtn : pc.saveProfileBtn}
          </button>
        </div>
      </form>

      {/* Optional Inline Contact Verification OTP Challenge */}
      {verifyPurpose ? (
        <form
          onSubmit={(e) => void handleConfirmContactOtp(e)}
          className="flex flex-wrap items-center gap-2 rounded-xl bg-[#E8F1FA] p-3.5 text-xs"
        >
          <span className="font-semibold text-emerald-950">
            {pc.enterOtpPrompt(
              verifyPurpose === "VERIFY_EMAIL" ? "email" : "sms",
              verifyPreviewHint,
            )}
          </span>
          <input
            type="text"
            dir="ltr"
            required
            pattern="[0-9]{6}"
            value={verifyCode}
            onChange={(e) => setVerifyCode(e.target.value)}
            placeholder="123456"
            className="h-9 w-28 rounded-xl border border-transparent bg-white px-2.5 font-mono-tabular text-sm text-slate-900 shadow-2xs"
          />
          <button
            type="submit"
            disabled={verifyBusy || verifyCode.trim().length !== 6}
            className="h-9 rounded-xl bg-[#0066CC] px-3.5 text-xs font-semibold text-white hover:bg-[#0052A3] disabled:opacity-50"
          >
            {pc.confirmCodeBtn}
          </button>
          <button
            type="button"
            onClick={() => setVerifyPurpose(null)}
            className="h-9 rounded-xl bg-white px-3 text-xs font-semibold text-slate-700 shadow-2xs"
          >
            {pc.cancelBtn}
          </button>
        </form>
      ) : null}

      {/* Section 2: Password Rotation & Multi-Device Session Security */}
      <div className="space-y-3 rounded-2xl border border-[#D7E4F2] bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-700">
            <KeyRound className="h-3.5 w-3.5 text-[#0066CC]" aria-hidden="true" />
            {pc.securitySectionTitle}
          </h3>
          <button
            type="button"
            onClick={() => setShowPasswords((p) => !p)}
            className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600 hover:text-slate-900"
          >
            {showPasswords ? (
              <EyeOff className="h-3.5 w-3.5" aria-hidden="true" />
            ) : (
              <Eye className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            <span>{showPasswords ? pc.hidePasswordsBtn : pc.showPasswordsBtn}</span>
          </button>
        </div>

        <form
          onSubmit={(e) => void handleChangePassword(e)}
          className="grid gap-2.5 sm:grid-cols-3"
        >
          <input
            type={showPasswords ? "text" : "password"}
            required
            aria-label={pc.currentPasswordPlaceholder}
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            placeholder={pc.currentPasswordPlaceholder}
            className="h-10 rounded-xl border border-[#CBDDF0] bg-white px-3.5 text-xs text-[#0F243E] focus:border-[#0066CC] focus:outline-none focus:ring-2 focus:ring-[#0066CC]/18"
          />
          <input
            type={showPasswords ? "text" : "password"}
            required
            minLength={8}
            aria-label={pc.newPasswordPlaceholder}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder={pc.newPasswordPlaceholder}
            className="h-10 rounded-xl border border-[#CBDDF0] bg-white px-3.5 text-xs text-[#0F243E] focus:border-[#0066CC] focus:outline-none focus:ring-2 focus:ring-[#0066CC]/18"
          />
          <button
            type="submit"
            disabled={securityBusy}
            className="h-10 rounded-xl bg-[#0066CC] px-4 text-xs font-semibold text-white transition hover:bg-[#0052A3] active:scale-[0.98] disabled:opacity-50"
          >
            {securityBusy ? pc.updatingBtn : pc.updatePasswordBtn}
          </button>
        </form>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
          <p className="text-[11px] text-slate-500">
            {pc.revokeSessionsHint}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={securityBusy}
              onClick={() => void handleRevokeOtherSessions()}
              className="inline-flex h-9 items-center rounded-xl bg-white px-3.5 text-xs font-semibold text-slate-800 shadow-2xs transition hover:text-[#0066CC] active:scale-[0.98] disabled:opacity-50"
            >
              {pc.revokeOtherSessionsBtn}
            </button>
            <button
              type="button"
              onClick={onSignOut}
              className="inline-flex h-9 items-center gap-1 rounded-xl border border-rose-200 bg-rose-50 px-3.5 text-xs font-semibold text-rose-800 transition hover:bg-rose-100 active:scale-[0.98]"
            >
              <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{pc.signOutDeviceBtn}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
