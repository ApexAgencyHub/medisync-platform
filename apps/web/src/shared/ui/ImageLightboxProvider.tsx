"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { RotateCcw, X, ZoomIn, ZoomOut } from "lucide-react";

export interface LightboxImage {
  src: string;
  alt: string;
  title?: string;
  subtitle?: string;
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

/** Provides a global accessible lightbox with step zoom and overview controls. */
export function ImageLightboxProvider({ children }: { children: ReactNode }) {
  const [activeImage, setActiveImage] = useState<LightboxImage | null>(null);
  const [zoomIndex, setZoomIndex] = useState(0);

  const openImage = useCallback((image: LightboxImage) => {
    setZoomIndex(0);
    setActiveImage(image);
  }, []);

  const closeImage = useCallback(() => {
    setActiveImage(null);
    setZoomIndex(0);
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
            className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 sm:px-5">
              <div className="min-w-0">
                <h2 className="truncate text-sm font-bold text-slate-900 sm:text-base">
                  {activeImage.title ?? activeImage.alt}
                </h2>
                {activeImage.subtitle ? (
                  <p className="truncate text-xs text-slate-600">
                    {activeImage.subtitle}
                  </p>
                ) : null}
              </div>

              <div className="flex shrink-0 items-center gap-1.5">
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
                  className="min-w-[3.5rem] text-center font-mono-tabular text-xs font-bold text-slate-800"
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
                <button
                  type="button"
                  onClick={closeImage}
                  aria-label="Close image preview"
                  className="ms-1 inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            </div>

            <div className="flex min-h-[280px] flex-1 items-center justify-center overflow-auto bg-slate-100 p-4 sm:p-6">
              <button
                type="button"
                onClick={() =>
                  setZoomIndex((idx) => (idx === 0 ? 2 : 0))
                }
                aria-label={
                  isZoomed ? "Click to reset image fit" : "Click to zoom 200%"
                }
                className={`block focus:outline-none ${
                  isZoomed ? "cursor-zoom-out" : "cursor-zoom-in"
                }`}
              >
                <img
                  src={activeImage.src}
                  alt={activeImage.alt}
                  style={
                    isZoomed
                      ? { width: `${Math.round(currentZoom * 420)}px`, maxWidth: "none" }
                      : undefined
                  }
                  className={
                    isZoomed
                      ? "h-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl"
                      : "max-h-[72vh] w-auto max-w-full rounded-xl border border-slate-200 bg-white object-contain p-1.5 shadow-lg"
                  }
                />
              </button>
            </div>

            <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-4 py-2 text-[11px] text-slate-600 sm:px-5">
              <span>Click image or use + / - controls to zoom and inspect</span>
              <span>Press Esc to close</span>
            </div>
          </div>
        </div>
      ) : null}
    </ImageLightboxContext.Provider>
  );
}
