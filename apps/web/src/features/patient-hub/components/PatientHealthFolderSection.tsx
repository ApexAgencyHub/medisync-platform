"use client";

import type {
  AuthResponse,
  ClinicalMediaObjectSummary,
  LabOrderSummary,
  LocaleCode,
  PrescriptionSummary,
  VisitNoteSummary,
} from "@medisync/contracts";
import { FileText, FlaskConical, Lock } from "lucide-react";
import { formatClinicalFileType } from "@/shared/i18n/human-labels";
import { useImageLightbox } from "@/shared/ui/ImageLightboxProvider";
import { QrPrescriptionCard } from "@/shared/ui/QrPrescriptionCard";
import { UiBadge, UiButton, UiLinkButton } from "@/shared/ui/primitives";
import { formatPlainLabStatus, type PatientUiCopy } from "../patient-copy";

interface PatientHealthFolderSectionProps {
  copy: PatientUiCopy;
  locale: LocaleCode;
  session: AuthResponse | null;
  apiOnline: boolean;
  loading: boolean;
  prescriptions: readonly PrescriptionSummary[];
  mediaFiles: readonly ClinicalMediaObjectSummary[];
  visitNotes: readonly VisitNoteSummary[];
  labOrders: readonly LabOrderSummary[];
}

/** Private Health Folder explaining what unlocks on sign-in with visual previews and plain-language labels. */
export function PatientHealthFolderSection({
  copy,
  locale,
  session,
  apiOnline,
  loading,
  prescriptions,
  mediaFiles,
  visitNotes,
  labOrders,
}: PatientHealthFolderSectionProps) {
  const { openImage } = useImageLightbox();

  return (
    <section
      id="patient-folder"
      className="space-y-4 rounded-2xl bg-slate-50 p-5 ring-1 ring-slate-900/[0.06] sm:p-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-2 pb-1">
        <div className="flex items-start gap-3">
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-[#0066CC] shadow-[0_1px_3px_rgba(15,23,42,0.05)] ring-1 ring-slate-900/[0.05]">
            <FileText className="h-4 w-4" aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-base font-bold text-slate-950">
              {copy.healthFolderTitle}
            </h2>
            <p className="text-xs text-slate-600">{copy.healthFolderSubtitle}</p>
          </div>
        </div>

        {session ? (
          <UiBadge tone="emerald">
            {copy.signedInBadgePrefix}{" "}
            <bdi dir="auto">{session.user.fullName}</bdi>
          </UiBadge>
        ) : (
          <UiBadge tone="slate">{copy.lockedBadge}</UiBadge>
        )}
      </div>

      {!session ? (
        <div className="space-y-4 rounded-2xl bg-white p-5 ring-1 ring-slate-900/[0.06]">
          <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
            <div className="flex items-start gap-3">
              <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-[#0066CC]">
                <Lock className="h-4 w-4" aria-hidden="true" />
              </span>
              <div className="space-y-0.5">
                <p className="text-sm font-bold text-slate-900">
                  {copy.lockedHeading}
                </p>
                <p className="max-w-2xl text-xs leading-relaxed text-slate-600">
                  {copy.lockedDescription}
                </p>
              </div>
            </div>

            <UiLinkButton href="/portal" size="sm" className="shrink-0 rounded-xl px-4">
              {copy.lockedUnlockCta}
            </UiLinkButton>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            {copy.lockedPreviews.map((preview) => (
              <div
                key={preview.title}
                className="flex items-center gap-3 rounded-xl border border-slate-200/90 bg-white p-3"
              >
                <img
                  src={preview.imageSrc}
                  alt={preview.imageAlt}
                  className="h-12 w-12 shrink-0 rounded-xl border border-slate-200 bg-slate-50 object-contain p-1"
                />
                <div className="min-w-0 space-y-0.5">
                  <p className="text-xs font-bold text-slate-900">
                    {preview.title}
                  </p>
                  <p className="text-[11px] leading-snug text-slate-600">
                    {preview.detail}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : !apiOnline ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50/70 p-3 text-xs font-medium text-amber-950">
          {copy.apiOfflineText}
        </p>
      ) : loading ? (
        <p className="text-xs font-medium text-slate-600">
          {copy.loadingRecordsText}
        </p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-3">
            <div className="space-y-0.5">
              <h3 className="text-xs font-bold text-slate-900">
                {copy.rxHeading}{" "}
                <span dir="ltr" className="font-mono-tabular text-slate-500">
                  ({prescriptions.length})
                </span>
              </h3>
              <p className="text-[11px] text-slate-500">{copy.rxHint}</p>
            </div>

            {prescriptions.length === 0 ? (
              <p className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                {copy.rxEmpty}
              </p>
            ) : (
              <div className="space-y-2">
                {prescriptions.map((rx) => (
                  <QrPrescriptionCard key={rx.id} prescription={rx} />
                ))}
              </div>
            )}

            <h3 className="pt-1 text-xs font-bold text-slate-900">
              {copy.scansHeading}{" "}
              <span dir="ltr" className="font-mono-tabular text-slate-500">
                ({mediaFiles.length})
              </span>
            </h3>
            {mediaFiles.length === 0 ? (
              <p className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                {copy.scansEmpty}
              </p>
            ) : (
              <ul className="space-y-2">
                {mediaFiles.map((file) => (
                  <li
                    key={file.id}
                    className="flex items-center justify-between gap-2.5 rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-bold text-slate-900">
                        <bdi dir="auto">{file.fileName}</bdi>
                      </p>
                      <p className="text-slate-600">
                        {formatClinicalFileType(file.mimeType, locale)} ·{" "}
                        <span dir="ltr" className="font-mono-tabular">
                          {file.createdAtIso.slice(0, 10)}
                        </span>
                      </p>
                    </div>
                    {file.downloadUrl && file.mimeType.startsWith("image/") ? (
                      <UiButton
                        size="sm"
                        variant="secondary"
                        onClick={() =>
                          openImage({
                            src: file.downloadUrl!,
                            downloadUrl: file.downloadUrl,
                            mimeType: file.mimeType,
                            alt: file.fileName,
                            title: file.fileName,
                            subtitle: formatClinicalFileType(file.mimeType, locale),
                          })
                        }
                      >
                        {copy.inspectPhotoLabel}
                      </UiButton>
                    ) : file.downloadUrl ? (
                      <a
                        href={file.downloadUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex h-8 items-center rounded-xl bg-white px-3 text-xs font-semibold text-slate-800 shadow-2xs hover:text-[#0066CC]"
                      >
                        {copy.openDocumentLabel}
                      </a>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="space-y-3">
            <h3 className="text-xs font-bold text-slate-900">
              {copy.notesHeading}{" "}
              <span dir="ltr" className="font-mono-tabular text-slate-500">
                ({visitNotes.length})
              </span>
            </h3>
            {visitNotes.length === 0 ? (
              <p className="rounded-xl border border-[#D7E4F2] bg-[#F3F8FD] p-3 text-xs text-slate-600 ">
                {copy.notesEmpty}
              </p>
            ) : (
              <ul className="space-y-2">
                {visitNotes.map((note) => (
                  <li
                    key={note.id}
                    className="rounded-xl border border-[#D7E4F2] bg-[#F3F8FD] p-3.5 text-xs "
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-slate-950">
                        <bdi dir="auto">{note.doctorName}</bdi>{" "}
                        {note.icd10Codes.length > 0 ? (
                          <span
                            dir="ltr"
                            className="font-mono-tabular font-normal text-[#0066CC]"
                          >
                            ({note.icd10Codes.join(", ")})
                          </span>
                        ) : null}
                      </span>
                      <span
                        dir="ltr"
                        className="font-mono-tabular text-[11px] text-slate-500"
                      >
                        {note.createdAtIso.slice(0, 10)}
                      </span>
                    </div>
                    <p className="mt-1 text-slate-700">
                      <strong className="font-semibold text-slate-900">
                        {copy.noteFoundLabel}
                      </strong>{" "}
                      <bdi dir="auto">{note.assessment}</bdi>
                    </p>
                    <p className="mt-1 text-slate-600">
                      <strong className="font-semibold text-slate-900">
                        {copy.noteNextStepsLabel}
                      </strong>{" "}
                      <bdi dir="auto">{note.plan}</bdi>
                    </p>
                  </li>
                ))}
              </ul>
            )}

            <h3 className="pt-1 text-xs font-bold text-slate-900">
              {copy.labsHeading}{" "}
              <span dir="ltr" className="font-mono-tabular text-slate-500">
                ({labOrders.length})
              </span>
            </h3>
            {labOrders.length === 0 ? (
              <p className="rounded-xl border border-[#D7E4F2] bg-[#F3F8FD] p-3 text-xs text-slate-600 ">
                {copy.labsEmpty}
              </p>
            ) : (
              <ul className="space-y-2">
                {labOrders.map((lab) => (
                  <li
                    key={lab.id}
                    className="flex items-center justify-between gap-2 rounded-xl border border-[#D7E4F2] bg-[#F3F8FD] p-3 text-xs "
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <FlaskConical
                        className="h-4 w-4 shrink-0 text-[#0066CC]"
                        aria-hidden="true"
                      />
                      <div className="min-w-0">
                        <p className="truncate font-bold text-slate-900">
                          <bdi dir="auto">{lab.panelName}</bdi>
                        </p>
                        <p className="truncate text-slate-600">
                          <span dir="ltr" className="font-mono-tabular">
                            {lab.createdAtIso.slice(0, 10)}
                          </span>
                        </p>
                      </div>
                    </div>
                    <UiBadge tone="teal">
                      {formatPlainLabStatus(lab.status, locale)}
                    </UiBadge>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
