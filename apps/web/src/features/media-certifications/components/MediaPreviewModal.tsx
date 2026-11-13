"use client";

import { useEffect } from "react";
import { ExternalLink, FileText, X } from "lucide-react";

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

export function MediaPreviewModal({ item, onClose }: MediaPreviewModalProps) {
  useEffect(() => {
    if (!item) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [item, onClose]);

  if (!item) return null;

  const isImage = item.mimeType.startsWith("image/");
  const isPdf = item.mimeType === "application/pdf";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Preview ${item.fileName}`}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-3.5">
          <div className="min-w-0">
            <h3 className="truncate text-sm font-bold text-slate-900">
              <bdi dir="auto">{item.fileName}</bdi>
            </h3>
            <p className="font-mono-tabular text-xs text-slate-500">
              {item.mimeType} · {(item.sizeBytes / 1024).toFixed(1)} KB
              {item.subtitle ? ` · ${item.subtitle}` : ""}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
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
            // Presigned MinIO GET URLs expire cleanly in 15m and load directly from S3/MinIO
            <img
              src={item.downloadUrl}
              alt={item.fileName}
              className="max-h-[70vh] w-auto rounded-lg border border-slate-200 bg-white object-contain shadow-xs"
            />
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
                Binary Diagnostic File ({item.mimeType})
              </p>
              <p className="max-w-sm text-xs text-slate-600">
                This clinical file is stored in object storage. Open or download the
                signed object to open it in a radiology viewer.
              </p>
              <a
                href={item.downloadUrl}
                target="_blank"
                rel="noreferrer"
                className="rounded-lg bg-teal-800 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-900"
              >
                Download Signed Object
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
