"use client";

import Link from "next/link";
import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
} from "react";
import type { AuthResponse } from "@medisync/contracts";
import { AlertCircle, CheckCircle2, Info, LogOut, UserCheck } from "lucide-react";
import { formatRoleLabel } from "../i18n/human-labels";
import { EntityAvatar } from "./EntityAvatar";

export type UiButtonVariant =
  | "primary"
  | "secondary"
  | "outline"
  | "danger"
  | "ghost";
export type UiButtonSize = "sm" | "md" | "lg";

const BUTTON_VARIANTS: Record<UiButtonVariant, string> = {
  primary:
    "bg-teal-800 text-white border border-teal-800 hover:bg-teal-900 shadow-xs",
  secondary:
    "border border-slate-300 bg-white text-slate-800 hover:border-teal-700 hover:text-teal-900",
  outline:
    "border border-teal-700 bg-teal-50/40 text-teal-900 hover:bg-teal-100/70",
  danger: "bg-red-700 text-white border border-red-700 hover:bg-red-800",
  ghost: "text-slate-700 border border-transparent hover:bg-slate-100",
};

const BUTTON_SIZES: Record<UiButtonSize, string> = {
  sm: "min-h-[34px] px-3 py-1.5 text-xs",
  md: "min-h-[40px] px-4 py-2 text-xs",
  lg: "min-h-[44px] px-5 py-2.5 text-sm",
};

interface UiButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: UiButtonVariant;
  size?: UiButtonSize;
}

/** Standardized clinical button with crisp hover, focus, and tactile press feedback. */
export function UiButton({
  variant = "primary",
  size = "md",
  type = "button",
  className = "",
  ...rest
}: UiButtonProps) {
  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg font-semibold transition-colors active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-teal-700/40 disabled:cursor-not-allowed disabled:opacity-50 ${BUTTON_VARIANTS[variant]} ${BUTTON_SIZES[size]} ${className}`}
      {...rest}
    />
  );
}

/** Standardized single-line clinical form input. */
export function UiInput({
  className = "",
  ...rest
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-700/15 disabled:bg-slate-100 disabled:text-slate-500 ${className}`}
      {...rest}
    />
  );
}

/** Standardized accessible select dropdown across all clinical workspaces. */
export function UiSelect({
  className = "",
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={`h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:border-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-700/15 disabled:bg-slate-100 disabled:text-slate-500 ${className}`}
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

/** Accessible pill toggle switch replacing unstyled browser checkboxes. */
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
      className="inline-flex min-h-[38px] items-center gap-2.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-left transition-colors hover:border-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-700/30 disabled:opacity-50"
    >
      <span
        aria-hidden="true"
        className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
          checked ? "bg-teal-800" : "bg-slate-300"
        }`}
      >
        <span
          className={`inline-block h-4 w-4 rounded-full bg-white shadow-xs transition-transform ${
            checked ? "translate-x-4" : "translate-x-0.5"
          }`}
        />
      </span>
      <span className="min-w-0">
        <span className="block text-xs font-semibold text-slate-800">
          {label}
        </span>
        {caption ? (
          <span className="block text-[11px] text-slate-500">{caption}</span>
        ) : null}
      </span>
    </button>
  );
}

export type UiBadgeTone = "teal" | "emerald" | "amber" | "red" | "slate";

const BADGE_TONES: Record<UiBadgeTone, string> = {
  teal: "border-teal-200 bg-teal-50 text-teal-900",
  emerald: "border-emerald-200 bg-emerald-50 text-emerald-900",
  amber: "border-amber-200 bg-amber-50 text-amber-900",
  red: "border-red-200 bg-red-50 text-red-900",
  slate: "border-slate-200 bg-slate-100 text-slate-700",
};

/** Compact clinical status pill badge. */
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
      className={`inline-flex max-w-full items-center truncate rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${BADGE_TONES[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

export type StatusBannerTone = "success" | "error" | "warning" | "info";

const BANNER_STYLES: Record<StatusBannerTone, string> = {
  success: "border-emerald-200 bg-emerald-50 text-emerald-950",
  error: "border-red-200 bg-red-50 text-red-950",
  warning: "border-amber-200 bg-amber-50 text-amber-950",
  info: "border-teal-200 bg-teal-50 text-teal-950",
};

/** Unified status feedback alert displayed inline above workflow actions. */
export function StatusBanner({
  tone = "info",
  message,
  className = "",
}: {
  tone?: StatusBannerTone;
  message: string;
  className?: string;
}) {
  const Icon =
    tone === "success"
      ? CheckCircle2
      : tone === "error" || tone === "warning"
        ? AlertCircle
        : Info;
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={`flex items-start gap-2 rounded-xl border px-3.5 py-2.5 text-xs font-medium ${BANNER_STYLES[tone]} ${className}`}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <p className="min-w-0 leading-relaxed">{message}</p>
    </div>
  );
}

export interface RegionTabOption {
  code: string;
  label: string;
}

export const DEFAULT_REGION_TABS: readonly RegionTabOption[] = [
  { code: "MA", label: "MA · Morocco" },
  { code: "INTL", label: "INTL · Global" },
  { code: "FR", label: "FR · France" },
  { code: "US", label: "US · USA" },
];

/** Standardized region selector bar shared across directory, booking, map, and pharmacy pages. */
export function RegionTabs({
  value,
  onChange,
  options = DEFAULT_REGION_TABS,
  className = "",
}: {
  value: string;
  onChange: (countryCode: string) => void;
  options?: readonly RegionTabOption[];
  className?: string;
}) {
  return (
    <div
      role="group"
      aria-label="Care region filter"
      className={`inline-flex flex-wrap items-center gap-1.5 ${className}`}
    >
      {options.map((region) => {
        const active = region.code === value;
        return (
          <button
            key={region.code}
            type="button"
            onClick={() => onChange(region.code)}
            aria-pressed={active}
            className={
              active
                ? "min-h-[36px] rounded-lg bg-teal-800 px-3 py-1.5 text-xs font-semibold text-white shadow-xs transition-colors"
                : "min-h-[36px] rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:border-teal-700 hover:text-teal-900"
            }
          >
            {region.label}
          </button>
        );
      })}
    </div>
  );
}

/** Compact authenticated account bar linking identity actions cleanly to /portal. */
export function SessionAccountBar({
  session,
  onSignOut,
  portalHref = "/portal",
  prompt = "Sign in on the Care Portal to book visits, request medical transport, or submit orders.",
}: {
  session: AuthResponse | null;
  onSignOut?: () => void;
  portalHref?: string;
  prompt?: string;
}) {
  if (!session) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-2 text-xs text-slate-700">
          <UserCheck className="h-4 w-4 shrink-0 text-teal-800" aria-hidden="true" />
          <span className="truncate">{prompt}</span>
        </div>
        <Link
          href={portalHref}
          className="inline-flex min-h-[34px] shrink-0 items-center rounded-lg bg-teal-800 px-3.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-teal-900"
        >
          Sign In via Portal
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-teal-200 bg-teal-50/50 px-4 py-2">
      <div className="flex min-w-0 items-center gap-2.5">
        <EntityAvatar
          name={session.user.fullName}
          role={session.user.role}
          avatarUrl={session.user.avatarUrl}
          subtitle={`${formatRoleLabel(session.user.role)} · ${session.user.countryCode}`}
          size="xs"
        />
        <div className="min-w-0">
          <p className="truncate text-xs font-bold text-slate-900">
            <bdi dir="auto">{session.user.fullName}</bdi>
          </p>
          <p className="truncate text-[11px] font-medium text-slate-600">
            {formatRoleLabel(session.user.role)} · {session.user.countryCode}
          </p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <Link
          href={portalHref}
          className="inline-flex min-h-[32px] items-center rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 transition-colors hover:border-teal-700 hover:text-teal-900"
        >
          Switch Account
        </Link>
        {onSignOut ? (
          <button
            type="button"
            onClick={onSignOut}
            className="inline-flex min-h-[32px] items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 transition-colors hover:border-red-600 hover:text-red-700"
          >
            <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Sign Out</span>
          </button>
        ) : null}
      </div>
    </div>
  );
}
