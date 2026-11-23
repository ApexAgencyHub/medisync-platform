"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ExternalLink,
  FileText,
  RotateCcw,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { useLocale } from "@/shared/i18n/locale-store";
import type { LightboxImage } from "./ImageLightboxProvider";

const LIGHTBOX_COPY = {
  en: {
    reset: "Reset",
    open: "Open",
    docTitle: "Certified Medical Document",
    docHint: "Open or download this document to inspect it in your clinical viewer.",
    downloadDoc: "Download Document",
    zoomHint: "Click photo or use + / - controls to zoom up to 250%",
    escHint: "Press Esc to close",
  },
  fr: {
    reset: "Réinitialiser",
    open: "Ouvrir",
    docTitle: "Document Médical Certifié",
    docHint: "Ouvrez ou téléchargez ce document pour le consulter.",
    downloadDoc: "Télécharger le document",
    zoomHint: "Cliquez sur la photo ou utilisez + / - pour zoomer jusqu'à 250%",
    escHint: "Appuyez sur Échap pour fermer",
  },
  ar: {
    reset: "إرجاع",
    open: "فتح",
    docTitle: "وثيقة طبية معتمدة",
    docHint: "افتح أو نزّل هاد الوثيقة باش تشوفها بوضوح.",
    downloadDoc: "تحميل الوثيقة",
    zoomHint: "برّك على الصورة أو استعمل + / - للتكبير حتى 250%",
    escHint: "اضغط Esc للإغلاق",
  },
} as const;

const ZOOM_STEPS = [1, 1.5, 2, 2.5] as const;

export function ImageLightboxModal({
  activeImage,
  onClose,
}: {
  activeImage: LightboxImage;
  onClose: () => void;
}) {
  const { locale, isRtl } = useLocale();
  const lbCopy = LIGHTBOX_COPY[locale] ?? LIGHTBOX_COPY.en;
  const [zoomIndex, setZoomIndex] = useState(0);
  const [viewSide, setViewSide] = useState<"primary" | "secondary">(
    activeImage.initialView === "secondary" && activeImage.secondarySrc
      ? "secondary"
      : "primary",
  );

  useEffect(() => {
    setZoomIndex(0);
    setViewSide(
      activeImage.initialView === "secondary" && activeImage.secondarySrc
        ? "secondary"
        : "primary",
    );
  }, [activeImage]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      } else if (event.key === "+" || event.key === "=") {
        setZoomIndex((idx) => Math.min(idx + 1, ZOOM_STEPS.length - 1));
      } else if (event.key === "-") {
        setZoomIndex((idx) => Math.max(idx - 1, 0));
      } else if (event.key === "0") {
        setZoomIndex(0);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const currentZoom = ZOOM_STEPS[zoomIndex] ?? 1;
  const isZoomed = currentZoom > 1;
  const isPdf = activeImage.mimeType === "application/pdf";
  const isUnsupportedBinary = Boolean(
    activeImage.mimeType && !activeImage.mimeType.startsWith("image/") && !isPdf,
  );
  const displayedSrc =
    viewSide === "secondary" && activeImage.secondarySrc
      ? activeImage.secondarySrc
      : activeImage.src;
  const displayedAlt =
    viewSide === "secondary" && activeImage.secondaryAlt
      ? activeImage.secondaryAlt
      : activeImage.alt;
  const hasInspectorPanel = Boolean(
    (activeImage.specs && activeImage.specs.length > 0) ||
      activeImage.actionHref,
  );

  return (
    <div
      dir={isRtl ? "rtl" : "ltr"}
      role="dialog"
      aria-modal="true"
      aria-label={`Image preview: ${activeImage.title ?? activeImage.alt}`}
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#0F243E]/75 p-3 backdrop-blur-xs sm:p-6"
      onClick={onClose}
    >
      <div
        className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-[#D7E4F2] bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E8F1FA] px-4 py-3 sm:px-5">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate font-editorial text-sm font-bold text-[#0F243E] sm:text-base">
                <bdi dir="auto">{activeImage.title ?? activeImage.alt}</bdi>
              </h2>
              {activeImage.badge ? (
                <span className="rounded-full border border-[#B2E5DC] bg-[#E6F7F4] px-2.5 py-0.5 text-[11px] font-semibold text-[#0A6E5E]">
                  {activeImage.badge}
                </span>
              ) : null}
            </div>
            {activeImage.subtitle ? (
              <p className="truncate text-xs text-[#556E89]">
                {activeImage.subtitle}
              </p>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {activeImage.secondarySrc ? (
              <div
                role="group"
                aria-label="Inspect photo angle"
                className="me-1 inline-flex rounded-xl border border-[#CBDDF0] bg-[#F3F8FD] p-0.5"
              >
                <button
                  type="button"
                  onClick={() => {
                    setViewSide("primary");
                    setZoomIndex(0);
                  }}
                  className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors ${
                    viewSide === "primary"
                      ? "bg-white text-[#0052A3] shadow-xs"
                      : "text-[#556E89] hover:text-[#0F243E]"
                  }`}
                >
                  {activeImage.primaryLabel ?? "Profile"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setViewSide("secondary");
                    setZoomIndex(0);
                  }}
                  className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors ${
                    viewSide === "secondary"
                      ? "bg-white text-[#0052A3] shadow-xs"
                      : "text-[#556E89] hover:text-[#0F243E]"
                  }`}
                >
                  {activeImage.secondaryLabel ?? "Facility / Vehicle"}
                </button>
              </div>
            ) : null}

            {!isPdf && !isUnsupportedBinary ? (
              <>
                <button
                  type="button"
                  onClick={() => setZoomIndex((idx) => Math.max(idx - 1, 0))}
                  disabled={zoomIndex === 0}
                  aria-label="Zoom out image"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[#CBDDF0] bg-[#F8FBFE] text-[#2F4661] hover:bg-white disabled:opacity-40"
                >
                  <ZoomOut className="h-4 w-4" aria-hidden="true" />
                </button>
                <span
                  aria-live="polite"
                  className="min-w-[3.25rem] text-center font-mono-tabular text-xs font-bold text-[#0F243E]"
                >
                  {Math.round(currentZoom * 100)}%
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setZoomIndex((idx) =>
                      Math.min(idx + 1, ZOOM_STEPS.length - 1),
                    )
                  }
                  disabled={zoomIndex >= ZOOM_STEPS.length - 1}
                  aria-label="Zoom in image"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[#CBDDF0] bg-[#F8FBFE] text-[#2F4661] hover:bg-white disabled:opacity-40"
                >
                  <ZoomIn className="h-4 w-4" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => setZoomIndex(0)}
                  disabled={zoomIndex === 0}
                  aria-label="Reset image zoom"
                  className="inline-flex h-9 items-center gap-1 rounded-xl border border-[#CBDDF0] bg-[#F8FBFE] px-2.5 text-xs font-semibold text-[#2F4661] hover:bg-white disabled:opacity-40"
                >
                  <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                  <span className="hidden sm:inline">{lbCopy.reset}</span>
                </button>
              </>
            ) : null}

            {activeImage.downloadUrl ? (
              <a
                href={activeImage.downloadUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-9 items-center gap-1 rounded-xl border border-[#CBDDF0] bg-[#F8FBFE] px-2.5 text-xs font-semibold text-[#0F243E] hover:border-[#0066CC] hover:text-[#0066CC]"
              >
                <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{lbCopy.open}</span>
              </a>
            ) : null}

            <button
              type="button"
              onClick={onClose}
              aria-label="Close image preview"
              className="ms-0.5 inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[#CBDDF0] bg-white text-[#2F4661] hover:bg-[#F3F8FD]"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>

        <div
          className={
            hasInspectorPanel
              ? "grid min-h-[300px] flex-1 overflow-auto lg:grid-cols-[minmax(0,1fr)_280px]"
              : "flex min-h-[300px] flex-1 overflow-auto"
          }
        >
          <div className="flex flex-1 flex-col items-center justify-center overflow-auto bg-[#F3F8FD] p-4 sm:p-6">
            {isPdf ? (
              <iframe
                title={`PDF Preview ${activeImage.title ?? activeImage.alt}`}
                src={activeImage.downloadUrl ?? displayedSrc}
                className="h-[66vh] w-full rounded-xl border border-[#D7E4F2] bg-white"
              />
            ) : isUnsupportedBinary ? (
              <div className="flex flex-col items-center gap-3 rounded-2xl border border-[#D7E4F2] bg-white p-8 text-center">
                <FileText
                  className="h-10 w-10 text-[#0066CC]"
                  aria-hidden="true"
                />
                <p className="text-sm font-semibold text-[#0F243E]">
                  {lbCopy.docTitle}
                </p>
                <p className="max-w-sm text-xs text-[#556E89]">
                  {lbCopy.docHint}
                </p>
                {activeImage.downloadUrl ? (
                  <a
                    href={activeImage.downloadUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-xl bg-[#0066CC] px-4 py-2 text-xs font-semibold text-white hover:bg-[#0052A3]"
                  >
                    {lbCopy.downloadDoc}
                  </a>
                ) : null}
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setZoomIndex((idx) => (idx === 0 ? 2 : 0))}
                aria-label={
                  isZoomed ? "Click to reset image fit" : "Click to zoom 200%"
                }
                className={`block focus:outline-none ${
                  isZoomed ? "cursor-zoom-out" : "cursor-zoom-in"
                }`}
              >
                <img
                  src={displayedSrc}
                  alt={displayedAlt}
                  style={
                    isZoomed
                      ? {
                          width: `${Math.round(currentZoom * 420)}px`,
                          maxWidth: "none",
                        }
                      : undefined
                  }
                  className={
                    isZoomed
                      ? "h-auto rounded-xl border border-[#D7E4F2] bg-white p-1.5 shadow-xl"
                      : "max-h-[66vh] w-auto max-w-full rounded-xl border border-[#D7E4F2] bg-white object-contain p-1.5 shadow-lg"
                  }
                />
              </button>
            )}
          </div>

          {hasInspectorPanel ? (
            <aside className="flex flex-col justify-between border-t border-[#E8F1FA] bg-white p-4 lg:border-s lg:border-t-0">
              <div className="space-y-3">
                {activeImage.secondarySrc ? (
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setViewSide("primary");
                        setZoomIndex(0);
                      }}
                      className={`overflow-hidden rounded-xl border p-1 text-left transition-colors ${
                        viewSide === "primary"
                          ? "border-[#0066CC] bg-[#EBF4FF]/60"
                          : "border-[#D7E4F2] bg-white hover:border-[#93C5FD]"
                      }`}
                    >
                      <img
                        src={activeImage.src}
                        alt={activeImage.alt}
                        className="aspect-[4/3] w-full rounded-lg bg-[#F8FBFE] object-contain p-0.5"
                      />
                      <span className="mt-1 block truncate text-[11px] font-semibold text-[#2F4661]">
                        {activeImage.primaryLabel ?? "Profile"}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setViewSide("secondary");
                        setZoomIndex(0);
                      }}
                      className={`overflow-hidden rounded-xl border p-1 text-left transition-colors ${
                        viewSide === "secondary"
                          ? "border-[#0066CC] bg-[#EBF4FF]/60"
                          : "border-[#D7E4F2] bg-white hover:border-[#93C5FD]"
                      }`}
                    >
                      <img
                        src={activeImage.secondarySrc}
                        alt={
                          activeImage.secondaryAlt ??
                          activeImage.secondaryLabel ??
                          "Facility photo"
                        }
                        className="aspect-[4/3] w-full rounded-lg bg-[#F8FBFE] object-contain p-0.5"
                      />
                      <span className="mt-1 block truncate text-[11px] font-semibold text-[#2F4661]">
                        {activeImage.secondaryLabel ?? "Location"}
                      </span>
                    </button>
                  </div>
                ) : null}

                {activeImage.specs && activeImage.specs.length > 0 ? (
                  <dl className="divide-y divide-[#EDF4FB] rounded-xl border border-[#D7E4F2] bg-[#F8FBFE]">
                    {activeImage.specs.map((spec) => (
                      <div key={spec.label} className="px-3 py-2">
                        <dt className="text-[10px] font-bold uppercase tracking-wider text-[#556E89]">
                          {spec.label}
                        </dt>
                        <dd className="mt-0.5 text-xs font-semibold text-[#0F243E]">
                          <bdi dir="auto">{spec.value}</bdi>
                        </dd>
                      </div>
                    ))}
                  </dl>
                ) : null}
              </div>

              {activeImage.actionHref && activeImage.actionLabel ? (
                <Link
                  href={activeImage.actionHref}
                  onClick={onClose}
                  className="mt-4 inline-flex min-h-[40px] w-full items-center justify-center rounded-xl bg-[#0066CC] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#0052A3]"
                >
                  {activeImage.actionLabel}
                </Link>
              ) : null}
            </aside>
          ) : null}
        </div>

        <div className="flex items-center justify-between border-t border-[#E8F1FA] bg-[#F8FBFE] px-4 py-2 text-[11px] text-[#556E89] sm:px-5">
          <span>{lbCopy.zoomHint}</span>
          <span>{lbCopy.escHint}</span>
        </div>
      </div>
    </div>
  );
}
