"use client";

import { useState, type FormEvent } from "react";
import {
  ALLOWED_AVATAR_MIME_TYPES,
  ALLOWED_CERTIFICATION_MIME_TYPES,
  CertificationMimeTypeSchema,
  MAX_MEDIA_UPLOAD_BYTES,
  type AuthenticatedUser,
  type UserMediaCategory,
  type UserMediaDocument,
} from "@medisync/contracts";
import { CheckCircle2, Eye, Trash2, Upload } from "lucide-react";
import {
  FileUploadDropzone,
  deleteMyUserMedia,
  inferUploadMimeType,
  uploadUserMediaEndToEnd,
} from "@/features/media-certifications";
import { useLocale } from "@/shared/i18n/locale-store";
import { useImageLightbox } from "@/shared/ui/ImageLightboxProvider";
import { UiBadge, UiButton } from "@/shared/ui/primitives";
import { TactilePillGroup } from "@/shared/ui/TactileControls";
import {
  getCredentialCategoryLabel,
  getReviewStatusLabel,
  PORTAL_COPY,
} from "../portal-i18n";

export async function uploadAvatarPhotoFile(params: {
  apiBaseUrl: string;
  token: string;
  user: AuthenticatedUser;
  file: File;
  invalidMimeMessage: string;
  uploadFailedMessage: (err: string) => string;
  onProgress: (pct: number | null) => void;
}): Promise<
  | { ok: true; user: AuthenticatedUser }
  | { ok: false; errorText: string }
> {
  const mime = inferUploadMimeType(params.file, ALLOWED_AVATAR_MIME_TYPES);
  if (!mime) {
    return { ok: false, errorText: params.invalidMimeMessage };
  }

  params.onProgress(10);
  const res = await uploadUserMediaEndToEnd({
    apiBaseUrl: params.apiBaseUrl,
    token: params.token,
    category: "AVATAR",
    file: params.file,
    mimeType: CertificationMimeTypeSchema.parse(mime),
    onProgress: (pct) => params.onProgress(pct),
  });
  params.onProgress(null);

  if (!res.ok) {
    return { ok: false, errorText: params.uploadFailedMessage(res.error) };
  }

  return {
    ok: true,
    user: {
      ...params.user,
      avatarUrl:
        res.confirmed.avatarUrl ?? res.confirmed.document.downloadUrl ?? null,
    },
  };
}

function getAllowedCategoriesForRole(
  role: AuthenticatedUser["role"],
): readonly UserMediaCategory[] {
  if (role === "DRIVER") {
    return [
      "DRIVER_LICENSE",
      "VEHICLE_INSPECTION",
      "INSURANCE_CERTIFICATE",
      "NATIONAL_ID",
    ];
  }
  if (role === "DOCTOR" || role === "NURSE") {
    return [
      "PRACTITIONER_LICENSE",
      "MEDICAL_DEGREE",
      "BOARD_CERTIFICATION",
      "MALPRACTICE_POLICY",
      "NATIONAL_ID",
    ];
  }
  if (role === "PHARMACIST") {
    return [
      "PRACTITIONER_LICENSE",
      "BOARD_CERTIFICATION",
      "NATIONAL_ID",
    ];
  }
  if (role === "LAB_TECH") {
    return [
      "PRACTITIONER_LICENSE",
      "BOARD_CERTIFICATION",
      "NATIONAL_ID",
    ];
  }
  return [
    "PRACTITIONER_LICENSE",
    "MEDICAL_DEGREE",
    "BOARD_CERTIFICATION",
    "DRIVER_LICENSE",
    "VEHICLE_INSPECTION",
    "NATIONAL_ID",
  ];
}

interface ProfileCredentialsPanelProps {
  apiBaseUrl: string;
  token: string;
  userRole: AuthenticatedUser["role"];
  documents: readonly UserMediaDocument[];
  busy: boolean;
  onBusyChange: (busy: boolean) => void;
  onDocumentsUpdated: () => Promise<void>;
  onFeedback: (tone: "success" | "error" | "info", text: string) => void;
}

/** Shared credential document upload form + uploaded verification document list with reviewer notes & removal. */
export function ProfileCredentialsPanel({
  apiBaseUrl,
  token,
  userRole,
  documents,
  busy,
  onBusyChange,
  onDocumentsUpdated,
  onFeedback,
}: ProfileCredentialsPanelProps) {
  const { locale, t } = useLocale();
  const copy = PORTAL_COPY[locale];
  const msg = copy.messages;
  const { openImage } = useImageLightbox();

  const categoryChoices = getAllowedCategoriesForRole(userRole);
  const [credCategory, setCredCategory] = useState<UserMediaCategory>(() =>
    categoryChoices[0] ?? "PRACTITIONER_LICENSE",
  );
  const [credFile, setCredFile] = useState<File | null>(null);
  const [credProgress, setCredProgress] = useState<number | null>(null);

  const visibleDocuments = documents.filter((doc) => doc.category !== "AVATAR");

  async function handleCredentialUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!credFile) return;

    const mime = inferUploadMimeType(credFile, ALLOWED_CERTIFICATION_MIME_TYPES);
    if (!mime) {
      onFeedback("error", msg.invalidCredMime);
      return;
    }

    onBusyChange(true);
    setCredProgress(10);
    const res = await uploadUserMediaEndToEnd({
      apiBaseUrl,
      token,
      category: credCategory,
      file: credFile,
      mimeType: CertificationMimeTypeSchema.parse(mime),
      onProgress: (pct) => setCredProgress(pct),
    });
    onBusyChange(false);
    setCredProgress(null);

    if (!res.ok) {
      onFeedback("error", msg.credUploadFailed(res.error));
      return;
    }

    setCredFile(null);
    await onDocumentsUpdated();
    onFeedback(
      "success",
      msg.credUploaded(
        res.confirmed.document.fileName,
        getCredentialCategoryLabel(copy, res.confirmed.document.category),
      ),
    );
  }

  async function handleDeleteDocument(doc: UserMediaDocument) {
    onBusyChange(true);
    const res = await deleteMyUserMedia(apiBaseUrl, token, doc.id);
    onBusyChange(false);
    if (!res.ok) {
      onFeedback("error", res.error);
      return;
    }
    await onDocumentsUpdated();
    onFeedback(
      "info",
      locale === "fr"
        ? `Document supprimé : ${doc.fileName}`
        : locale === "ar"
          ? `تم حذف الوثيقة: ${doc.fileName}`
          : `Removed document: ${doc.fileName}`,
    );
  }

  return (
    <div className="space-y-3">
      <form
        onSubmit={(e) => void handleCredentialUpload(e)}
        className="space-y-2.5 border-t border-slate-100 pt-3"
      >
        <div className="space-y-2">
          <p className="text-xs font-semibold text-[#0F243E]">
            {copy.aside.verifyPersonalCredentialsLabel}
          </p>
          <TactilePillGroup
            id="user-cred-category"
            ariaLabel={copy.aside.verifyPersonalCredentialsLabel}
            size="sm"
            value={credCategory}
            onChange={(next) => setCredCategory(next)}
            options={categoryChoices.map((cat) => {
              const existing = visibleDocuments.find((d) => d.category === cat);
              return {
                value: cat,
                label: getCredentialCategoryLabel(copy, cat),
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
          id="user-cred-file"
          label={
            userRole === "DRIVER"
              ? locale === "fr"
                ? "Permis de conduire ou carte grise"
                : locale === "ar"
                  ? "رخصة السياقة أو وثيقة المركبة"
                  : "Driver License or Vehicle Papers"
              : userRole === "PHARMACIST"
                ? locale === "fr"
                  ? "Licence d'officine ou attestation d'Ordre"
                  : locale === "ar"
                    ? "رخصة الصيدلة أو شهادة الهيئة"
                    : "Pharmacy License or Council Permit"
                : userRole === "LAB_TECH"
                  ? locale === "fr"
                    ? "Accréditation laboratoire (ISO 15189)"
                    : locale === "ar"
                      ? "اعتماد المختبر الطبي"
                      : "Lab Accreditation or Permit"
                  : copy.aside.credScanLabel
          }
          hint={
            userRole === "DRIVER"
              ? locale === "fr"
                ? "Téléversez votre permis, visite technique ou attestation d'assurance"
                : locale === "ar"
                  ? "ارفع رخصة السياقة أو الفحص التقني أو التأمين"
                  : "Upload driver license, vehicle inspection, or fleet insurance"
              : userRole === "PHARMACIST"
                ? locale === "fr"
                  ? "Téléversez votre autorisation d'exercice ou agrément d'officine"
                  : locale === "ar"
                    ? "ارفع رخصة الصيدلي أو تصريح الصيدلية"
                    : "Upload pharmacy council license or dispensing permit"
                : userRole === "LAB_TECH"
                  ? locale === "fr"
                    ? "Téléversez votre diplôme de biologie ou certificat d'accréditation"
                    : locale === "ar"
                      ? "ارفع شهادة المختبر أو اعتماد التحاليل"
                      : "Upload laboratory certification or accreditation document"
                  : copy.aside.credScanHint
          }
          accept={ALLOWED_CERTIFICATION_MIME_TYPES.join(",")}
          maxBytes={MAX_MEDIA_UPLOAD_BYTES}
          selectedFile={credFile}
          progressPercent={credProgress}
          disabled={busy}
          onFileSelected={setCredFile}
        />

        <div className="flex justify-end">
          <UiButton
            type="submit"
            variant="obsidian"
            size="md"
            disabled={busy || !credFile}
            className="w-full sm:w-auto"
          >
            <Upload className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{t("portal.uploadCredential")}</span>
          </UiButton>
        </div>
      </form>

      {visibleDocuments.length > 0 ? (
        <ul className="space-y-2 border-t border-[#D7E4F2] pt-3">
          {visibleDocuments.slice(0, 10).map((doc) => {
            const statusTone =
              doc.reviewStatus === "APPROVED"
                ? "emerald"
                : doc.reviewStatus === "REJECTED"
                  ? "red"
                  : "amber";
            return (
              <li
                key={doc.id}
                className="flex flex-col gap-1.5 rounded-xl border border-[#D7E4F2] bg-[#F3F8FD] px-3.5 py-2.5 text-xs"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-slate-900">
                      <bdi dir="auto">{doc.fileName}</bdi>
                    </p>
                    <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                      <span className="font-mono-tabular text-[11px] text-slate-500">
                        {getCredentialCategoryLabel(copy, doc.category)}
                      </span>
                      <UiBadge tone={statusTone}>
                        {getReviewStatusLabel(copy, doc.reviewStatus)}
                      </UiBadge>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() =>
                        openImage({
                          src: doc.downloadUrl,
                          downloadUrl: doc.downloadUrl,
                          mimeType: doc.mimeType,
                          alt: doc.fileName,
                          title: doc.fileName,
                          subtitle: `${getCredentialCategoryLabel(copy, doc.category)} · ${getReviewStatusLabel(copy, doc.reviewStatus)}`,
                          badge: getReviewStatusLabel(copy, doc.reviewStatus),
                        })
                      }
                      className="inline-flex h-8 items-center gap-1 rounded-xl bg-[#F3F8FD] border border-[#D7E4F2] px-2.5 text-[11px] font-semibold text-slate-700 hover:text-[#0066CC]"
                    >
                      <Eye className="h-3 w-3" aria-hidden="true" />
                      <span>{copy.aside.viewBtn}</span>
                    </button>
                    {doc.reviewStatus !== "APPROVED" ? (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void handleDeleteDocument(doc)}
                        aria-label={`Delete ${doc.fileName}`}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-rose-50 text-rose-700 transition hover:bg-rose-100 disabled:opacity-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    ) : null}
                  </div>
                </div>
                {doc.reviewerNote ? (
                  <p className="rounded-lg bg-slate-50 px-2.5 py-1.5 text-[11px] text-slate-600">
                    {doc.reviewerNote}
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
