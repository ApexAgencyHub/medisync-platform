"use client";

import Link from "next/link";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  ExternalLink,
  FileText,
  RotateCcw,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";

export interface LightboxSpecItem {
  label: string;
  value: string;
}

export interface LightboxImage {
  src: string;
  alt: string;
  title?: string;
  subtitle?: string;
  primaryLabel?: string;
  secondarySrc?: string;
  secondaryAlt?: string;
  secondaryLabel?: string;
  initialView?: "primary" | "secondary";
  mimeType?: string;
  downloadUrl?: string;
  badge?: string;
  specs?: readonly LightboxSpecItem[];
  actionHref?: string;
  actionLabel?: string;
}

interface ImageLightboxContextValue {
  openImage: (image: LightboxImage) => void;
  closeImage: () => void;
}

const ZOOM_STEPS = [1, 1.5, 2, 2.5] as const;

const ImageLightboxContext = createContext<ImageLightboxContextValue>({
  openImage: () => undefined,
  closeImage: () => undefined,
});

export function useImageLightbox(): ImageLightboxContextValue {
  return useContext(ImageLightboxContext);
}

/** Provides a global split inspection & zoom modal for clinical profiles, workplaces, vehicles, products, and documents. */
export function ImageLightboxProvider({ children }: { children: ReactNode }) {
  const [activeImage, setActiveImage] = useState<LightboxImage | null>(null);
  const [zoomIndex, setZoomIndex] = useState(0);
  const [viewSide, setViewSide] = useState<"primary" | "secondary">("primary");

  const openImage = useCallback((image: LightboxImage) => {
    setZoomIndex(0);
    setViewSide(
      image.initialView === "secondary" && image.secondarySrc
        ? "secondary"
        : "primary",
    );
    setActiveImage(image);
  }, []);

  const closeImage = useCallback(() => {
    setActiveImage(null);
    setZoomIndex(0);
    setViewSide("primary");
  }, []);

  useEffect(() => {
    if (!activeImage) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeImage();
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
  }, [activeImage, closeImage]);

  const currentZoom = ZOOM_STEPS[zoomIndex] ?? 1;
  const isZoomed = currentZoom > 1;
  const isPdf = activeImage?.mimeType === "application/pdf";
  const isUnsupportedBinary = Boolean(
    activeImage?.mimeType &&
      !activeImage.mimeType.startsWith("image/") &&
      !isPdf,
  );
  const displayedSrc =
    viewSide === "secondary" && activeImage?.secondarySrc
      ? activeImage.secondarySrc
      : activeImage?.src ?? "";
  const displayedAlt =
    viewSide === "secondary" && activeImage?.secondaryAlt
      ? activeImage.secondaryAlt
      : activeImage?.alt ?? "";
  const hasInspectorPanel = Boolean(
    activeImage &&
      ((activeImage.specs && activeImage.specs.length > 0) ||
        activeImage.actionHref),
  );

  return (
    <ImageLightboxContext.Provider value={{ openImage, closeImage }}>
      {children}

      {activeImage ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Image preview: ${activeImage.title ?? activeImage.alt}`}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-3 backdrop-blur-xs sm:p-6"
          onClick={closeImage}
        >
          <div
            className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 sm:px-5">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="truncate text-sm font-bold text-slate-900 sm:text-base">
                    <bdi dir="auto">{activeImage.title ?? activeImage.alt}</bdi>
                  </h2>
                  {activeImage.badge ? (
                    <span className="rounded-full border border-teal-200 bg-teal-50 px-2 py-0.5 text-[11px] font-semibold text-teal-900">
                      {activeImage.badge}
                    </span>
                  ) : null}
                </div>
                {activeImage.subtitle ? (
                  <p className="truncate text-xs text-slate-600">
                    {activeImage.subtitle}
                  </p>
                ) : null}
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                {activeImage.secondarySrc ? (
                  <div
                    role="group"
                    aria-label="Inspect photo angle"
                    className="me-1 inline-flex rounded-lg border border-slate-200 bg-slate-100 p-0.5"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setViewSide("primary");
                        setZoomIndex(0);
                      }}
                      className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-colors ${
                        viewSide === "primary"
                          ? "bg-white text-teal-900 shadow-xs"
                          : "text-slate-600 hover:text-slate-900"
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
                      className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-colors ${
                        viewSide === "secondary"
                          ? "bg-white text-teal-900 shadow-xs"
                          : "text-slate-600 hover:text-slate-900"
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
                      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 disabled:opacity-40"
                    >
                      <ZoomOut className="h-4 w-4" aria-hidden="true" />
                    </button>
                    <span
                      aria-live="polite"
                      className="min-w-[3.25rem] text-center font-mono-tabular text-xs font-bold text-slate-800"
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
                      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 disabled:opacity-40"
                    >
                      <ZoomIn className="h-4 w-4" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setZoomIndex(0)}
                      disabled={zoomIndex === 0}
                      aria-label="Reset image zoom"
                      className="inline-flex h-9 items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-40"
                    >
                      <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                      <span className="hidden sm:inline">Reset</span>
                    </button>
                  </>
                ) : null}

                {activeImage.downloadUrl ? (
                  <a
                    href={activeImage.downloadUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-9 items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-xs font-semibold text-slate-800 hover:border-teal-700 hover:text-teal-900"
                  >
                    <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Open</span>
                  </a>
                ) : null}

                <button
                  type="button"
                  onClick={closeImage}
                  aria-label="Close image preview"
                  className="ms-0.5 inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
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
              <div className="flex flex-1 flex-col items-center justify-center overflow-auto bg-slate-100 p-4 sm:p-6">
                {isPdf ? (
                  <iframe
                    title={`PDF Preview ${activeImage.title ?? activeImage.alt}`}
                    src={activeImage.downloadUrl ?? displayedSrc}
                    className="h-[66vh] w-full rounded-xl border border-slate-200 bg-white"
                  />
                ) : isUnsupportedBinary ? (
                  <div className="flex flex-col items-center gap-3 rounded-xl border border-slate-200 bg-white p-8 text-center">
                    <FileText
                      className="h-10 w-10 text-teal-800"
                      aria-hidden="true"
                    />
                    <p className="text-sm font-semibold text-slate-900">
                      Certified Medical Document
                    </p>
                    <p className="max-w-sm text-xs text-slate-600">
                      Open or download this document to inspect it in your clinical viewer.
                    </p>
                    {activeImage.downloadUrl ? (
                      <a
                        href={activeImage.downloadUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-lg bg-teal-800 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-900"
                      >
                        Download Document
                      </a>
                    ) : null}
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setZoomIndex((idx) => (idx === 0 ? 2 : 0))}
                    aria-label={
                      isZoomed
                        ? "Click to reset image fit"
                        : "Click to zoom 200%"
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
                          ? "h-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl"
                          : "max-h-[66vh] w-auto max-w-full rounded-xl border border-slate-200 bg-white object-contain p-1.5 shadow-lg"
                      }
                    />
                  </button>
                )}
              </div>

              {hasInspectorPanel && activeImage ? (
                <aside className="flex flex-col justify-between border-t border-slate-200 bg-white p-4 lg:border-s lg:border-t-0">
                  <div className="space-y-3">
                    {activeImage.secondarySrc ? (
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setViewSide("primary");
                            setZoomIndex(0);
                          }}
                          className={`overflow-hidden rounded-lg border p-1 text-left transition-colors ${
                            viewSide === "primary"
                              ? "border-teal-700 bg-teal-50/40"
                              : "border-slate-200 bg-white hover:border-slate-300"
                          }`}
                        >
                          <img
                            src={activeImage.src}
                            alt={activeImage.alt}
                            className="h-16 w-full rounded object-cover"
                          />
                          <span className="mt-1 block truncate text-[10px] font-semibold text-slate-700">
                            {activeImage.primaryLabel ?? "Profile"}
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setViewSide("secondary");
                            setZoomIndex(0);
                          }}
                          className={`overflow-hidden rounded-lg border p-1 text-left transition-colors ${
                            viewSide === "secondary"
                              ? "border-teal-700 bg-teal-50/40"
                              : "border-slate-200 bg-white hover:border-slate-300"
                          }`}
                        >
                          <img
                            src={activeImage.secondarySrc}
                            alt={
                              activeImage.secondaryAlt ??
                              activeImage.secondaryLabel ??
                              "Facility photo"
                            }
                            className="h-16 w-full rounded object-cover"
                          />
                          <span className="mt-1 block truncate text-[10px] font-semibold text-slate-700">
                            {activeImage.secondaryLabel ?? "Location"}
                          </span>
                        </button>
                      </div>
                    ) : null}

                    {activeImage.specs && activeImage.specs.length > 0 ? (
                      <dl className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-slate-50/70">
                        {activeImage.specs.map((spec) => (
                          <div key={spec.label} className="px-3 py-2">
                            <dt className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                              {spec.label}
                            </dt>
                            <dd className="mt-0.5 text-xs font-semibold text-slate-900">
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
                      onClick={closeImage}
                      className="mt-4 inline-flex min-h-[40px] w-full items-center justify-center rounded-lg bg-teal-800 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-teal-900"
                    >
                      {activeImage.actionLabel}
                    </Link>
                  ) : null}
                </aside>
              ) : null}
            </div>

            <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-4 py-2 text-[11px] text-slate-600 sm:px-5">
              <span>Click photo or use + / - controls to zoom up to 250%</span>
              <span>Press Esc to close</span>
            </div>
          </div>
        </div>
      ) : null}
    </ImageLightboxContext.Provider>
  );
}
