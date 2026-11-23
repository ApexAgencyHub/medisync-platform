"use client";

import { useEffect, useState, type FormEvent } from "react";
import {
  type AdminCreateUserInput,
  type AuthenticatedUser,
  type CountryPack,
  type FacilitySummary,
  type UserRole,
} from "@medisync/contracts";
import { UserPlus, X } from "lucide-react";
import {
  formatCountryDisplayName,
  formatFacilityKind,
  formatRoleLabel,
} from "@/shared/i18n/human-labels";
import { useLocale } from "@/shared/i18n/locale-store";
import { EntityPicker } from "@/shared/ui/EntityPicker";
import { UiSwitch, useToastSetter } from "@/shared/ui/primitives";
import {
  MoroccanComplianceBadge,
  TactilePillGroup,
} from "@/shared/ui/TactileControls";
import { ADMIN_COPY } from "../admin-i18n";
import { createAdminUser } from "../api-client";

interface AdminProvisionUserModalProps {
  apiBaseUrl: string;
  token: string;
  packs: readonly CountryPack[];
  facilities: readonly FacilitySummary[];
  defaultCountryCode: string;
  onClose: () => void;
  onCreated: (user: AuthenticatedUser) => void;
}

const PROVISIONABLE_ROLES: readonly UserRole[] = [
  "DOCTOR",
  "NURSE",
  "CLINIC_STAFF",
  "PHARMACIST",
  "LAB_TECH",
  "DRIVER",
  "HOSPITAL_ADMIN",
  "OPS_ADMIN",
  "PATIENT",
];

export function AdminProvisionUserModal({
  apiBaseUrl,
  token,
  packs,
  facilities,
  defaultCountryCode,
  onClose,
  onCreated,
}: AdminProvisionUserModalProps) {
  const { locale, isRtl } = useLocale();
  const pm = ADMIN_COPY[locale].provisionModal;
  const setBanner = useToastSetter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>("DOCTOR");
  const [countryCode] = useState(defaultCountryCode);
  const [facilityId, setFacilityId] = useState("");
  const [credentialVerified, setCredentialVerified] = useState(true);
  const activePack = packs.find((p) => p.code === countryCode) ?? packs[0];

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);
  const [busy, setBusy] = useState(false);

  const scopedFacilities = facilities.filter((f) => f.countryCode === countryCode);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const payload: AdminCreateUserInput = {
      email: email.trim(),
      password,
      fullName: fullName.trim(),
      role,
      countryCode,
      ...(phone.trim().length >= 6 ? { phone: phone.trim() } : {}),
      ...(facilityId ? { facilityId } : {}),
      accountStatus: "ACTIVE",
      credentialVerified,
    };

    setBusy(true);
    const res = await createAdminUser(apiBaseUrl, token, payload);
    setBusy(false);

    if (!res.ok) {
      setBanner({
        tone: "error",
        text: pm.failedMsg(res.error),
      });
      return;
    }

    onCreated(res.data.user);
    setBanner({
      tone: "success",
      text: pm.successMsg(
        res.data.user.fullName,
        formatRoleLabel(res.data.user.role, locale),
        res.data.user.countryCode,
      ),
    });
    onClose();
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={pm.ariaLabel}
      dir={isRtl ? "rtl" : "ltr"}
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 p-0 backdrop-blur-xs sm:items-center sm:p-4"
      onClick={onClose}
    >
      <form
        onSubmit={(e) => void handleSubmit(e)}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90dvh] w-full max-w-lg space-y-4 overflow-y-auto rounded-t-3xl border border-[#D7E4F2] bg-white p-5 shadow-2xl sm:rounded-2xl sm:p-6"
      >
        <div className="mx-auto h-1 w-10 rounded-full bg-slate-200 sm:hidden" />

        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <UserPlus className="h-4 w-4 text-[#0066CC]" aria-hidden="true" />
            <h2 className="font-editorial text-base font-bold text-[#0F243E]">
              {pm.title}
            </h2>
          </div>
          <button
            type="button"
            aria-label={pm.closeAria}
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block space-y-1 text-xs font-semibold text-slate-700">
            <span>{pm.fullNameLabel}</span>
            <input
              type="text"
              required
              minLength={2}
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Dr. Karim Benjelloun"
              className="w-full rounded-xl border border-[#CBDDF0] bg-white px-3 py-2 text-sm text-[#0F243E]"
            />
          </label>
          <label className="block space-y-1 text-xs font-semibold text-slate-700">
            <span>{pm.workEmailLabel}</span>
            <input
              type="email"
              dir="ltr"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="karim.clinic@medisync.ma"
              className="w-full rounded-xl border border-[#CBDDF0] bg-white px-3 py-2 text-sm text-[#0F243E]"
            />
          </label>
        </div>

        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-semibold text-[#0F243E]">
              {pm.accountRoleLabel}
            </span>
            <span className="inline-flex items-center rounded-full border border-[#BFDBFE] bg-[#EBF4FF] px-2.5 py-0.5 text-[11px] font-semibold text-[#0052A3]">
              {formatCountryDisplayName(
                countryCode,
                activePack?.name ?? countryCode,
                locale,
              )}{" "}
              ({countryCode})
            </span>
          </div>
          <TactilePillGroup
            ariaLabel={pm.accountRoleLabel}
            size="xs"
            value={role}
            onChange={(next) => setRole(next)}
            options={PROVISIONABLE_ROLES.map((r) => ({
              value: r,
              label: formatRoleLabel(r, locale),
            }))}
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block space-y-1 text-xs font-semibold text-slate-700">
            <span>{pm.tempPasswordLabel}</span>
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={pm.tempPasswordPlaceholder}
              className="w-full rounded-xl border border-[#CBDDF0] bg-white px-3 py-2 text-sm text-[#0F243E]"
            />
          </label>
          <label className="block space-y-1 text-xs font-semibold text-slate-700">
            <span>{pm.mobilePhoneLabel}</span>
            <input
              type="tel"
              dir="ltr"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+212661234567"
              className="w-full rounded-xl border border-[#CBDDF0] bg-white px-3 py-2 font-mono-tabular text-sm text-[#0F243E]"
            />
          </label>
        </div>

        {role !== "PATIENT" && role !== "DRIVER" ? (
          <EntityPicker
            id="admin-provision-facility"
            label={pm.primaryFacilityLabel(countryCode)}
            placeholder={pm.primaryFacilityLabel(countryCode)}
            emptyLabel={pm.unassignedOption}
            value={facilityId}
            onChange={setFacilityId}
            options={scopedFacilities.map((fac) => ({
              id: fac.id,
              label: fac.name,
              sublabel: formatFacilityKind(fac.kind, locale),
            }))}
          />
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-2">
          <UiSwitch
            checked={credentialVerified}
            onChange={setCredentialVerified}
            label={pm.preVerifyLabel}
          />
          <MoroccanComplianceBadge domain="admin" locale={locale} />
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="h-10 rounded-xl border border-[#D7E4F2] bg-[#F3F8FD] px-4 text-xs font-semibold text-[#0F243E] hover:bg-white"
          >
            {pm.cancelBtn}
          </button>
          <button
            type="submit"
            disabled={busy}
            className="h-10 rounded-xl bg-[#0066CC] px-5 text-xs font-semibold text-white hover:bg-[#0052A3] active:scale-[0.98] disabled:opacity-60"
          >
            {busy ? pm.submittingBtn : pm.submitBtn}
          </button>
        </div>
      </form>
    </div>
  );
}
