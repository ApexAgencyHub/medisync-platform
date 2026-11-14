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
    <button
      type="button"
      onClick={() => inspectSide("primary")}
      aria-label={`Inspect ${title} ${primaryLabel} and ${secondaryLabel}`}
      title={`Click to inspect ${primaryLabel} & ${secondaryLabel}`}
      className="group relative inline-flex shrink-0 cursor-zoom-in items-end focus:outline-none focus:ring-2 focus:ring-teal-700 rounded-xl"
    >
      <span className="h-14 w-14 overflow-hidden rounded-xl border border-teal-200 bg-slate-100 transition group-hover:border-teal-700 sm:h-16 sm:w-16">
        <img
          src={primarySrc}
          alt={primaryAlt}
          className="h-full w-full object-cover transition-transform duration-150 group-hover:scale-105"
        />
      </span>
      <span className="-ms-3 -mb-1 h-8 w-9 overflow-hidden rounded-lg border-2 border-white bg-slate-50 shadow-sm transition group-hover:border-teal-100">
        <img
          src={secondarySrc}
          alt={secondaryAlt}
          className="h-full w-full object-cover"
        />
      </span>
    </button>
  );
}
