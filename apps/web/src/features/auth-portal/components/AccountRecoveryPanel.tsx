"use client";

import { useState, type FormEvent } from "react";
import type { AuthenticatedUser } from "@medisync/contracts";
import { ArrowLeft } from "lucide-react";
import { useLocale } from "@/shared/i18n/locale-store";
import {
  confirmVerificationCode,
  requestVerificationCode,
  resetPasswordWithCode,
} from "../api-client";
import { PORTAL_COPY } from "../portal-i18n";

export type RecoveryPurpose = "VERIFY_EMAIL" | "VERIFY_PHONE" | "RESET_PASSWORD";

interface AccountRecoveryPanelProps {
  apiBaseUrl: string;
  initialEmail?: string;
  defaultPurpose?: RecoveryPurpose;
  placeholderEmail?: string;
  busy: boolean;
  onBusyChange: (busy: boolean) => void;
  onFeedback: (status: { tone: "info" | "success" | "error"; text: string }) => void;
  onPasswordResetComplete?: (email: string) => void;
  onContactVerified?: (user: AuthenticatedUser) => void;
  backLabel?: string;
  onBack?: () => void;
}

/** Shared OTP contact verification and password reset flow for Consumer and Pro portals. */
export function AccountRecoveryPanel({
  apiBaseUrl,
  initialEmail = "",
  defaultPurpose = "VERIFY_EMAIL",
  placeholderEmail = "name@example.com",
  busy,
  onBusyChange,
  onFeedback,
  onPasswordResetComplete,
  onContactVerified,
  backLabel,
  onBack,
}: AccountRecoveryPanelProps) {
  const { locale, isRtl } = useLocale();
  const copy = PORTAL_COPY[locale];
  const msg = copy.messages;

  const [recoveryPurpose, setRecoveryPurpose] =
    useState<RecoveryPurpose>(defaultPurpose);
  const [recoveryEmail, setRecoveryEmail] = useState(initialEmail);
  const [recoveryPhone, setRecoveryPhone] = useState("");
  const [recoveryOtpCode, setRecoveryOtpCode] = useState("");
  const [recoveryNewPassword, setRecoveryNewPassword] = useState("");
  const [recoveryPreviewHint, setRecoveryPreviewHint] = useState<string | null>(
    null,
  );

  async function handleRequestRecoveryOtp() {
    const email = recoveryEmail.trim();
    if (!email) {
      onFeedback({ tone: "error", text: msg.enterEmailFirst });
      return;
    }

    onBusyChange(true);
    setRecoveryPreviewHint(null);
    const res = await requestVerificationCode(apiBaseUrl, {
      email,
      purpose: recoveryPurpose,
      ...(recoveryPurpose === "VERIFY_PHONE" && recoveryPhone.trim()
        ? { phone: recoveryPhone.trim() }
        : {}),
    });
    onBusyChange(false);

    if (!res.ok) {
      onFeedback({ tone: "error", text: msg.otpRequestError(res.error) });
      return;
    }

    if (res.data.devPreviewCode) {
      setRecoveryPreviewHint(res.data.devPreviewCode);
      setRecoveryOtpCode(res.data.devPreviewCode);
    }
    onFeedback({
      tone: "success",
      text: msg.otpDispatched(
        res.data.deliveryChannel,
        res.data.expiresInMinutes,
      ),
    });
  }

  async function handleSubmitRecoveryAction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const email = recoveryEmail.trim();
    if (!email) {
      onFeedback({ tone: "error", text: msg.enterEmailFirst });
      return;
    }

    onBusyChange(true);
    if (recoveryPurpose === "RESET_PASSWORD") {
      const res = await resetPasswordWithCode(apiBaseUrl, {
        email,
        code: recoveryOtpCode.trim(),
        newPassword: recoveryNewPassword,
      });
      onBusyChange(false);
      if (!res.ok) {
        onFeedback({ tone: "error", text: msg.passwordResetFailed(res.error) });
        return;
      }
      setRecoveryOtpCode("");
      setRecoveryNewPassword("");
      setRecoveryPreviewHint(null);
      onFeedback({ tone: "success", text: msg.passwordUpdated });
      onPasswordResetComplete?.(email);
      return;
    }

    const res = await confirmVerificationCode(apiBaseUrl, {
      email,
      code: recoveryOtpCode.trim(),
      purpose: recoveryPurpose,
      ...(recoveryPurpose === "VERIFY_PHONE" && recoveryPhone.trim()
        ? { phone: recoveryPhone.trim() }
        : {}),
    });
    onBusyChange(false);
    if (!res.ok) {
      onFeedback({ tone: "error", text: msg.verificationFailed(res.error) });
      return;
    }

    setRecoveryOtpCode("");
    setRecoveryPreviewHint(null);
    onContactVerified?.(res.data.user);
    onFeedback({
      tone: "success",
      text: msg.verifiedCleanly(
        recoveryPurpose === "VERIFY_EMAIL" ? "email" : "phone",
      ),
    });
  }

  return (
    <form
      dir={isRtl ? "rtl" : "ltr"}
      onSubmit={(e) => void handleSubmitRecoveryAction(e)}
      className="space-y-4"
    >
      {onBack && backLabel ? (
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0066CC] hover:text-emerald-800 hover:underline"
        >
          <ArrowLeft
            className="h-3.5 w-3.5 rtl:rotate-180"
            aria-hidden="true"
          />
          <span>{backLabel}</span>
        </button>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-3">
        <button
          type="button"
          onClick={() => setRecoveryPurpose("VERIFY_EMAIL")}
          className={`rounded-xl px-3 py-2.5 text-xs font-semibold transition-colors ${
            recoveryPurpose === "VERIFY_EMAIL"
              ? "bg-emerald-50 text-emerald-800 ring-2 ring-emerald-700"
              : "bg-[#F3F8FD] border border-[#D7E4F2] text-slate-700 hover:bg-[#E8F1FA]"
          }`}
        >
          {copy.recovery.verifyEmailBtn}
        </button>
        <button
          type="button"
          onClick={() => setRecoveryPurpose("VERIFY_PHONE")}
          className={`rounded-xl px-3 py-2.5 text-xs font-semibold transition-colors ${
            recoveryPurpose === "VERIFY_PHONE"
              ? "bg-emerald-50 text-emerald-800 ring-2 ring-emerald-700"
              : "bg-[#F3F8FD] border border-[#D7E4F2] text-slate-700 hover:bg-[#E8F1FA]"
          }`}
        >
          {copy.recovery.verifyPhoneBtn}
        </button>
        <button
          type="button"
          onClick={() => setRecoveryPurpose("RESET_PASSWORD")}
          className={`rounded-xl px-3 py-2.5 text-xs font-semibold transition-colors ${
            recoveryPurpose === "RESET_PASSWORD"
              ? "bg-emerald-50 text-emerald-800 ring-2 ring-emerald-700"
              : "bg-[#F3F8FD] border border-[#D7E4F2] text-slate-700 hover:bg-[#E8F1FA]"
          }`}
        >
          {copy.recovery.resetPasswordBtn}
        </button>
      </div>

      <div>
        <label
          htmlFor="rec-email"
          className="block text-xs font-semibold uppercase tracking-wider text-slate-700"
        >
          {copy.recovery.accountEmailLabel}
        </label>
        <input
          id="rec-email"
          type="email"
          dir="ltr"
          required
          value={recoveryEmail}
          onChange={(e) => setRecoveryEmail(e.target.value)}
          placeholder={placeholderEmail}
          className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-700/20"
        />
      </div>

      {recoveryPurpose === "VERIFY_PHONE" ? (
        <div>
          <label
            htmlFor="rec-phone"
            className="block text-xs font-semibold uppercase tracking-wider text-slate-700"
          >
            {copy.recovery.mobileE164Label}
          </label>
          <input
            id="rec-phone"
            type="tel"
            dir="ltr"
            required
            value={recoveryPhone}
            onChange={(e) => setRecoveryPhone(e.target.value)}
            placeholder="+212661223344"
            className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 font-mono-tabular text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-700/20"
          />
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => void handleRequestRecoveryOtp()}
          className="min-h-[40px] rounded-full bg-emerald-50 px-4 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 disabled:opacity-60"
        >
          {copy.recovery.sendOtpBtn}
        </button>
        {recoveryPreviewHint ? (
          <span className="rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-1 font-mono-tabular text-xs font-bold text-amber-900">
            {copy.recovery.devOtpPrefix} {recoveryPreviewHint}
          </span>
        ) : null}
      </div>

      <div
        className={`grid gap-4 ${
          recoveryPurpose === "RESET_PASSWORD" ? "sm:grid-cols-2" : "grid-cols-1"
        }`}
      >
        <div>
          <label
            htmlFor="rec-otp"
            className="block text-xs font-semibold uppercase tracking-wider text-slate-700"
          >
            {copy.recovery.otpCodeLabel}
          </label>
          <input
            id="rec-otp"
            type="text"
            dir="ltr"
            required
            pattern="[0-9]{6}"
            value={recoveryOtpCode}
            onChange={(e) => setRecoveryOtpCode(e.target.value)}
            placeholder="123456"
            className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 font-mono-tabular text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-700/20"
          />
        </div>

        {recoveryPurpose === "RESET_PASSWORD" ? (
          <div>
            <label
              htmlFor="rec-new-pass"
              className="block text-xs font-semibold uppercase tracking-wider text-slate-700"
            >
              {copy.recovery.newPasswordLabel}
            </label>
            <input
              id="rec-new-pass"
              type="password"
              required
              minLength={8}
              value={recoveryNewPassword}
              onChange={(e) => setRecoveryNewPassword(e.target.value)}
              placeholder={copy.recovery.newPasswordPlaceholder}
              className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-700/20"
            />
          </div>
        ) : null}
      </div>

      <button
        type="submit"
        disabled={busy}
        className="min-h-[44px] w-full rounded-xl bg-[#0066CC] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#0052A3] disabled:opacity-60"
      >
        {recoveryPurpose === "RESET_PASSWORD"
          ? copy.recovery.submitResetBtn
          : copy.recovery.submitVerifyBtn}
      </button>
    </form>
  );
}
