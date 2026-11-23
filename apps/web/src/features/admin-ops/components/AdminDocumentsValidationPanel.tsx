"use client";

import { useMemo, useState } from "react";
import {
  CheckCircle2,
  Eye,
  FileCheck2,
  FileText,
  Search,
  XCircle,
} from "lucide-react";
import type {
  AdminUserMediaItem,
  DocumentReviewStatus,
  FacilityMediaDocument,
  LocaleCode,
} from "@medisync/contracts";
import { formatByteSize } from "@/features/media-certifications";
import { formatRoleLabel } from "@/shared/i18n/human-labels";
import { useLocale } from "@/shared/i18n/locale-store";
import { useImageLightbox } from "@/shared/ui/ImageLightboxProvider";
import { UiBadge } from "@/shared/ui/primitives";
import { MoroccanComplianceBadge } from "@/shared/ui/TactileControls";

const REVIEW_NOTE_PRESETS: Record<LocaleCode, readonly string[]> = {
  en: [
    "CNOM / INPE verified",
    "Law 17-04 / Ministry permit verified",
    "Blurry scan — please re-upload",
    "Expired document",
  ],
  fr: [
    "CNOM / INPE vérifié",
    "Agrément Ministère / Loi 17-04 conforme",
    "Document flou — merci de re-déposer",
    "Pièce expirée",
  ],
  ar: [
    "تم التحقق من رقم الهيئة / INPE",
    "ترخيص الوزارة / قانون 17-04 مطابق",
    "صورة غير واضحة — يرجى إعادة الرفع",
    "وثيقة منتهية الصلاحية",
  ],
};

const DOCS_COPY: Record<
  LocaleCode,
  {
    heading: string;
    subtitle: string;
    searchPlaceholder: string;
    filterSourceAll: string;
    filterSourceUsers: string;
    filterSourceFacilities: string;
    filterPending: string;
    filterApproved: string;
    filterRejected: string;
    filterAllStatuses: string;
    emptyText: string;
    ownerUserBadge: string;
    ownerFacilityBadge: string;
    inspectBtn: string;
    approveBtn: string;
    rejectBtn: string;
    notePlaceholder: string;
    opsAdminOnlyHint: string;
  }
> = {
  en: {
    heading: "Centralized Files, Diplomas & Licenses Validation Queue",
    subtitle:
      "Inspect and approve or reject staff diplomas, medical licenses, driver permits, vehicle inspections, and facility certifications.",
    searchPlaceholder: "Filter by name, role, facility, email, or file...",
    filterSourceAll: "All Files",
    filterSourceUsers: "Staff & Driver Credentials",
    filterSourceFacilities: "Facility Licenses & Papers",
    filterPending: "Pending Review",
    filterApproved: "Approved",
    filterRejected: "Rejected",
    filterAllStatuses: "All Statuses",
    emptyText: "No compliance files match the current filters.",
    ownerUserBadge: "Staff / Practitioner",
    ownerFacilityBadge: "Facility",
    inspectBtn: "Inspect File",
    approveBtn: "Validate & Approve",
    rejectBtn: "Reject",
    notePlaceholder: "Validation note (optional reason for approval/rejection)",
    opsAdminOnlyHint: "Read-only preview · Ops Admin commits validation",
  },
  fr: {
    heading: "Validation Centralisée des Pièces, Diplômes & Agréments",
    subtitle:
      "Inspectez et validez les diplômes soignants, licences médicales, permis chauffeurs, officines et agréments d'établissements.",
    searchPlaceholder: "Filtrer par nom, rôle, clinique ou nom de fichier...",
    filterSourceAll: "Toutes les pièces",
    filterSourceUsers: "Justificatifs Soignants & Chauffeurs",
    filterSourceFacilities: "Dossiers Établissements",
    filterPending: "En attente",
    filterApproved: "Approuvés",
    filterRejected: "Refusés",
    filterAllStatuses: "Tous statuts",
    emptyText: "Aucun document ne correspond aux filtres sélectionnés.",
    ownerUserBadge: "Personnel / Praticien",
    ownerFacilityBadge: "Établissement",
    inspectBtn: "Examiner",
    approveBtn: "Valider",
    rejectBtn: "Refuser",
    notePlaceholder: "Note de conformité (motif optionnel)",
    opsAdminOnlyHint: "Lecture seule · Réservé à l'Ops Admin",
  },
  ar: {
    heading: "مركز التحقق والمصادقة على الوثائق والتراخيص",
    subtitle:
      "معاينة واعتماد أو رفض الشهادات الطبية، رخص الممرضين، رخص السائقين، وتراخيص المصحات والصيدليات.",
    searchPlaceholder: "ابحث بالاسم، المهنة، المؤسسة أو اسم الملف...",
    filterSourceAll: "جميع الوثائق",
    filterSourceUsers: "وثائق المهنيين والسائقين",
    filterSourceFacilities: "تراخيص المؤسسات",
    filterPending: "قيد المراجعة",
    filterApproved: "مقبولة",
    filterRejected: "مرفوضة",
    filterAllStatuses: "كل الحالات",
    emptyText: "لا توجد وثائق مطابقة للبحث الحالي.",
    ownerUserBadge: "حساب مهني",
    ownerFacilityBadge: "مؤسسة صحية",
    inspectBtn: "معاينة",
    approveBtn: "اعتماد",
    rejectBtn: "رفض",
    notePlaceholder: "ملاحظة المراجعة (اختياري لسبب القبول أو الرفض)",
    opsAdminOnlyHint: "عرض فقط · المصادقة محصورة بمدير العمليات",
  },
};

interface AdminDocumentsValidationPanelProps {
  userDocuments: readonly AdminUserMediaItem[];
  facilityDocuments: readonly FacilityMediaDocument[];
  isOpsAdmin: boolean;
  busy: boolean;
  onReviewUserDocument: (
    userId: string,
    mediaId: string,
    status: "APPROVED" | "REJECTED",
    note?: string,
  ) => Promise<void>;
  onReviewFacilityDocument: (
    mediaId: string,
    status: "APPROVED" | "REJECTED",
    note?: string,
  ) => Promise<void>;
}

/** Unified Admin compliance queue for inspecting & validating all worker and facility documents. */
export function AdminDocumentsValidationPanel({
  userDocuments,
  facilityDocuments,
  isOpsAdmin,
  busy,
  onReviewUserDocument,
  onReviewFacilityDocument,
}: AdminDocumentsValidationPanelProps) {
  const { locale } = useLocale();
  const c = DOCS_COPY[locale];
  const { openImage } = useImageLightbox();

  const [sourceFilter, setSourceFilter] = useState<"ALL" | "USER" | "FACILITY">(
    "ALL",
  );
  const [statusFilter, setStatusFilter] = useState<
    DocumentReviewStatus | "ALL"
  >("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});

  type UnifiedDoc =
    | {
        kind: "USER";
        id: string;
        ownerLabel: string;
        ownerMeta: string;
        countryCode: string;
        category: string;
        fileName: string;
        mimeType: string;
        sizeBytes: number;
        sha256Checksum: string | null | undefined;
        uploadStatus: string;
        reviewStatus: DocumentReviewStatus;
        reviewerNote: string | null;
        downloadUrl: string;
        createdAtIso: string;
        userId: string;
      }
    | {
        kind: "FACILITY";
        id: string;
        ownerLabel: string;
        ownerMeta: string;
        countryCode: string;
        category: string;
        fileName: string;
        mimeType: string;
        sizeBytes: number;
        sha256Checksum: string | null | undefined;
        uploadStatus: string;
        reviewStatus: DocumentReviewStatus;
        reviewerNote: string | null;
        downloadUrl: string;
        createdAtIso: string;
      };

  const mergedDocs = useMemo<UnifiedDoc[]>(() => {
    const items: UnifiedDoc[] = [
      ...userDocuments.map((doc) => ({
        kind: "USER" as const,
        id: doc.id,
        ownerLabel: doc.userName,
        ownerMeta: `${formatRoleLabel(doc.userRole, locale)} · ${doc.userEmail ?? doc.userId.slice(0, 8)}`,
        countryCode: doc.countryCode,
        category: doc.category,
        fileName: doc.fileName,
        mimeType: doc.mimeType,
        sizeBytes: doc.sizeBytes,
        sha256Checksum: doc.sha256Checksum,
        uploadStatus: doc.uploadStatus,
        reviewStatus: doc.reviewStatus,
        reviewerNote: doc.reviewerNote,
        downloadUrl: doc.downloadUrl,
        createdAtIso: doc.createdAtIso,
        userId: doc.userId,
      })),
      ...facilityDocuments.map((doc) => ({
        kind: "FACILITY" as const,
        id: doc.id,
        ownerLabel: doc.facilityName,
        ownerMeta: `${c.ownerFacilityBadge} · ${doc.countryCode}`,
        countryCode: doc.countryCode,
        category: doc.category,
        fileName: doc.fileName,
        mimeType: doc.mimeType,
        sizeBytes: doc.sizeBytes,
        sha256Checksum: doc.sha256Checksum,
        uploadStatus: doc.uploadStatus,
        reviewStatus: doc.reviewStatus,
        reviewerNote: doc.reviewerNote,
        downloadUrl: doc.downloadUrl,
        createdAtIso: doc.createdAtIso,
      })),
    ];

    const q = searchQuery.trim().toLowerCase();
    return items
      .filter((item) => {
        if (sourceFilter !== "ALL" && item.kind !== sourceFilter) return false;
        if (statusFilter !== "ALL" && item.reviewStatus !== statusFilter) {
          return false;
        }
        if (q) {
          const hay = `${item.ownerLabel} ${item.ownerMeta} ${item.fileName} ${item.category} ${item.countryCode}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (a.reviewStatus === "PENDING_REVIEW" && b.reviewStatus !== "PENDING_REVIEW") {
          return -1;
        }
        if (b.reviewStatus === "PENDING_REVIEW" && a.reviewStatus !== "PENDING_REVIEW") {
          return 1;
        }
        return b.createdAtIso.localeCompare(a.createdAtIso);
      });
  }, [
    c.ownerFacilityBadge,
    facilityDocuments,
    locale,
    searchQuery,
    sourceFilter,
    statusFilter,
    userDocuments,
  ]);

  return (
    <div className="space-y-4 rounded-2xl border border-[#D7E4F2] bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#D7E4F2] pb-3.5">
        <h2 className="flex items-center gap-2 text-base font-bold text-[#0F243E]">
          <FileCheck2 className="h-4 w-4 text-[#0066CC]" aria-hidden="true" />
          <span>{c.heading}</span>
        </h2>
        <MoroccanComplianceBadge domain="admin" locale={locale} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex h-9 min-w-[210px] flex-1 items-center gap-1.5 rounded-lg border border-[#D8DFDC] bg-[#F3F8FD] px-3 focus-within:border-[#0066CC] focus-within:bg-white">
          <Search className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={c.searchPlaceholder}
            className="min-w-0 flex-1 bg-transparent text-xs text-[#0F243E] focus:outline-none"
          />
        </div>

        <div className="flex flex-wrap gap-1">
          {(
            [
              { id: "ALL", label: c.filterSourceAll },
              { id: "USER", label: c.filterSourceUsers },
              { id: "FACILITY", label: c.filterSourceFacilities },
            ] as const
          ).map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setSourceFilter(opt.id)}
              className={`h-8 rounded-lg px-3 text-[11px] font-semibold transition ${
                sourceFilter === opt.id
                  ? "bg-[#0066CC] text-white"
                  : "border border-[#CBDDF0] bg-[#F3F8FD] text-slate-700 hover:bg-white hover:text-[#0066CC]"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-1">
          {(
            [
              { id: "ALL", label: c.filterAllStatuses },
              { id: "PENDING_REVIEW", label: c.filterPending },
              { id: "APPROVED", label: c.filterApproved },
              { id: "REJECTED", label: c.filterRejected },
            ] as const
          ).map((st) => (
            <button
              key={st.id}
              type="button"
              onClick={() => setStatusFilter(st.id)}
              className={`h-8 rounded-lg px-3 text-[11px] font-semibold transition ${
                statusFilter === st.id
                  ? "bg-[#0F243E] text-white"
                  : "border border-[#CBDDF0] bg-[#F3F8FD] text-slate-700 hover:bg-white hover:text-[#0F243E]"
              }`}
            >
              {st.label}
            </button>
          ))}
        </div>
      </div>

      {mergedDocs.length === 0 ? (
        <p className="rounded-lg border border-[#D7E4F2] bg-[#F3F8FD] p-6 text-center text-sm text-slate-500">
          {c.emptyText}
        </p>
      ) : (
        <div className="space-y-2.5">
          {mergedDocs.map((doc) => {
            const tone =
              doc.reviewStatus === "APPROVED"
                ? "emerald"
                : doc.reviewStatus === "REJECTED"
                  ? "red"
                  : "amber";
            return (
              <article
                key={`${doc.kind}-${doc.id}`}
                className="space-y-2.5 rounded-2xl border border-[#D7E4F2] bg-[#F3F8FD] p-4 text-xs "
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <FileText
                        className="h-4 w-4 shrink-0 text-[#0066CC]"
                        aria-hidden="true"
                      />
                      <span className="font-bold text-slate-950">
                        <bdi dir="auto">{doc.ownerLabel}</bdi>
                      </span>
                      <UiBadge tone="slate">
                        {doc.kind === "USER"
                          ? c.ownerUserBadge
                          : c.ownerFacilityBadge}
                      </UiBadge>
                      <UiBadge tone={tone}>
                        {doc.reviewStatus === "APPROVED"
                          ? c.filterApproved
                          : doc.reviewStatus === "REJECTED"
                            ? c.filterRejected
                            : c.filterPending}
                      </UiBadge>
                    </div>
                    <p className="text-slate-600">{doc.ownerMeta}</p>
                    <p className="font-mono-tabular text-[11px] text-slate-500">
                      <bdi dir="auto">{doc.fileName}</bdi> · {doc.category} ·{" "}
                      {formatByteSize(doc.sizeBytes)}
                      {doc.sha256Checksum
                        ? ` · SHA256:${doc.sha256Checksum.slice(0, 12)}`
                        : ""}
                    </p>
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
                          subtitle: `${doc.ownerLabel} · ${doc.category}`,
                          badge: doc.reviewStatus,
                        })
                      }
                      className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-xl bg-[#F3F8FD] border border-[#D7E4F2] px-3 text-xs font-semibold text-slate-800 hover:bg-[#E1EBF2] hover:text-[#0066CC]"
                    >
                      <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>{c.inspectBtn}</span>
                    </button>
                  ) : null}
                </div>

                {doc.reviewerNote ? (
                  <p className="rounded-xl bg-slate-50 px-3 py-2 text-[11px] text-slate-600">
                    {doc.reviewerNote}
                  </p>
                ) : null}

                {isOpsAdmin && doc.uploadStatus === "UPLOADED" ? (
                  <div className="space-y-2 border-t border-slate-100 pt-2.5">
                    <div className="flex flex-wrap gap-1">
                      {REVIEW_NOTE_PRESETS[locale].map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() =>
                            setNoteDrafts((prev) => ({ ...prev, [doc.id]: preset }))
                          }
                          className="rounded-full border border-[#D7E4F2] bg-white px-2.5 py-0.5 text-[10.5px] font-semibold text-[#2F4661] transition hover:border-[#0066CC] hover:text-[#0066CC]"
                        >
                          {preset}
                        </button>
                      ))}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                    <input
                      type="text"
                      value={noteDrafts[doc.id] ?? ""}
                      onChange={(e) =>
                        setNoteDrafts((prev) => ({
                          ...prev,
                          [doc.id]: e.target.value,
                        }))
                      }
                      placeholder={c.notePlaceholder}
                      className="h-8 min-w-[180px] flex-1 rounded-lg border border-slate-200 bg-white px-2.5 text-xs text-slate-900 focus:border-[#0066CC] focus:outline-none"
                    />
                    <button
                      type="button"
                      disabled={busy || doc.reviewStatus === "APPROVED"}
                      onClick={() => {
                        const note = noteDrafts[doc.id]?.trim();
                        if (doc.kind === "USER") {
                          void onReviewUserDocument(
                            doc.userId,
                            doc.id,
                            "APPROVED",
                            note,
                          );
                        } else {
                          void onReviewFacilityDocument(
                            doc.id,
                            "APPROVED",
                            note,
                          );
                        }
                      }}
                      className="inline-flex h-8 items-center gap-1 rounded-xl bg-[#0066CC] px-3.5 text-xs font-semibold text-white hover:bg-[#0052A3] disabled:opacity-45"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>{c.approveBtn}</span>
                    </button>
                    <button
                      type="button"
                      disabled={busy || doc.reviewStatus === "REJECTED"}
                      onClick={() => {
                        const note = noteDrafts[doc.id]?.trim();
                        if (doc.kind === "USER") {
                          void onReviewUserDocument(
                            doc.userId,
                            doc.id,
                            "REJECTED",
                            note,
                          );
                        } else {
                          void onReviewFacilityDocument(
                            doc.id,
                            "REJECTED",
                            note,
                          );
                        }
                      }}
                      className="inline-flex h-8 items-center gap-1 rounded-xl border border-rose-200 bg-rose-50 px-3 text-xs font-semibold text-rose-800 hover:bg-rose-100 disabled:opacity-45"
                    >
                      <XCircle className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>{c.rejectBtn}</span>
                    </button>
                    </div>
                  </div>
                ) : !isOpsAdmin ? (
                  <p className="text-[11px] text-slate-500">
                    {c.opsAdminOnlyHint}
                  </p>
                ) : null}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
