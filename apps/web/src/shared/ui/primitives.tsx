"use client";

import Link from "next/link";
import type {
  ButtonHTMLAttributes,
  ComponentPropsWithoutRef,
  InputHTMLAttributes,
  ReactNode,
} from "react";
import type { AuthResponse } from "@medisync/contracts";
import { LogOut, UserCheck } from "lucide-react";
import { formatRoleLabel } from "../i18n/human-labels";
import { useLocale } from "../i18n/locale-store";
import { EntityAvatar } from "./EntityAvatar";

export { UiSelect, type UiSelectProps } from "./UiSelect";
export {
  ToastProvider,
  useToast,
  useToastSetter,
  type ToastInput,
  type ToastTone,
} from "./ToastProvider";
export { WorkspaceHeader, type WorkspaceHeaderProps } from "./WorkspaceHeader";

export type UiButtonVariant =
  | "primary"
  | "obsidian"
  | "phosphor"
  | "secondary"
  | "outline"
  | "chassis"
  | "danger"
  | "ghost"
  | "soft";
export type UiButtonSize = "sm" | "md" | "lg";

const BUTTON_VARIANTS: Record<UiButtonVariant, string> = {
  primary:
    "bg-[#0066CC] text-white border border-[#0058B0] shadow-[0_6px_16px_-6px_rgba(0,102,204,0.4)] hover:bg-[#0052A3]",
  obsidian:
    "bg-[#0F243E] text-white border border-[#0F243E] hover:bg-[#1B375B]",
  phosphor:
    "bg-[#0066CC] text-white border border-[#0058B0] shadow-[0_6px_16px_-6px_rgba(0,102,204,0.4)] hover:bg-[#0052A3]",
  secondary:
    "border border-[#D7E4F2] bg-[#E8F1FA] text-[#0F243E] hover:bg-[#DCE9F7]",
  outline:
    "border border-[#CBDDF0] bg-white text-[#0F243E] hover:border-[#0066CC] hover:bg-[#F3F8FD]",
  chassis:
    "border border-[#CBDDF0] bg-white text-[#0F243E] hover:border-[#0066CC] hover:bg-[#F3F8FD]",
  danger:
    "bg-[#DC2626] text-white border border-[#B91C1C] hover:bg-[#B91C1C]",
  ghost:
    "text-[#4A627D] border border-transparent hover:bg-[#E8F1FA] hover:text-[#0F243E]",
  soft: "border border-[#D7E4F2] bg-[#F3F8FD] text-[#0F243E] hover:bg-[#E8F1FA]",
};

const BUTTON_SIZES: Record<UiButtonSize, string> = {
  sm: "min-h-[36px] px-3.5 py-1.5 text-xs",
  md: "min-h-[40px] px-4 py-2 text-[13px]",
  lg: "min-h-[44px] px-5 py-2.5 text-sm",
};

function buttonClassNames({
  variant = "primary",
  size = "md",
  pill = false,
  className = "",
}: {
  variant?: UiButtonVariant | undefined;
  size?: UiButtonSize | undefined;
  pill?: boolean | undefined;
  className?: string | undefined;
}) {
  return `inline-flex items-center justify-center gap-1.5 whitespace-nowrap ${pill ? "rounded-full" : "rounded-xl"} font-semibold tracking-[-0.01em] transition-[background-color,border-color,color,box-shadow,transform] duration-150 active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0066CC]/30 disabled:pointer-events-none disabled:opacity-50 ${BUTTON_VARIANTS[variant]} ${BUTTON_SIZES[size]} ${className}`;
}

interface UiButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: UiButtonVariant;
  size?: UiButtonSize;
  pill?: boolean;
}

export function UiButton({
  variant = "primary",
  size = "md",
  pill = false,
  type = "button",
  className = "",
  ...rest
}: UiButtonProps) {
  return (
    <button
      type={type}
      className={buttonClassNames({ variant, size, pill, className })}
      {...rest}
    />
  );
}

interface UiLinkButtonProps extends ComponentPropsWithoutRef<typeof Link> {
  variant?: UiButtonVariant;
  size?: UiButtonSize;
  pill?: boolean;
}

export function UiLinkButton({
  variant = "primary",
  size = "md",
  pill = false,
  className = "",
  ...rest
}: UiLinkButtonProps) {
  return (
    <Link
      className={buttonClassNames({ variant, size, pill, className })}
      {...rest}
    />
  );
}

export function UiInput({
  className = "",
  ...rest
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`h-10 w-full rounded-xl border border-[#CBDDF0] bg-white px-3.5 text-sm text-[#0F243E] placeholder:text-[#7D96B2] focus:border-[#0066CC] focus:outline-none focus:ring-2 focus:ring-[#0066CC]/18 disabled:bg-[#E8F1FA] disabled:text-[#6B829D] ${className}`}
      {...rest}
    />
  );
}

interface UiSwitchProps {
  id?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  caption?: string;
  disabled?: boolean;
}

export function UiSwitch({
  id,
  checked,
  onChange,
  label,
  caption,
  disabled = false,
}: UiSwitchProps) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="inline-flex min-h-[40px] items-center gap-2.5 rounded-xl border border-[#CBDDF0] bg-white px-3 py-1.5 text-left transition-colors hover:border-[#0066CC] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0066CC]/30 disabled:opacity-50"
    >
      <span
        aria-hidden="true"
        className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
          checked ? "bg-[#0066CC]" : "bg-[#B7CDE4]"
        }`}
      >
        <span
          className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow-xs transition-transform ${
            checked ? "translate-x-4.5" : "translate-x-0.5"
          }`}
        />
      </span>
      <span className="min-w-0">
        <span className="block text-xs font-semibold text-[#0F243E]">
          {label}
        </span>
        {caption ? (
          <span className="block text-[11px] text-[#6B829D]">{caption}</span>
        ) : null}
      </span>
    </button>
  );
}

export type UiBadgeTone = "teal" | "emerald" | "amber" | "red" | "slate";

const BADGE_TONES: Record<UiBadgeTone, string> = {
  teal: "border border-[#BFDBFE] bg-[#EBF4FF] text-[#0052A3]",
  emerald: "border border-[#B2E5DC] bg-[#E6F7F4] text-[#0B6B5C]",
  amber: "border border-amber-200 bg-amber-50 text-amber-900",
  red: "border border-rose-200 bg-rose-50 text-[#B91C1C]",
  slate: "border border-[#D7E4F2] bg-[#F3F8FD] text-[#2F4661]",
};

export function UiBadge({
  tone = "slate",
  children,
  className = "",
}: {
  tone?: UiBadgeTone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex max-w-full items-center truncate rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${BADGE_TONES[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

export function SectionCard({
  title,
  actions,
  children,
  className = "",
}: {
  title?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-2xl border border-[#D7E4F2] bg-white p-5 shadow-[0_4px_20px_-10px_rgba(15,36,62,0.08)] ${className}`}
    >
      {title || actions ? (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-[#E8F1FA] pb-3">
          {title ? (
            <h2 className="font-editorial text-[15px] font-bold tracking-[-0.015em] text-[#0F243E]">
              {title}
            </h2>
          ) : (
            <span />
          )}
          {actions}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export interface StatStripItem {
  label: string;
  value: string;
  detail?: string | undefined;
  tone?: "neutral" | "emerald" | "amber" | "crimson" | undefined;
}

/**
 * Pure White Medical KPI Summary Strip.
 */
export function StatStrip({
  items,
  ariaLabel,
  columns = 4,
}: {
  items: readonly StatStripItem[];
  ariaLabel?: string;
  columns?: 2 | 3 | 4;
}) {
  const colClass =
    columns === 2
      ? "grid-cols-2"
      : columns === 3
        ? "grid-cols-1 sm:grid-cols-3"
        : "grid-cols-2 md:grid-cols-4";

  return (
    <section
      aria-label={ariaLabel}
      className={`grid gap-2 sm:gap-2.5 ${colClass}`}
    >
      {items.map((item) => {
        const valueColor =
          item.tone === "emerald"
            ? "text-[#0F9D88]"
            : item.tone === "amber"
              ? "text-amber-700"
              : item.tone === "crimson"
                ? "text-[#DC2626]"
                : "text-[#0066CC]";
        const dotColor =
          item.tone === "emerald"
            ? "bg-[#0F9D88]"
            : item.tone === "amber"
              ? "bg-amber-500"
              : item.tone === "crimson"
                ? "bg-[#DC2626]"
                : "bg-[#0066CC]";

        return (
          <article
            key={item.label}
            className="flex flex-col justify-between rounded-xl border border-[#D7E4F2] bg-white px-3 py-2.5 shadow-[0_4px_16px_-10px_rgba(15,36,62,0.08)] sm:rounded-2xl sm:px-3.5 sm:py-3 xl:px-4 xl:py-3.5"
          >
            <div className="flex items-center gap-1.5">
              <span
                aria-hidden="true"
                className={`h-1.5 w-1.5 shrink-0 rounded-full ${dotColor}`}
              />
              <p className="truncate text-[11px] font-semibold leading-tight text-[#556E89] xl:text-xs">
                {item.label}
              </p>
            </div>
            <p
              dir="ltr"
              className={`mt-1.5 font-editorial font-mono-tabular text-lg font-bold leading-none tracking-tight sm:text-xl xl:text-2xl ${valueColor}`}
            >
              {item.value}
            </p>
            {item.detail ? (
              <p className="mt-1 truncate text-[10.5px] leading-tight text-[#6B829D] xl:text-[11px]">
                {item.detail}
              </p>
            ) : null}
          </article>
        );
      })}
    </section>
  );
}

export function KpiMetricTile({
  label,
  value,
  detail,
  tone = "neutral",
}: StatStripItem) {
  const valueColor =
    tone === "emerald"
      ? "text-[#0F9D88]"
      : tone === "amber"
        ? "text-amber-700"
        : tone === "crimson"
          ? "text-[#DC2626]"
          : "text-[#0066CC]";

  return (
    <article className="rounded-xl border border-[#D7E4F2] bg-white px-3 py-2.5 shadow-[0_4px_16px_-10px_rgba(15,36,62,0.08)] sm:rounded-2xl sm:px-3.5 sm:py-3">
      <p className="truncate text-[11px] font-semibold leading-tight text-[#556E89] xl:text-xs">
        {label}
      </p>
      <p
        dir="ltr"
        className={`mt-1.5 font-editorial font-mono-tabular text-lg font-bold leading-none tracking-tight sm:text-xl xl:text-2xl ${valueColor}`}
      >
        {value}
      </p>
      {detail ? (
        <p className="mt-1 truncate text-[10.5px] leading-tight text-[#6B829D] xl:text-[11px]">
          {detail}
        </p>
      ) : null}
    </article>
  );
}

export interface UiTabItem<T extends string = string> {
  id: T;
  label: string;
  icon?: ReactNode;
}

export function UiTabBar<T extends string>({
  tabs,
  activeTab,
  onSelect,
  ariaLabel,
  className = "",
}: {
  tabs: readonly UiTabItem<T>[];
  activeTab: T;
  onSelect: (id: T) => void;
  ariaLabel: string;
  className?: string;
}) {
  return (
    <div className={`relative max-w-full ${className}`}>
      <div
        role="tablist"
        aria-label={ariaLabel}
        className="atlas-no-scrollbar flex max-w-full snap-x snap-mandatory items-center gap-1 overflow-x-auto rounded-2xl border border-[#D7E4F2] bg-white p-1 pe-7 shadow-2xs lg:flex-wrap lg:overflow-visible lg:pe-1"
      >
        {tabs.map((tab) => {
          const selected = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              role="tab"
              type="button"
              aria-selected={selected}
              onClick={() => onSelect(tab.id)}
              className={
                selected
                  ? "inline-flex min-h-[32px] shrink-0 snap-start items-center gap-1.5 whitespace-nowrap rounded-xl bg-[#0066CC] px-2.5 py-1 text-[11.5px] font-semibold text-white shadow-xs transition-transform duration-100 hover:bg-[#0052A3] active:scale-[0.97] xl:min-h-[36px] xl:px-3.5 xl:text-xs"
                  : "inline-flex min-h-[32px] shrink-0 snap-start items-center gap-1.5 whitespace-nowrap rounded-xl bg-transparent px-2.5 py-1 text-[11.5px] font-semibold text-[#4A627D] transition-transform duration-100 hover:bg-[#F3F8FD] hover:text-[#0F243E] active:scale-[0.97] xl:min-h-[36px] xl:px-3.5 xl:text-xs"
              }
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>
      {/* Subtle scroll-cue fade on narrow screens so hidden tabs are discoverable */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-1 end-1 w-8 rounded-e-xl bg-gradient-to-l from-white via-white/80 to-transparent lg:hidden rtl:bg-gradient-to-r"
      />
    </div>
  );
}

export function SessionAccountBar({
  session,
  onSignOut,
  portalHref,
  prompt,
}: {
  session: AuthResponse | null;
  onSignOut?: () => void;
  portalHref?: string;
  prompt?: string;
}) {
  const { locale, isRtl } = useLocale();
  const resolvedPortalHref =
    portalHref ??
    (session &&
    session.user.role !== "PATIENT" &&
    session.user.role !== "CAREGIVER"
      ? "/pro"
      : "/portal");
  const labels =
    locale === "ar"
      ? {
          defaultPrompt: "سجّل الدخول للمتابعة.",
          signInPortal: "تسجيل الدخول",
          pendingVerify: "قيد المراجعة",
          switchAccount: "تبديل",
          signOut: "خروج",
        }
      : locale === "fr"
        ? {
            defaultPrompt: "Connectez-vous pour continuer.",
            signInPortal: "Connexion",
            pendingVerify: "Validation en attente",
            switchAccount: "Changer",
            signOut: "Sortir",
          }
        : {
            defaultPrompt: "Sign in to continue.",
            signInPortal: "Sign In",
            pendingVerify: "Pending Verification",
            switchAccount: "Switch",
            signOut: "Sign Out",
          };
  const resolvedPrompt = prompt ?? labels.defaultPrompt;

  if (!session) {
    return (
      <div
        dir={isRtl ? "rtl" : "ltr"}
        className="flex flex-wrap items-center justify-between gap-2.5 rounded-2xl border border-[#D7E4F2] bg-white px-4 py-3"
      >
        <div className="flex min-w-0 items-center gap-2 text-xs text-[#4A627D]">
          <UserCheck className="h-4 w-4 shrink-0 text-[#0066CC]" aria-hidden="true" />
          <span className="truncate">{resolvedPrompt}</span>
        </div>
        <Link
          href={resolvedPortalHref}
          className="inline-flex min-h-[34px] shrink-0 items-center rounded-xl bg-[#0066CC] px-4 py-1.5 text-xs font-semibold text-white hover:bg-[#0052A3]"
        >
          {labels.signInPortal}
        </Link>
      </div>
    );
  }

  const isPendingStaff =
    session.user.accountStatus === "PENDING_APPROVAL" ||
    (session.user.role !== "PATIENT" &&
      session.user.role !== "CAREGIVER" &&
      session.user.role !== "OPS_ADMIN" &&
      !session.user.credentialVerified);

  return (
    <div
      dir={isRtl ? "rtl" : "ltr"}
      className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-4 py-3 ${
        isPendingStaff
          ? "border-amber-200 bg-amber-50/80"
          : "border-[#D7E4F2] bg-white"
      }`}
    >
      <div className="flex min-w-0 items-center gap-2.5">
        <EntityAvatar
          name={session.user.fullName}
          role={session.user.role}
          avatarUrl={session.user.avatarUrl}
          subtitle={`${formatRoleLabel(session.user.role, locale)} · ${session.user.countryCode}`}
          size="xs"
        />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="truncate text-xs font-bold text-[#0F243E]">
              <bdi dir="auto">{session.user.fullName}</bdi>
            </p>
            {isPendingStaff ? (
              <Link
                href={resolvedPortalHref}
                className="rounded-full border border-amber-300 bg-amber-100 px-2 py-0.5 text-[10.5px] font-semibold text-amber-950"
              >
                {labels.pendingVerify}
              </Link>
            ) : null}
          </div>
          <p className="truncate text-[11.5px] font-medium text-[#6B829D]">
            {formatRoleLabel(session.user.role, locale)} · {session.user.countryCode}
          </p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        <Link
          href={resolvedPortalHref}
          className="inline-flex min-h-[32px] items-center rounded-xl border border-[#D7E4F2] bg-[#F3F8FD] px-3 py-1 text-xs font-semibold text-[#0F243E] hover:bg-white"
        >
          {labels.switchAccount}
        </Link>
        {onSignOut ? (
          <button
            type="button"
            onClick={onSignOut}
            className="inline-flex min-h-[32px] items-center gap-1 rounded-xl border border-[#D7E4F2] bg-white px-3 py-1 text-xs font-semibold text-[#4A627D] hover:border-rose-300 hover:bg-rose-50 hover:text-[#DC2626]"
          >
            <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{labels.signOut}</span>
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function formatPractitionerDisplayName(
  name: string,
  specialty?: string,
): string {
  const clean = name.trim();
  if (!clean) {
    return "Practitioner";
  }
  if (specialty && /nursing|infirmier|nurse/i.test(specialty)) {
    return clean;
  }
  return /^dr\.?(?=\s|$)/i.test(clean) ? clean : `Dr. ${clean}`;
}
