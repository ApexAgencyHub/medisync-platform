"use client";

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
}

/**
 * Paired visual showcase: renders a clean primary portrait or item beside its
 * workplace, facility, or medical transport vehicle. Clicking opens the Split Inspection Modal.
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

  return (
    <div className="flex shrink-0 items-center gap-2">
      <button
        type="button"
        onClick={() => inspectSide("primary")}
        aria-label={`Inspect ${title} ${primaryLabel}`}
        title="Click to inspect & zoom"
        className="group relative h-14 w-14 shrink-0 cursor-zoom-in overflow-hidden rounded-xl border border-teal-200 bg-slate-100 transition hover:border-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-700 sm:h-16 sm:w-16"
      >
        <img
          src={primarySrc}
          alt={primaryAlt}
          className="h-full w-full object-cover transition-transform duration-150 group-hover:scale-105"
        />
      </button>

      <button
        type="button"
        onClick={() => inspectSide("secondary")}
        aria-label={`Inspect ${title} ${secondaryLabel}`}
        title={`Click to view ${secondaryLabel}`}
        className="group relative h-14 w-18 shrink-0 cursor-zoom-in overflow-hidden rounded-xl border border-slate-200 bg-slate-50 transition hover:border-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-700 sm:h-16 sm:w-20"
      >
        <img
          src={secondarySrc}
          alt={secondaryAlt}
          className="h-full w-full object-cover transition-transform duration-150 group-hover:scale-105"
        />
      </button>
    </div>
  );
}
