"use client";

import Image from "next/image";
import { ZoomIn } from "lucide-react";
import { useImageLightbox } from "./ImageLightboxProvider";

interface ZoomableHeroImageProps {
  src: string;
  alt: string;
  title: string;
  subtitle?: string;
}

/** Displays a crisp overview illustration that opens the full-screen zoom modal on click. */
export function ZoomableHeroImage({
  src,
  alt,
  title,
  subtitle,
}: ZoomableHeroImageProps) {
  const { openImage } = useImageLightbox();

  return (
    <button
      type="button"
      onClick={() =>
        openImage({
          src,
          alt,
          title,
          ...(subtitle ? { subtitle } : {}),
        })
      }
      aria-label={`Zoom ${title}`}
      className="group relative block w-full cursor-zoom-in overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 text-left shadow-xs transition hover:border-teal-700/50 focus:outline-none focus:ring-2 focus:ring-teal-700"
    >
      <Image
        src={src}
        alt={alt}
        width={1408}
        height={768}
        priority
        className="h-auto w-full rounded-xl object-cover"
      />
      <span className="pointer-events-none absolute right-4 bottom-4 inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white/95 px-2.5 py-1 text-xs font-semibold text-slate-800 shadow-xs transition group-hover:border-teal-700 group-hover:text-teal-900">
        <ZoomIn className="h-3.5 w-3.5 text-teal-800" aria-hidden="true" />
        <span>Expand View</span>
      </span>
    </button>
  );
}
