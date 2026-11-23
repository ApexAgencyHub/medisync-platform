"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Copy, QrCode } from "lucide-react";
import type { PrescriptionSummary } from "@medisync/contracts";
import { useLocale } from "@/shared/i18n/locale-store";
import { useImageLightbox } from "./ImageLightboxProvider";
import { formatPractitionerDisplayName } from "./primitives";

const QR_DATA_URL_CACHE = new Map<string, string>();

interface QrPrescriptionCardProps {
  prescription: PrescriptionSummary;
  onUseForDispense?: (qrToken: string) => void;
}

const RX_COPY = {
  en: {
    issuedBy: "Issued by",
    verifiedSig: "Verified Digital Signature",
    copied: "Copied Code",
    copy: "Copy Code",
    verifyPharmacy: "Verify at Pharmacy",
    daysSuffix: "d",
    status: { ISSUED: "ISSUED", DISPENSED: "DISPENSED" },
  },
  fr: {
    issuedBy: "Prescrit par",
    verifiedSig: "Signature Numérique Vérifiée",
    copied: "Code copié",
    copy: "Copier le code",
    verifyPharmacy: "Vérifier en Pharmacie",
    daysSuffix: "j",
    status: { ISSUED: "ÉMISE", DISPENSED: "DÉLIVRÉE" },
  },
  ar: {
    issuedBy: "وصفة من عند",
    verifiedSig: "توقيع رقمي موثّق",
    copied: "تم النسخ",
    copy: "نسخ الرمز",
    verifyPharmacy: "التحقق فالصيدلية",
    daysSuffix: " يوم",
    status: { ISSUED: "صادرة", DISPENSED: "مصروفة" },
  },
} as const;

export function QrPrescriptionCard({
  prescription,
  onUseForDispense,
}: QrPrescriptionCardProps) {
  const { locale } = useLocale();
  const copy = RX_COPY[locale] ?? RX_COPY.en;
  const { openImage } = useImageLightbox();
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(
    () => QR_DATA_URL_CACHE.get(prescription.qrToken) ?? null,
  );
  const [copied, setCopied] = useState(false);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const cached = QR_DATA_URL_CACHE.get(prescription.qrToken);
    if (cached) {
      setQrDataUrl(cached);
      return;
    }
    let active = true;
    void import("qrcode")
      .then((mod) => {
        const qrApi = mod.default ?? mod;
        return qrApi.toDataURL(prescription.qrToken, {
          errorCorrectionLevel: "M",
          margin: 1,
          width: 168,
          color: {
            dark: "#0f172a",
            light: "#ffffff",
          },
        });
      })
      .then((url) => {
        if (QR_DATA_URL_CACHE.size >= 100) {
          const oldest = QR_DATA_URL_CACHE.keys().next().value;
          if (oldest) QR_DATA_URL_CACHE.delete(oldest);
        }
        QR_DATA_URL_CACHE.set(prescription.qrToken, url);
        if (active) setQrDataUrl(url);
      })
      .catch(() => {
        if (active) setQrDataUrl(null);
      });

    return () => {
      active = false;
    };
  }, [prescription.qrToken]);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    };
  }, []);

  async function handleCopy() {
    if (typeof navigator === "undefined" || !navigator.clipboard) return;
    await navigator.clipboard
      .writeText(prescription.qrToken)
      .catch(() => undefined);
    setCopied(true);
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    copyTimerRef.current = setTimeout(() => setCopied(false), 1800);
  }

  const statusLabel =
    prescription.status === "ISSUED"
      ? copy.status.ISSUED
      : prescription.status === "DISPENSED"
        ? copy.status.DISPENSED
        : prescription.status;

  return (
    <article className="flex flex-col gap-3 rounded-xl border border-[#D7E4F2] bg-[#F8FBFE] p-3.5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3.5">
        <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[#D7E4F2] bg-white p-1.5">
          {qrDataUrl ? (
            <button
              type="button"
              onClick={() =>
                openImage({
                  src: qrDataUrl,
                  alt: `Digital Prescription QR for ${prescription.patientName}`,
                  title: `Digital Prescription · ${prescription.patientName}`,
                  subtitle: `${copy.issuedBy} ${formatPractitionerDisplayName(prescription.doctorName)}`,
                })
              }
              aria-label={`Enlarge prescription QR for ${prescription.patientName}`}
              className="h-full w-full cursor-zoom-in rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-700"
            >
              <img
                src={qrDataUrl}
                alt={`Digital Prescription QR for ${prescription.patientName}`}
                className="h-full w-full object-contain"
              />
            </button>
          ) : (
            <QrCode className="h-8 w-8 text-slate-400" aria-hidden="true" />
          )}
        </div>

        <div className="min-w-0 space-y-1 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-bold text-slate-900">
              <bdi dir="auto">{prescription.patientName}</bdi>
            </span>
            <span
              className={`rounded-full px-2.5 py-0.5 font-mono-tabular text-[10px] font-bold ${
                prescription.status === "ISSUED"
                  ? "bg-emerald-50 text-emerald-800"
                  : prescription.status === "DISPENSED"
                    ? "bg-emerald-50 text-emerald-800"
                    : "bg-white text-slate-600"
              }`}
            >
              {statusLabel}
            </span>
          </div>
          <p className="text-slate-700">
            <bdi dir="auto">
              {prescription.medications
                .map(
                  (m) =>
                    `${m.name} (${m.dosage}, ${m.durationDays}${copy.daysSuffix})`,
                )
                .join(" · ")}
            </bdi>
          </p>
          <p className="text-[11px] text-slate-500">
            {copy.issuedBy}{" "}
            <bdi dir="auto">
              {formatPractitionerDisplayName(prescription.doctorName)}
            </bdi>{" "}
            · {copy.verifiedSig}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 sm:flex-col sm:items-end">
        <button
          type="button"
          onClick={() => void handleCopy()}
          className="inline-flex min-h-[34px] items-center gap-1 rounded-xl bg-white px-3 py-1 text-[11px] font-semibold text-slate-700 shadow-2xs hover:text-[#0066CC]"
        >
          {copied ? (
            <Check
              className="h-3.5 w-3.5 text-[#0066CC]"
              aria-hidden="true"
            />
          ) : (
            <Copy className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          <span>{copied ? copy.copied : copy.copy}</span>
        </button>

        {onUseForDispense && prescription.status === "ISSUED" ? (
          <button
            type="button"
            onClick={() => onUseForDispense(prescription.qrToken)}
            className="inline-flex min-h-[34px] items-center rounded-xl bg-[#0066CC] px-3.5 py-1 text-[11px] font-semibold text-white transition hover:bg-[#0052A3]"
          >
            {copy.verifyPharmacy}
          </button>
        ) : null}
      </div>
    </article>
  );
}
