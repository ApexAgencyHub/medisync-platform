"use client";

import { useEffect, useState } from "react";
import {
  ExternalLink,
  FileText,
  RotateCcw,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";

export interface PreviewableMediaItem {
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  downloadUrl: string;
  subtitle?: string;
}

interface MediaPreviewModalProps {
  item: PreviewableMediaItem | null;
  onClose: () => void;
}

const ZOOM_STEPS = [1, 1.5, 2, 2.5] as const;

export function MediaPreviewModal({ item, onClose }: MediaPreviewModalProps) {
  const [zoomIndex, setZoomIndex] = useState(0);

  useEffect(() => {
    setZoomIndex(0);
  }, [item]);

  useEffect(() => {
    if (!item) return;
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
  }, [item, onClose]);

  if (!item) return null;

  const isImage = item.mimeType.startsWith("image/");
  const isPdf = item.mimeType === "application/pdf";
  const currentZoom = ZOOM_STEPS[zoomIndex] ?? 1;
  const isZoomed = currentZoom > 1;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Preview ${item.fileName}`}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-3 backdrop-blur-xs sm:p-5"
      onClick={onClose}
    >
      <div
        className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-3.5">
          <div className="min-w-0">
            <h3 className="truncate text-sm font-bold text-slate-900">
              <bdi dir="auto">{item.fileName}</bdi>
            </h3>
            <p className="font-mono-tabular text-xs text-slate-500">
              {(item.sizeBytes / 1024).toFixed(1)} KB
              {item.subtitle ? ` · ${item.subtitle}` : ""}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            {isImage ? (
              <>
                <button
                  type="button"
                  onClick={() => setZoomIndex((idx) => Math.max(idx - 1, 0))}
                  disabled={zoomIndex === 0}
                  aria-label="Zoom out clinical image"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 disabled:opacity-40"
                >
                  <ZoomOut className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
                <span className="min-w-[3rem] text-center font-mono-tabular text-xs font-semibold text-slate-700">
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
                  aria-label="Zoom in clinical image"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 disabled:opacity-40"
                >
                  <ZoomIn className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => setZoomIndex(0)}
                  disabled={zoomIndex === 0}
                  aria-label="Reset clinical image zoom"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 disabled:opacity-40"
                >
                  <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </>
            ) : null}

            <a
              href={item.downloadUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-[34px] items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-800 hover:border-teal-700 hover:text-teal-900"
            >
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Open</span>
            </a>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close preview"
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className="flex min-h-[300px] flex-1 items-center justify-center overflow-auto bg-slate-100 p-4">
          {isImage ? (
            <button
              type="button"
              onClick={() => setZoomIndex((idx) => (idx === 0 ? 2 : 0))}
              aria-label={isZoomed ? "Reset clinical image fit" : "Zoom clinical image"}
              className={`block focus:outline-none ${
                isZoomed ? "cursor-zoom-out" : "cursor-zoom-in"
              }`}
            >
              <img
                src={item.downloadUrl}
                alt={item.fileName}
                style={
                  isZoomed
                    ? { width: `${Math.round(currentZoom * 420)}px`, maxWidth: "none" }
                    : undefined
                }
                className={
                  isZoomed
                    ? "h-auto rounded-lg border border-slate-200 bg-white shadow-xs"
                    : "max-h-[70vh] w-auto max-w-full rounded-lg border border-slate-200 bg-white object-contain shadow-xs"
                }
              />
            </button>
          ) : isPdf ? (
            <iframe
              title={`PDF Preview ${item.fileName}`}
              src={item.downloadUrl}
              className="h-[68vh] w-full rounded-lg border border-slate-200 bg-white"
            />
          ) : (
            <div className="flex flex-col items-center gap-3 rounded-xl border border-slate-200 bg-white p-8 text-center">
              <FileText className="h-10 w-10 text-teal-800" aria-hidden="true" />
              <p className="text-sm font-semibold text-slate-900">
                Diagnostic Scan File
              </p>
              <p className="max-w-sm text-xs text-slate-600">
                This diagnostic file is securely stored. Open or download the
                file to view it in your medical workstation.
              </p>
              <a
                href={item.downloadUrl}
                target="_blank"
                rel="noreferrer"
                className="rounded-lg bg-teal-800 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-900"
              >
                Download Medical File
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
