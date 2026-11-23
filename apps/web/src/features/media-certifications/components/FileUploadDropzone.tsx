"use client";

import { useId, useRef, useState, type DragEvent } from "react";
import { FileText, ImageIcon, UploadCloud, X } from "lucide-react";

interface FileUploadDropzoneProps {
  id?: string;
  label: string;
  hint: string;
  accept: string;
  maxBytes: number;
  selectedFile: File | null;
  progressPercent?: number | null;
  disabled?: boolean;
  onFileSelected: (file: File | null) => void;
}

export function formatByteSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function matchesAcceptRule(file: File, accept: string): boolean {
  const tokens = accept
    .split(",")
    .map((token) => token.trim().toLowerCase())
    .filter(Boolean);
  if (tokens.length === 0 || tokens.includes("*/*")) {
    return true;
  }

  const fileType = file.type.toLowerCase();
  const fileName = file.name.toLowerCase();

  return tokens.some((token) => {
    if (token.startsWith(".")) {
      return fileName.endsWith(token);
    }
    if (token.endsWith("/*")) {
      const prefix = token.slice(0, -1);
      return fileType.startsWith(prefix);
    }
    return fileType === token;
  });
}

export function FileUploadDropzone({
  id,
  label,
  hint,
  accept,
  maxBytes,
  selectedFile,
  progressPercent,
  disabled = false,
  onFileSelected,
}: FileUploadDropzoneProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const inputRef = useRef<HTMLInputElement | null>(null);
  const dragDepthRef = useRef(0);
  const [dragActive, setDragActive] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const isImage = selectedFile?.type.startsWith("image/") ?? false;
  const clampedProgress =
    typeof progressPercent === "number"
      ? Math.max(0, Math.min(100, Math.round(progressPercent)))
      : null;

  function resetInputValue() {
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }

  function handleFiles(fileList: FileList | null) {
    const file = fileList?.[0] ?? null;
    if (!file) {
      setValidationError(null);
      onFileSelected(null);
      return;
    }

    if (file.size === 0) {
      resetInputValue();
      setValidationError("Selected file is empty.");
      return;
    }

    if (file.size > maxBytes) {
      resetInputValue();
      setValidationError(
        `File exceeds maximum size of ${formatByteSize(maxBytes)}.`,
      );
      return;
    }

    if (!matchesAcceptRule(file, accept)) {
      resetInputValue();
      setValidationError(`Unsupported file type for "${file.name}".`);
      return;
    }

    setValidationError(null);
    onFileSelected(file);
  }

  function handleDragEnter(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    if (disabled) return;
    dragDepthRef.current += 1;
    setDragActive(true);
  }

  function handleDragLeave(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) {
      setDragActive(false);
    }
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
    dragDepthRef.current = 0;
    setDragActive(false);
    if (disabled) return;
    handleFiles(event.dataTransfer.files);
  }

  return (
    <div className="space-y-1.5">
      <label
        htmlFor={inputId}
        className="block text-xs font-semibold uppercase tracking-wider text-slate-700"
      >
        {label}
      </label>

      <div
        onDragEnter={handleDragEnter}
        onDragOver={(e) => {
          e.preventDefault();
        }}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`rounded-xl border-2 border-dashed p-3.5 transition-colors ${
          dragActive
            ? "border-teal-700 bg-teal-50/80"
            : validationError
              ? "border-red-300 bg-red-50/40"
              : "border-slate-300 bg-slate-50/70 hover:border-teal-700/60"
        } ${disabled ? "cursor-not-allowed opacity-60" : ""}`}
      >
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept={accept}
          disabled={disabled}
          onChange={(e) => handleFiles(e.target.files)}
          className="sr-only"
        />

        {selectedFile ? (
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2.5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-teal-200 bg-teal-50 text-teal-800">
                {isImage ? (
                  <ImageIcon className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <FileText className="h-4 w-4" aria-hidden="true" />
                )}
              </div>
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold text-slate-900">
                  <bdi dir="auto">{selectedFile.name}</bdi>
                </p>
                <p className="font-mono-tabular text-[11px] text-slate-600">
                  {selectedFile.type || "binary"} ·{" "}
                  {formatByteSize(selectedFile.size)}
                </p>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-1.5">
              <button
                type="button"
                disabled={disabled}
                onClick={() => inputRef.current?.click()}
                className="min-h-[32px] rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:border-teal-700 hover:text-teal-800 active:scale-95"
              >
                Replace
              </button>
              <button
                type="button"
                disabled={disabled}
                aria-label={`Remove ${selectedFile.name}`}
                onClick={() => {
                  resetInputValue();
                  setValidationError(null);
                  onFileSelected(null);
                }}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:border-red-300 hover:text-red-700 active:scale-95"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center gap-2 py-2 text-center sm:flex-row sm:justify-between sm:text-start">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-teal-800 shadow-2xs">
                <UploadCloud className="h-4 w-4" aria-hidden="true" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-800">{hint}</p>
                <p className="font-mono-tabular text-[11px] text-slate-500">
                  Max {formatByteSize(maxBytes)} · Direct encrypted clinical upload
                </p>
              </div>
            </div>

            <button
              type="button"
              disabled={disabled}
              onClick={() => inputRef.current?.click()}
              className="min-h-[36px] shrink-0 rounded-lg border border-teal-800 bg-white px-3 py-1.5 text-xs font-semibold text-teal-900 transition-colors hover:bg-teal-50 active:scale-95"
            >
              Choose File
            </button>
          </div>
        )}

        {validationError ? (
          <p
            role="alert"
            className="mt-2 text-xs font-medium text-red-700"
          >
            {validationError}
          </p>
        ) : null}

        {clampedProgress !== null ? (
          <div className="mt-2.5 space-y-1">
            <div className="flex justify-between font-mono-tabular text-[11px] font-semibold text-teal-900">
              <span>Uploading securely...</span>
              <span>{clampedProgress}%</span>
            </div>
            <div
              role="progressbar"
              aria-label="Upload progress"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={clampedProgress}
              className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200"
            >
              <div
                className="h-full rounded-full bg-teal-700 transition-all"
                style={{ width: `${Math.max(4, clampedProgress)}%` }}
              />
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
