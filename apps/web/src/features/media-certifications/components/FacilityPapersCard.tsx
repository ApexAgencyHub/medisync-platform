"use client";

import { useState, type FormEvent } from "react";
import {
  ALLOWED_AVATAR_MIME_TYPES,
  ALLOWED_CERTIFICATION_MIME_TYPES,
  CertificationMimeTypeSchema,
  MAX_MEDIA_UPLOAD_BYTES,
  type FacilityMediaCategory,
  type FacilityMediaDocument,
  type FacilityKind,
  type LocaleCode,
} from "@medisync/contracts";
import { Building2, CheckCircle2, Eye, FileText, Upload } from "lucide-react";
import { useLocale } from "@/shared/i18n/locale-store";
import { useImageLightbox } from "@/shared/ui/ImageLightboxProvider";
import { UiBadge, UiButton } from "@/shared/ui/primitives";
import {
  MoroccanComplianceBadge,
  TactilePillGroup,
} from "@/shared/ui/TactileControls";
import {
  inferUploadMimeType,
  uploadFacilityMediaEndToEnd,
} from "../api-client";
import { FileUploadDropzone, formatByteSize } from "./FileUploadDropzone";

const CATEGORY_LABELS: Record<
  FacilityMediaCategory,
  Record<LocaleCode, string>
> = {
  PHARMACY_PERMIT: {
    en: "Pharmacy Opening Permit",
    fr: "Autorisation d'Ouverture Officine",
    ar: "رخصة فتح واستغلال الصيدلية",
  },
  MINISTRY_LICENSE: {
    en: "Ministry Health License",
    fr: "Agrément Ministère de la Santé",
    ar: "الترخيص الوزاري للصحة",
  },
  HYGIENE_INSPECTION: {
    en: "Hygiene & Cold-Chain Inspection",
    fr: "Contrôle Hygiène & Chaîne du Froid",
    ar: "شهادة النظافة وسلسلة التبريد",
  },
  ACCREDITATION: {
    en: "Clinical Accreditation",
    fr: "Accréditation Clinique",
    ar: "الاعتماد الطبي والمؤسساتي",
  },
  LAB_ISO_CERT: {
    en: "ISO / Lab Quality Certificate",
    fr: "Certificat Qualité Labo / ISO",
    ar: "شهادة جودة المختبر ISO",
  },
  FIRE_SAFETY_CERT: {
    en: "Safety & Fire Compliance",
    fr: "Conformité Sécurité & Incendie",
    ar: "شهادة السلامة والوقاية",
  },
  FACILITY_PHOTO: {
    en: "Premises Exterior / Interior Photo",
    fr: "Photo Établissement / Officine",
    ar: "صورة مقر المؤسسة",
  },
};

const REVIEW_LABELS: Record<
  FacilityMediaDocument["reviewStatus"],
  Record<LocaleCode, string>
> = {
  PENDING_REVIEW: {
    en: "Pending Review",
    fr: "En révision",
    ar: "قيد المراجعة",
  },
  APPROVED: { en: "Approved", fr: "Approuvé", ar: "مقبول" },
  REJECTED: { en: "Rejected", fr: "Refusé", ar: "مرفوض" },
};

const CARD_COPY: Record<
  LocaleCode,
  {
    title: string;
    subtitle: string;
    categoryLabel: string;
    fileLabel: string;
    fileHint: string;
    uploadBtn: string;
    emptyText: string;
    viewBtn: string;
    noLinkedFacility: string;
    invalidMime: string;
    uploadedOk: (name: string) => string;
  }
> = {
  en: {
    title: "Facility Permits & Compliance Papers",
    subtitle:
      "Upload operating permits, ministry authorizations, hygiene inspections, and premises photos reviewed by Administration.",
    categoryLabel: "Document Type",
    fileLabel: "Compliance File (PDF / Image)",
    fileHint: "Max 15 MB",
    uploadBtn: "Upload Facility Document",
    emptyText: "No facility documents uploaded yet.",
    viewBtn: "Preview",
    noLinkedFacility:
      "Link a clinic, hospital, or pharmacy facility to your account to upload premises compliance documents.",
    invalidMime: "Select a valid PDF, PNG, JPEG, or WebP document.",
    uploadedOk: (name) => `Uploaded facility paper: ${name}`,
  },
  fr: {
    title: "Agréments & Dossier Établissement",
    subtitle:
      "Déposez l'autorisation d'ouverture, l'agrément ministériel, le contrôle d'hygiène et les photos pour validation Admin.",
    categoryLabel: "Type de justificatif",
    fileLabel: "Document officiel (PDF / Image)",
    fileHint: "Max 15 Mo",
    uploadBtn: "Déposer le justificatif",
    emptyText: "Aucun document d'établissement déposé pour le moment.",
    viewBtn: "Aperçu",
    noLinkedFacility:
      "Rattachez un établissement à votre compte pour gérer ses agréments et licences.",
    invalidMime: "Sélectionnez un fichier PDF, PNG, JPEG ou WebP valide.",
    uploadedOk: (name) => `Document déposé : ${name}`,
  },
  ar: {
    title: "تراخيص ووثائق المؤسسة",
    subtitle:
      "ارفع رخصة الفتح، الترخيص الوزاري، شهادات السلامة والنظافة، وصور المقر لمصادقة الإدارة.",
    categoryLabel: "نوع الوثيقة",
    fileLabel: "ملف الترخيص (PDF أو صورة)",
    fileHint: "حد أقصى 15 ميجابايت",
    uploadBtn: "رفع وثيقة المؤسسة",
    emptyText: "لم يتم رفع أي وثائق للمؤسسة بعد.",
    viewBtn: "معاينة",
    noLinkedFacility:
      "قم بربط حسابك بمصحة أو صيدلية أو مختبر لإدارة وثائق الترخيص.",
    invalidMime: "يرجى اختيار ملف PDF أو صورة PNG/JPEG/WebP صالحة.",
    uploadedOk: (name) => `تم رفع وثيقة المؤسسة: ${name}`,
  },
};

function getCategoriesForFacilityKind(
  kind?: FacilityKind,
): readonly FacilityMediaCategory[] {
  if (kind === "PHARMACY") {
    return [
      "PHARMACY_PERMIT",
      "MINISTRY_LICENSE",
      "HYGIENE_INSPECTION",
      "ACCREDITATION",
      "FIRE_SAFETY_CERT",
      "FACILITY_PHOTO",
    ];
  }
  if (kind === "DIAGNOSTIC_LAB") {
    return [
      "LAB_ISO_CERT",
      "MINISTRY_LICENSE",
      "HYGIENE_INSPECTION",
      "ACCREDITATION",
      "FACILITY_PHOTO",
    ];
  }
  return [
    "MINISTRY_LICENSE",
    "ACCREDITATION",
    "HYGIENE_INSPECTION",
    "FIRE_SAFETY_CERT",
    "FACILITY_PHOTO",
  ];
}

interface FacilityPapersCardProps {
  apiBaseUrl: string;
  token: string;
  facilityId: string | null;
  facilityName?: string | null;
  facilityKind?: FacilityKind;
  documents: readonly FacilityMediaDocument[];
  busy: boolean;
  onBusyChange: (busy: boolean) => void;
  onDocumentsUpdated: () => Promise<void>;
  onFeedback: (tone: "success" | "error" | "info", text: string) => void;
}

/** Shared facility permit & compliance document manager used on Pharmacy, Clinical & Pro portals. */
export function FacilityPapersCard({
  apiBaseUrl,
  token,
  facilityId,
  facilityName,
  facilityKind,
  documents,
  busy,
  onBusyChange,
  onDocumentsUpdated,
  onFeedback,
}: FacilityPapersCardProps) {
  const { locale } = useLocale();
  const c = CARD_COPY[locale];
  const { openImage } = useImageLightbox();
  const categoryOptions = getCategoriesForFacilityKind(facilityKind);
  const [category, setCategory] = useState<FacilityMediaCategory>(
    categoryOptions[0] ?? "MINISTRY_LICENSE",
  );
  const activeCategory: FacilityMediaCategory = categoryOptions.includes(category)
    ? category
    : (categoryOptions[0] ?? "MINISTRY_LICENSE");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [progress, setProgress] = useState<number | null>(null);

  if (!facilityId) {
    return (
      <section className="rounded-2xl border border-[#D7E4F2] bg-white p-5 text-xs text-slate-600">
        <div className="flex items-center gap-2 font-bold text-slate-900">
          <Building2 className="h-4 w-4 text-[#0066CC]" aria-hidden="true" />
          <span>{c.title}</span>
        </div>
        <p className="mt-2">{c.noLinkedFacility}</p>
      </section>
    );
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!facilityId || !selectedFile) return;

    const allowedMimes =
      activeCategory === "FACILITY_PHOTO"
        ? ALLOWED_AVATAR_MIME_TYPES
        : ALLOWED_CERTIFICATION_MIME_TYPES;
    const mime = inferUploadMimeType(selectedFile, allowedMimes);
    if (!mime) {
      onFeedback("error", c.invalidMime);
      return;
    }

    onBusyChange(true);
    setProgress(10);
    const res = await uploadFacilityMediaEndToEnd({
      apiBaseUrl,
      token,
      facilityId,
      category: activeCategory,
      file: selectedFile,
      mimeType: CertificationMimeTypeSchema.parse(mime),
      onProgress: setProgress,
    });
    onBusyChange(false);
    setProgress(null);

    if (!res.ok) {
      onFeedback("error", res.error);
      return;
    }

    setSelectedFile(null);
    await onDocumentsUpdated();
    onFeedback("success", c.uploadedOk(res.confirmed.document.fileName));
  }

  const complianceDomain =
    facilityKind === "PHARMACY"
      ? "pharmacy"
      : facilityKind === "DIAGNOSTIC_LAB"
        ? "lab"
        : "hospital";

  return (
    <section className="space-y-4 rounded-2xl border border-[#D7E4F2] bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#D7E4F2] pb-3.5">
        <h3 className="flex items-center gap-2 text-sm font-bold text-[#0F243E]">
          <Building2 className="h-4 w-4 text-[#0066CC]" aria-hidden="true" />
          <span>
            {c.title}
            {facilityName ? ` · ${facilityName}` : ""}
          </span>
        </h3>
        <MoroccanComplianceBadge domain={complianceDomain} locale={locale} />
      </div>

      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-3">
        <div className="space-y-2">
          <p className="text-xs font-semibold text-[#0F243E]">
            {c.categoryLabel}
          </p>
          <TactilePillGroup
            id="facility-paper-category"
            ariaLabel={c.categoryLabel}
            size="sm"
            value={activeCategory}
            onChange={(next) => setCategory(next)}
            options={categoryOptions.map((cat) => {
              const existing = documents.find((d) => d.category === cat);
              return {
                value: cat,
                label: CATEGORY_LABELS[cat][locale],
                icon:
                  existing?.reviewStatus === "APPROVED" ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-[#0F9D88]" aria-hidden="true" />
                  ) : undefined,
                badge: existing
                  ? existing.reviewStatus === "APPROVED"
                    ? "OK"
                    : "·"
                  : undefined,
              };
            })}
          />
        </div>

        <FileUploadDropzone
          id="facility-paper-file"
          label={c.fileLabel}
          hint={c.fileHint}
          accept={ALLOWED_CERTIFICATION_MIME_TYPES.join(",")}
          maxBytes={MAX_MEDIA_UPLOAD_BYTES}
          selectedFile={selectedFile}
          progressPercent={progress}
          disabled={busy}
          onFileSelected={setSelectedFile}
        />

        <div className="flex justify-end">
          <UiButton
            type="submit"
            variant="obsidian"
            size="md"
            disabled={busy || !selectedFile}
            className="w-full sm:w-auto"
          >
            <Upload className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{c.uploadBtn}</span>
          </UiButton>
        </div>
      </form>

      {documents.length === 0 ? (
        <p className="rounded-lg border border-[#D7E4F2] bg-[#F3F8FD] p-4 text-center text-xs text-slate-500">
          {c.emptyText}
        </p>
      ) : (
        <ul className="space-y-2">
          {documents.map((doc) => {
            const tone =
              doc.reviewStatus === "APPROVED"
                ? "emerald"
                : doc.reviewStatus === "REJECTED"
                  ? "red"
                  : "amber";
            return (
              <li
                key={doc.id}
                className="space-y-1.5 rounded-xl border border-[#D7E4F2] bg-[#F3F8FD] p-3.5 text-xs"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <FileText
                      className="h-4 w-4 shrink-0 text-[#0066CC]"
                      aria-hidden="true"
                    />
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-[#0F243E]">
                        <bdi dir="auto">{doc.fileName}</bdi>
                      </p>
                      <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                        <span className="text-[11px] text-slate-500">
                          {CATEGORY_LABELS[doc.category][locale]} ·{" "}
                          {formatByteSize(doc.sizeBytes)}
                        </span>
                        <UiBadge tone={tone}>
                          {REVIEW_LABELS[doc.reviewStatus][locale]}
                        </UiBadge>
                      </div>
                    </div>
                  </div>
                  {doc.uploadStatus === "UPLOADED" ? (
                    <button
                      type="button"
                      onClick={() =>
                        openImage({
                          src: doc.downloadUrl,
                          downloadUrl: doc.downloadUrl,
                          mimeType: doc.mimeType,
                          alt: doc.fileName,
                          title: doc.fileName,
                          subtitle: `${doc.facilityName} · ${CATEGORY_LABELS[doc.category][locale]}`,
                          badge: REVIEW_LABELS[doc.reviewStatus][locale],
                        })
                      }
                      className="inline-flex h-8 items-center gap-1 rounded-lg border border-[#CBDDF0] bg-white px-3 text-[11px] font-semibold text-slate-700 hover:text-[#0066CC]"
                    >
                      <Eye className="h-3 w-3" aria-hidden="true" />
                      <span>{c.viewBtn}</span>
                    </button>
                  ) : null}
                </div>
                {doc.reviewerNote ? (
                  <p className="rounded-lg border border-[#D7E4F2] bg-white px-2.5 py-1.5 text-[11px] text-slate-600">
                    {doc.reviewerNote}
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
