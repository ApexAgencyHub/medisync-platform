"use client";

import { ZoomIn } from "lucide-react";
import {
  useImageLightbox,
  type LightboxSpecItem,
} from "./ImageLightboxProvider";

interface EntityMediaPairProps {
  primarySrc: string;
  primaryAlt: string;
  primaryLabel?: string;
  secondarySrc: string;
  secondaryAlt: string;
  secondaryLabel: string;
  title: string;
  subtitle?: string;
  badge?: string;
  specs?: readonly LightboxSpecItem[];
  actionHref?: string;
  actionLabel?: string;
  variant?: "compact" | "showcase";
}

/**
 * Paired visual showcase: renders either a compact inline avatar+badge pair or a
 * large full-card showcase header pairing the primary portrait with its workplace or vehicle.
 */
export function EntityMediaPair({
  primarySrc,
  primaryAlt,
  primaryLabel = "Portrait",
  secondarySrc,
  secondaryAlt,
  secondaryLabel,
  title,
  subtitle,
  badge,
  specs,
  actionHref,
  actionLabel,
  variant = "compact",
}: EntityMediaPairProps) {
  const { openImage } = useImageLightbox();

  function inspectSide(initialView: "primary" | "secondary") {
    openImage({
      src: primarySrc,
      alt: primaryAlt,
      primaryLabel,
      secondarySrc,
      secondaryAlt,
      secondaryLabel,
      initialView,
      title,
      ...(subtitle ? { subtitle } : {}),
      ...(badge ? { badge } : {}),
      ...(specs ? { specs } : {}),
      ...(actionHref ? { actionHref } : {}),
      ...(actionLabel ? { actionLabel } : {}),
    });
  }

  if (variant === "showcase") {
    const primaryIsWideMedia =
      primarySrc.includes("/vehicles/") ||
      primarySrc.includes("/facilities/") ||
      primarySrc.includes("/scenes/");

    return (
      <button
        type="button"
        onClick={() => inspectSide("primary")}
        aria-label={`Inspect ${title} ${primaryLabel} and ${secondaryLabel}`}
        title={`Click to inspect ${primaryLabel} & ${secondaryLabel}`}
        className="group relative flex w-full shrink-0 cursor-zoom-in items-center gap-3 overflow-hidden rounded-xl border border-[#D7E4F2] bg-[#F3F8FD] p-2.5 text-left transition hover:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600/35"
      >
        <span
          className={`relative shrink-0 overflow-hidden rounded-xl bg-white shadow-2xs ${
            primaryIsWideMedia ? "h-20 w-28 aspect-[4/3]" : "h-20 w-20 aspect-square"
          }`}
        >
          <img
            src={primarySrc}
            alt={primaryAlt}
            className="h-full w-full object-cover object-top transition-transform duration-200 group-hover:scale-[1.03]"
          />
        </span>

        <span className="relative h-20 w-28 aspect-[4/3] shrink-0 overflow-hidden rounded-xl bg-white shadow-2xs">
          <img
            src={secondarySrc}
            alt={secondaryAlt}
            className="h-full w-full object-cover object-center transition-transform duration-200 group-hover:scale-[1.03]"
          />
        </span>

        <span className="min-w-0 flex-1 space-y-1 pr-1">
          <span className="block truncate text-xs font-semibold text-slate-900">
            {primaryLabel}
          </span>
          <span className="block truncate text-xs text-slate-500">
            {secondaryLabel}
          </span>
          <span className="inline-flex items-center gap-1 rounded-xl bg-white px-2.5 py-0.5 text-[11px] font-semibold text-[#0066CC] shadow-xs">
            <ZoomIn className="h-3 w-3" aria-hidden="true" />
            <span>Inspect</span>
          </span>
        </span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => inspectSide("primary")}
      aria-label={`Inspect ${title} ${primaryLabel} and ${secondaryLabel}`}
      title={`Click to inspect ${primaryLabel} & ${secondaryLabel}`}
      className="group relative inline-flex shrink-0 cursor-zoom-in items-end rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-600/35"
    >
      <span className="aspect-square h-14 w-14 overflow-hidden rounded-xl border border-[#D7E4F2] bg-[#F3F8FD] transition group-hover:ring-2 group-hover:ring-emerald-600/40 sm:h-16 sm:w-16">
        <img
          src={primarySrc}
          alt={primaryAlt}
          className="h-full w-full object-cover object-top transition-transform duration-150 group-hover:scale-105"
        />
      </span>
      <span className="-ms-3 -mb-1 aspect-[4/3] h-9 w-12 overflow-hidden rounded-xl bg-white shadow-sm ring-2 ring-white transition group-hover:ring-emerald-100">
        <img
          src={secondarySrc}
          alt={secondaryAlt}
          className="h-full w-full object-cover object-center"
        />
      </span>
    </button>
  );
}
