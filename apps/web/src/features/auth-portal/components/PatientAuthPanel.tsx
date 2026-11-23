"use client";

import { useState, type FormEvent } from "react";
import type {
  AuthResponse,
  PatientEasyRole,
} from "@medisync/contracts";
import { ACTIVE_COUNTRY_CODE } from "@/shared/config/deployment";
import { useLocale } from "@/shared/i18n/locale-store";
import { PORTAL_COPY } from "../portal-i18n";
import {
  Eye,
  EyeOff,
  KeyRound,
  Mail,
  Phone,
  Smartphone,
  UserPlus,
} from "lucide-react";
import {
  authenticateWithGoogle,
  loginUser,
  registerUser,
  requestPhoneOtpLogin,
  verifyPhoneOtpLogin,
} from "../api-client";
import { GoogleSignInButton } from "./GoogleSignInButton";
import { PrivacyConsentCheckbox } from "./PrivacyConsentCheckbox";

export interface PatientAuthPanelProps {
  apiBaseUrl: string;
  busy: boolean;
  setBusy: (value: boolean) => void;
  onAuthenticated: (auth: AuthResponse, message: string) => Promise<void> | void;
  onStatusMessage: (status: { tone: "info" | "success" | "error"; text: string }) => void;
  onSwitchToRecovery: () => void;
}

type PatientChannel = "phone" | "email" | "google";
type PatientPhoneMethod = "otp" | "password";

export function PatientAuthPanel({
  apiBaseUrl,
  busy,
  setBusy,
  onAuthenticated,
  onStatusMessage,
  onSwitchToRecovery,
}: PatientAuthPanelProps) {
  const { locale, isRtl } = useLocale();
  const copy = PORTAL_COPY[locale];
  const p = copy.patientPanel;
  const msg = copy.messages;

  const [channel, setChannel] = useState<PatientChannel>("phone");
  const [mode, setMode] = useState<"signin" | "register">("signin");
  const [phoneMethod, setPhoneMethod] = useState<PatientPhoneMethod>("otp");

  const [patientRole, setPatientRole] = useState<PatientEasyRole>("PATIENT");
  const countryCode = ACTIVE_COUNTRY_CODE;
  const [fullName, setFullName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [emailAddress, setEmailAddress] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(true);

  // Phone OTP challenge state
  const [otpRequestedPhone, setOtpRequestedPhone] = useState<string | null>(null);
  const [otpCode, setOtpCode] = useState("");
  const [devPreviewCode, setDevPreviewCode] = useState<string | null>(null);

  async function handleRequestPhoneOtp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!phoneNumber.trim()) {
      onStatusMessage({
        tone: "error",
        text: msg.enterPhoneForSms,
      });
      return;
    }

    setBusy(true);
    setDevPreviewCode(null);
    const res = await requestPhoneOtpLogin(apiBaseUrl, {
      phone: phoneNumber.trim(),
      countryCode,
    });
    setBusy(false);

    if (!res.ok) {
      onStatusMessage({
        tone: "error",
        text: msg.otpRequestError(res.error),
      });
      return;
    }

    setOtpRequestedPhone(res.data.normalizedPhone);
    setDevPreviewCode(res.data.devPreviewCode ?? null);
    onStatusMessage({
      tone: "info",
      text: res.data.devPreviewCode
        ? `${p.smsSentTitle(res.data.normalizedPhone)} (${res.data.devPreviewCode}).`
        : p.smsSentTitle(res.data.normalizedPhone),
    });
  }

  async function handleVerifyPhoneOtp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const targetPhone = otpRequestedPhone ?? phoneNumber.trim();
    if (!targetPhone || otpCode.trim().length !== 6) {
      onStatusMessage({
        tone: "error",
        text: msg.enterSmsOtp,
      });
      return;
    }

    setBusy(true);
    const res = await verifyPhoneOtpLogin(apiBaseUrl, {
      phone: targetPhone,
      code: otpCode.trim(),
      ...(fullName.trim().length >= 2 ? { fullName: fullName.trim() } : {}),
      countryCode,
      role: patientRole,
    });
    setBusy(false);

    if (!res.ok) {
      onStatusMessage({
        tone: "error",
        text: msg.phoneVerifyFailed(res.error),
      });
      return;
    }

    setOtpCode("");
    setOtpRequestedPhone(null);
    setDevPreviewCode(null);
    await onAuthenticated(
      res.data,
      msg.welcomePhonePatient(res.data.user.fullName),
    );
  }

  async function handlePasswordAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (mode === "register") {
      if (channel === "phone" && !phoneNumber.trim()) {
        onStatusMessage({ tone: "error", text: msg.enterMobilePhone });
        return;
      }
      if (channel === "email" && !emailAddress.trim()) {
        onStatusMessage({ tone: "error", text: msg.enterEmailAddress });
        return;
      }

      setBusy(true);
      const res = await registerUser(apiBaseUrl, {
        ...(channel === "email" ? { email: emailAddress.trim() } : {}),
        ...(phoneNumber.trim() ? { phone: phoneNumber.trim() } : {}),
        password,
        fullName: fullName.trim(),
        role: patientRole,
        countryCode,
        acceptedTerms,
        consentVersion: "2026-11",
      });
      setBusy(false);

      if (!res.ok) {
        onStatusMessage({
          tone: "error",
          text: msg.patientRegisterFailed(res.error),
        });
        return;
      }

      await onAuthenticated(
        res.data,
        msg.patientReadyMsg(res.data.user.fullName, res.data.user.countryCode),
      );
      return;
    }

    const identifier =
      channel === "phone" ? phoneNumber.trim() : emailAddress.trim();
    if (!identifier || !password) {
      onStatusMessage({
        tone: "error",
        text: msg.enterCredentials,
      });
      return;
    }

    setBusy(true);
    const res = await loginUser(apiBaseUrl, {
      identifier,
      password,
      portalTrack: "PATIENT",
    });
    setBusy(false);

    if (!res.ok) {
      onStatusMessage({
        tone: "error",
        text: msg.signInRejected(res.error),
      });
      return;
    }

    await onAuthenticated(
      res.data,
      msg.signedInPatientMsg(res.data.user.fullName),
    );
  }

  async function handleGoogleCredential(idToken: string) {
    setBusy(true);
    const res = await authenticateWithGoogle(apiBaseUrl, {
      idToken,
      countryCode,
      role: patientRole,
    });
    setBusy(false);

    if (!res.ok) {
      onStatusMessage({
        tone: "error",
        text: msg.googleFailed(res.error),
      });
      return;
    }

    await onAuthenticated(
      res.data,
      msg.signedInGoogleMsg(res.data.user.fullName),
    );
  }

  return (
    <div dir={isRtl ? "rtl" : "ltr"} className="space-y-4">
      {/* Exposed Hairline Channel Tabs: Phone Number | Email | Google */}
      <div
        role="tablist"
        aria-label={p.methodsAria}
        className="grid grid-cols-3 border-b border-[#D7E4F2]"
      >
        <button
          type="button"
          role="tab"
          aria-selected={channel === "phone"}
          onClick={() => setChannel("phone")}
          className={`flex items-center justify-center gap-1.5 whitespace-nowrap border-b-2 px-2 py-2.5 text-xs font-semibold transition-colors ${
            channel === "phone"
              ? "border-[#0066CC] text-[#00448A]"
              : "border-transparent text-[#5B7087] hover:text-[#0F243E]"
          }`}
        >
          <Smartphone className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>{p.phoneMethodTab}</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={channel === "email"}
          onClick={() => setChannel("email")}
          className={`flex items-center justify-center gap-1.5 whitespace-nowrap border-b-2 px-2 py-2.5 text-xs font-semibold transition-colors ${
            channel === "email"
              ? "border-[#0066CC] text-[#00448A]"
              : "border-transparent text-[#5B7087] hover:text-[#0F243E]"
          }`}
        >
          <Mail className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>{p.emailMethodTab}</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={channel === "google"}
          onClick={() => setChannel("google")}
          className={`flex items-center justify-center gap-1.5 whitespace-nowrap border-b-2 px-2 py-2.5 text-xs font-semibold transition-colors ${
            channel === "google"
              ? "border-[#0066CC] text-[#00448A]"
              : "border-transparent text-[#5B7087] hover:text-[#0F243E]"
          }`}
        >
          <span
            aria-hidden="true"
            className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-xl bg-[#0066CC] font-mono-tabular text-[10px] font-bold text-white"
          >
            G
          </span>
          <span>{p.googleMethodTab}</span>
        </button>
      </div>

      {/* Inline Account Track Row (zero nested boxes) */}
      <fieldset className="flex flex-wrap items-center justify-between gap-2 pb-1">
        <legend className="sr-only">{p.bookingForLegend}</legend>
        <span className="font-mono-tabular text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[#5B7087]">
          {p.bookingForLabel}{" "}
          <span className="text-[#0066CC]">{countryCode}</span>
        </span>
        <div className="inline-flex overflow-hidden rounded-xl border border-[#D7E4F2] bg-[#F3F8FD]">
          {(
            [
              { value: "PATIENT", label: p.myselfPatient },
              { value: "CAREGIVER", label: p.familyCaregiver },
            ] as const
          ).map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setPatientRole(opt.value)}
              className={`px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                patientRole === opt.value
                  ? "bg-[#0066CC] text-white"
                  : "text-[#475A70] hover:bg-white hover:text-[#0F243E]"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </fieldset>

      {/* Channel 1: PHONE NUMBER (SMS OTP OR Phone + Password) */}
      {channel === "phone" ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-y border-[#E5EAEE] py-2.5">
            <span className="text-xs font-medium text-[#46515E]">
              {p.phoneOptionLabel}
            </span>
            <div className="inline-flex overflow-hidden rounded-xl border border-[#CBDDF0] bg-[#F3F8FD]">
              <button
                type="button"
                onClick={() => setPhoneMethod("otp")}
                className={`px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                  phoneMethod === "otp"
                    ? "bg-[#0066CC] text-white"
                    : "text-[#46515E] hover:bg-white hover:text-[#0F243E]"
                }`}
              >
                {p.smsOtpBtn}
              </button>
              <button
                type="button"
                onClick={() => setPhoneMethod("password")}
                className={`px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                  phoneMethod === "password"
                    ? "bg-[#0066CC] text-white"
                    : "text-[#46515E] hover:bg-white hover:text-[#0F243E]"
                }`}
              >
                {p.phonePasswordBtn}
              </button>
            </div>
          </div>

          {phoneMethod === "otp" ? (
            !otpRequestedPhone ? (
              <form onSubmit={handleRequestPhoneOtp} className="space-y-3.5">
                <div>
                  <label
                    htmlFor="patient-otp-fullname"
                    className="block text-xs font-semibold text-[#0F243E]"
                  >
                    {p.fullNameLabel}{" "}
                    <span className="font-normal text-[#707D8C]">{p.fullNameNewHint}</span>
                  </label>
                  <input
                    id="patient-otp-fullname"
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder={p.fullNamePlaceholder}
                    className="mt-1.5 h-10 w-full rounded-xl border border-[#CBDDF0] bg-white px-3 text-sm text-[#0F243E] placeholder:text-[#707D8C] focus:border-[#0066CC] focus:outline-none focus:ring-2 focus:ring-[#0066CC]/20"
                  />
                </div>
                <div>
                  <label
                    htmlFor="patient-otp-phone"
                    className="block text-xs font-semibold text-[#0F243E]"
                  >
                    {p.mobilePhoneNumberLabel}
                  </label>
                  <div className="relative mt-1.5">
                    <Phone
                      className="pointer-events-none absolute start-3 top-3 h-4 w-4 text-[#707D8C]"
                      aria-hidden="true"
                    />
                    <input
                      id="patient-otp-phone"
                      type="tel"
                      dir="ltr"
                      required
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      placeholder="+212 6 61 23 45 67"
                      className="h-10 w-full rounded-xl border border-[#CBDDF0] bg-white ps-9 pe-3 font-mono-tabular text-sm text-[#0F243E] placeholder:text-[#707D8C] focus:border-[#0066CC] focus:outline-none focus:ring-2 focus:ring-[#0066CC]/20"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={busy}
                  className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-[#0052A3] bg-[#0066CC] px-4 text-sm font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.16)] transition hover:bg-[#0052A3] disabled:opacity-50"
                >
                  <Smartphone className="h-4 w-4" aria-hidden="true" />
                  <span>{busy ? p.sendingSmsBtn : p.continuePhoneBtn}</span>
                </button>
              </form>
            ) : (
              <form onSubmit={handleVerifyPhoneOtp} className="space-y-3.5">
                <div className="rounded-xl border border-[#BFDBFE] bg-[#EBF4FF] p-3.5 text-xs text-[#0F243E]">
                  <p className="font-semibold">
                    {p.smsSentTitle(otpRequestedPhone)}
                  </p>
                  {devPreviewCode ? (
                    <p className="mt-1 font-mono-tabular text-sm font-bold text-[#0066CC]">
                      {p.devSmsPreview(devPreviewCode)}
                    </p>
                  ) : null}
                </div>
                <div>
                  <label
                    htmlFor="patient-otp-code"
                    className="block text-xs font-semibold text-[#0F243E]"
                  >
                    {p.otpCodeLabel}
                  </label>
                  <input
                    id="patient-otp-code"
                    type="text"
                    dir="ltr"
                    inputMode="numeric"
                    pattern="[0-9]{6}"
                    maxLength={6}
                    required
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
                    placeholder="123456"
                    className="mt-1.5 h-11 w-full rounded-xl border border-[#CBDDF0] bg-[#F3F8FD] px-3 text-center font-mono-tabular text-lg tracking-[0.35em] text-[#0F243E] focus:border-[#0066CC] focus:bg-white focus:outline-none"
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="submit"
                    disabled={busy}
                    className="h-10 flex-1 rounded-xl border border-[#0052A3] bg-[#0066CC] px-4 text-sm font-semibold text-white transition hover:bg-[#0052A3] disabled:opacity-50"
                  >
                    {busy ? p.verifyingBtn : p.verifyEnterBtn}
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      setOtpRequestedPhone(null);
                      setOtpCode("");
                      setDevPreviewCode(null);
                    }}
                    className="h-10 rounded-xl border border-[#CBDDF0] bg-white px-3.5 text-xs font-semibold text-[#0F243E] hover:border-[#0E1114]"
                  >
                    {p.changeNumberBtn}
                  </button>
                </div>
              </form>
            )
          ) : (
            <div className="space-y-3">
              <div className="flex gap-2 pb-1 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setMode("signin")}
                  className={
                    mode === "signin"
                      ? "text-[#0066CC] underline underline-offset-4"
                      : "text-[#667382]"
                  }
                >
                  {p.signInWithPhoneTab}
                </button>
                <span className="text-[#CBDDF0]">/</span>
                <button
                  type="button"
                  onClick={() => setMode("register")}
                  className={
                    mode === "register"
                      ? "text-[#0066CC] underline underline-offset-4"
                      : "text-[#667382]"
                  }
                >
                  {p.registerWithPhoneTab}
                </button>
              </div>
              <form onSubmit={handlePasswordAuth} className="space-y-3">
                {mode === "register" ? (
                  <div>
                    <label
                      htmlFor="patient-phone-reg-name"
                      className="block text-xs font-semibold text-[#0F243E]"
                    >
                      {p.fullNameLabel}
                    </label>
                    <input
                      id="patient-phone-reg-name"
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder={p.phoneRegNamePlaceholder}
                      className="mt-1 h-10 w-full rounded-xl border border-[#CBDDF0] px-3 text-sm text-[#0F243E] focus:border-[#0066CC] focus:outline-none"
                    />
                  </div>
                ) : null}
                <div>
                  <label
                    htmlFor="patient-phone-pw-input"
                    className="block text-xs font-semibold text-[#0F243E]"
                  >
                    {p.phoneNumberLabel}
                  </label>
                  <input
                    id="patient-phone-pw-input"
                    type="tel"
                    dir="ltr"
                    required
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="+212 6 61 23 45 67"
                    className="mt-1 h-10 w-full rounded-xl border border-[#CBDDF0] px-3 font-mono-tabular text-sm text-[#0F243E] focus:border-[#0066CC] focus:outline-none"
                  />
                </div>
                <div>
                  <label
                    htmlFor="patient-phone-pw"
                    className="block text-xs font-semibold text-[#0F243E]"
                  >
                    {p.passwordLabel}
                  </label>
                  <div className="relative mt-1">
                    <input
                      id="patient-phone-pw"
                      type={showPassword ? "text" : "password"}
                      required
                      minLength={mode === "register" ? 8 : 1}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={p.passwordPlaceholder}
                      className="h-10 w-full rounded-xl border border-[#CBDDF0] ps-3 pe-10 text-sm text-[#0F243E] focus:border-[#0066CC] focus:outline-none"
                    />
                    <button
                      type="button"
                      aria-label={showPassword ? p.hideCharsAria : p.revealCharsAria}
                      title={p.togglePwTitle}
                      onClick={() => setShowPassword((prev) => !prev)}
                      className="absolute inset-y-0 end-2 inline-flex items-center px-1.5 text-[#667382] hover:text-[#0F243E]"
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" aria-hidden="true" />
                      ) : (
                        <Eye className="h-4 w-4" aria-hidden="true" />
                      )}
                    </button>
                  </div>
                </div>
                {mode === "register" ? (
                  <PrivacyConsentCheckbox
                    id="patient-phone-consent"
                    checked={acceptedTerms}
                    onChange={setAcceptedTerms}
                    scope="PATIENT"
                  />
                ) : null}
                <button
                  type="submit"
                  disabled={busy || (mode === "register" && !acceptedTerms)}
                  className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-[#0052A3] bg-[#0066CC] px-4 text-sm font-semibold text-white transition hover:bg-[#0052A3] disabled:opacity-50"
                >
                  {mode === "register" ? (
                    <UserPlus className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <KeyRound className="h-4 w-4" aria-hidden="true" />
                  )}
                  <span>
                    {mode === "register"
                      ? p.createPhoneBtn
                      : p.signInPhonePwBtn}
                  </span>
                </button>
              </form>
            </div>
          )}
        </div>
      ) : null}

      {/* Channel 2: EMAIL ADDRESS */}
      {channel === "email" ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-1 text-xs font-semibold">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setMode("signin")}
                className={
                  mode === "signin"
                    ? "text-[#0066CC] underline underline-offset-4"
                    : "text-[#667382]"
                }
              >
                {p.emailSignInTab}
              </button>
              <span className="text-[#CBDDF0]">/</span>
              <button
                type="button"
                onClick={() => setMode("register")}
                className={
                  mode === "register"
                    ? "text-[#0066CC] underline underline-offset-4"
                    : "text-[#667382]"
                }
              >
                {p.createAccountTab}
              </button>
            </div>
            <button
              type="button"
              onClick={onSwitchToRecovery}
              className="text-xs font-medium text-[#0066CC] hover:underline"
            >
              {p.resetOrVerifyLink}
            </button>
          </div>

          <form onSubmit={handlePasswordAuth} className="space-y-3">
            {mode === "register" ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="patient-email-reg-name"
                    className="block text-xs font-semibold text-[#0F243E]"
                  >
                    {p.fullNameLabel}
                  </label>
                  <input
                    id="patient-email-reg-name"
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder={p.emailRegNamePlaceholder}
                    className="mt-1 h-10 w-full rounded-xl border border-[#CBDDF0] px-3 text-sm text-[#0F243E] focus:border-[#0066CC] focus:outline-none"
                  />
                </div>
                <div>
                  <label
                    htmlFor="patient-email-reg-phone"
                    className="block text-xs font-semibold text-[#0F243E]"
                  >
                    {p.phoneNumberLabel}{" "}
                    <span className="font-normal text-[#707D8C]">{p.optionalLabel}</span>
                  </label>
                  <input
                    id="patient-email-reg-phone"
                    type="tel"
                    dir="ltr"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="+212 6 00 11 22 33"
                    className="mt-1 h-10 w-full rounded-xl border border-[#CBDDF0] px-3 font-mono-tabular text-sm text-[#0F243E] focus:border-[#0066CC] focus:outline-none"
                  />
                </div>
              </div>
            ) : null}
            <div>
              <label
                htmlFor="patient-email-input"
                className="block text-xs font-semibold text-[#0F243E]"
              >
                {p.patientEmailLabel}
              </label>
              <input
                id="patient-email-input"
                type="email"
                dir="ltr"
                required
                value={emailAddress}
                onChange={(e) => setEmailAddress(e.target.value)}
                placeholder="patient.ma@medisync.global"
                className="mt-1 h-10 w-full rounded-xl border border-[#CBDDF0] px-3 font-mono-tabular text-sm text-[#0F243E] focus:border-[#0066CC] focus:outline-none"
              />
            </div>
            <div>
              <label
                htmlFor="patient-email-pw"
                className="block text-xs font-semibold text-[#0F243E]"
              >
                {p.passwordLabel}
              </label>
              <div className="relative mt-1">
                <input
                  id="patient-email-pw"
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={mode === "register" ? 8 : 1}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={p.enterPasswordPlaceholder}
                  className="h-10 w-full rounded-xl border border-[#CBDDF0] ps-3 pe-10 text-sm text-[#0F243E] focus:border-[#0066CC] focus:outline-none"
                />
                <button
                  type="button"
                  aria-label={showPassword ? p.hideCharsAria : p.revealCharsAria}
                  title={p.togglePwTitle}
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute inset-y-0 end-2 inline-flex items-center px-1.5 text-[#667382] hover:text-[#0F243E]"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <Eye className="h-4 w-4" aria-hidden="true" />
                  )}
                </button>
              </div>
            </div>
            {mode === "register" ? (
              <PrivacyConsentCheckbox
                id="patient-email-consent"
                checked={acceptedTerms}
                onChange={setAcceptedTerms}
                scope="PATIENT"
              />
            ) : null}
            <button
              type="submit"
              disabled={busy || (mode === "register" && !acceptedTerms)}
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-[#0052A3] bg-[#0066CC] px-4 text-sm font-semibold text-white transition hover:bg-[#0052A3] disabled:opacity-50"
            >
              <Mail className="h-4 w-4" aria-hidden="true" />
              <span>
                {mode === "register" ? p.createEmailBtn : p.signInEmailBtn}
              </span>
            </button>
          </form>
        </div>
      ) : null}

      {/* Channel 3: GOOGLE SIGN-IN */}
      {channel === "google" ? (
        <div className="space-y-3">
          <GoogleSignInButton
            disabled={busy}
            onCredential={handleGoogleCredential}
            onUnconfiguredNotice={(msg) =>
              onStatusMessage({ tone: "info", text: msg })
            }
          />
        </div>
      ) : null}
    </div>
  );
}
