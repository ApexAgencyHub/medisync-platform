"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Check, Copy, QrCode } from "lucide-react";
import type { PrescriptionSummary } from "@medisync/contracts";

interface QrPrescriptionCardProps {
  prescription: PrescriptionSummary;
  onUseForDispense?: (qrToken: string) => void;
}

export function QrPrescriptionCard({
  prescription,
  onUseForDispense,
}: QrPrescriptionCardProps) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let active = true;
    QRCode.toDataURL(prescription.qrToken, {
      errorCorrectionLevel: "M",
      margin: 1,
      width: 168,
      color: {
        dark: "#0f172a",
        light: "#ffffff",
      },
    })
      .then((url) => {
        if (active) setQrDataUrl(url);
      })
      .catch(() => {
        if (active) setQrDataUrl(null);
      });

    return () => {
      active = false;
    };
  }, [prescription.qrToken]);

  async function handleCopy() {
    if (typeof navigator === "undefined" || !navigator.clipboard) return;
    await navigator.clipboard.writeText(prescription.qrToken).catch(() => undefined);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  return (
    <article className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3.5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3.5">
        <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-white p-1.5">
          {qrDataUrl ? (
            <img
              src={qrDataUrl}
              alt={`Cryptographic Rx QR for ${prescription.patientName}`}
              className="h-full w-full object-contain"
            />
          ) : (
            <QrCode className="h-8 w-8 text-slate-400" aria-hidden="true" />
          )}
        </div>

        <div className="min-w-0 space-y-1 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-bold text-slate-900">
              {prescription.patientName}
            </span>
            <span
              className={`rounded-full border px-2 py-0.5 font-mono-tabular text-[10px] font-bold ${
                prescription.status === "ISSUED"
                  ? "border-teal-200 bg-teal-50 text-teal-900"
                  : prescription.status === "DISPENSED"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                    : "border-slate-200 bg-white text-slate-600"
              }`}
            >
              {prescription.status}
            </span>
          </div>
          <p className="text-slate-700">
            {prescription.medications
              .map((m) => `${m.name} (${m.dosage}, ${m.durationDays}d)`)
              .join(" · ")}
          </p>
          <p className="text-[11px] text-slate-500">
            Issued by {prescription.doctorName} · HMAC-SHA256 Signed
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 sm:flex-col sm:items-end">
        <button
          type="button"
          onClick={() => void handleCopy()}
          className="inline-flex min-h-[34px] items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:border-teal-700 hover:text-teal-800"
        >
          {copied ? (
            <Check className="h-3.5 w-3.5 text-emerald-700" aria-hidden="true" />
          ) : (
            <Copy className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          <span>{copied ? "Copied Token" : "Copy QR Token"}</span>
        </button>

        {onUseForDispense && prescription.status === "ISSUED" ? (
          <button
            type="button"
            onClick={() => onUseForDispense(prescription.qrToken)}
            className="inline-flex min-h-[34px] items-center rounded-lg bg-teal-800 px-3 py-1 text-[11px] font-semibold text-white hover:bg-teal-900"
          >
            Load at Pharmacy
          </button>
        ) : null}
      </div>
    </article>
  );
}
