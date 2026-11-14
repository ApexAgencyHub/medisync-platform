import { z } from "zod";

export const ALLOWED_CERTIFICATION_MIME_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/tiff",
  "image/heic",
  "image/heif",
  "image/bmp",
] as const;

export const ALLOWED_AVATAR_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/heic",
  "image/heif",
] as const;

export const MAX_MEDIA_UPLOAD_BYTES = 15 * 1024 * 1024;

export const MediaUploadStatusSchema = z.enum([
  "PENDING",
  "UPLOADED",
  "FAILED",
]);
export type MediaUploadStatus = z.infer<typeof MediaUploadStatusSchema>;

export const DocumentReviewStatusSchema = z.enum([
  "PENDING_REVIEW",
  "APPROVED",
  "REJECTED",
]);
export type DocumentReviewStatus = z.infer<typeof DocumentReviewStatusSchema>;

export const FacilityMediaCategorySchema = z.enum([
  "MINISTRY_LICENSE",
  "ACCREDITATION",
  "FACILITY_PHOTO",
  "HYGIENE_INSPECTION",
  "FIRE_SAFETY_CERT",
  "PHARMACY_PERMIT",
  "LAB_ISO_CERT",
]);
export type FacilityMediaCategory = z.infer<typeof FacilityMediaCategorySchema>;

export const UserMediaCategorySchema = z.enum([
  "AVATAR",
  "MEDICAL_DEGREE",
  "PRACTITIONER_LICENSE",
  "DRIVER_LICENSE",
  "VEHICLE_INSPECTION",
  "NATIONAL_ID",
  "INSURANCE_CERTIFICATE",
  "BOARD_CERTIFICATION",
  "MALPRACTICE_POLICY",
]);
export type UserMediaCategory = z.infer<typeof UserMediaCategorySchema>;

export const CertificationMimeTypeSchema = z.enum(
  ALLOWED_CERTIFICATION_MIME_TYPES,
);
export type CertificationMimeType = z.infer<typeof CertificationMimeTypeSchema>;

export const PresignFacilityMediaSchema = z.object({
  category: FacilityMediaCategorySchema,
  fileName: z.string().trim().min(1).max(160),
  mimeType: CertificationMimeTypeSchema,
  sizeBytes: z.coerce.number().int().min(1).max(MAX_MEDIA_UPLOAD_BYTES),
});
export type PresignFacilityMediaInput = z.infer<
  typeof PresignFacilityMediaSchema
>;

export const PresignUserMediaSchema = z
  .object({
    category: UserMediaCategorySchema,
    fileName: z.string().trim().min(1).max(160),
    mimeType: CertificationMimeTypeSchema,
    sizeBytes: z.coerce.number().int().min(1).max(MAX_MEDIA_UPLOAD_BYTES),
  })
  .superRefine((val, ctx) => {
    if (
      val.category === "AVATAR" &&
      !(ALLOWED_AVATAR_MIME_TYPES as readonly string[]).includes(val.mimeType)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["mimeType"],
        message: "Avatars must be PNG, JPEG, WebP, or HEIC/HEIF images.",
      });
    }
  });
export type PresignUserMediaInput = z.infer<typeof PresignUserMediaSchema>;

export const ReviewFacilityDocumentSchema = z.object({
  reviewStatus: z.enum(["APPROVED", "REJECTED"]),
  reviewerNote: z.string().trim().max(500).optional(),
});
export type ReviewFacilityDocumentInput = z.infer<
  typeof ReviewFacilityDocumentSchema
>;

export const AdminFacilityMediaQuerySchema = z.object({
  countryCode: z.string().regex(/^[A-Z]{2,4}$/).optional(),
  facilityId: z.string().uuid().optional(),
  reviewStatus: DocumentReviewStatusSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
export type AdminFacilityMediaQuery = z.infer<
  typeof AdminFacilityMediaQuerySchema
>;

export const FacilityMediaDocumentSchema = z.object({
  id: z.string().uuid(),
  countryCode: z.string().regex(/^[A-Z]{2,4}$/),
  facilityId: z.string().uuid(),
  facilityName: z.string(),
  uploadedByUserId: z.string().uuid(),
  category: FacilityMediaCategorySchema,
  objectKey: z.string(),
  fileName: z.string(),
  mimeType: CertificationMimeTypeSchema,
  sizeBytes: z.number().int(),
  confirmedSizeBytes: z.number().int().nullable(),
  uploadStatus: MediaUploadStatusSchema,
  reviewStatus: DocumentReviewStatusSchema,
  reviewerNote: z.string().nullable(),
  reviewedByUserId: z.string().uuid().nullable(),
  reviewedAtIso: z.string().datetime().nullable(),
  sha256Checksum: z.string().nullable().optional(),
  downloadUrl: z.string().url(),
  createdAtIso: z.string().datetime(),
});
export type FacilityMediaDocument = z.infer<typeof FacilityMediaDocumentSchema>;

export const UserMediaDocumentSchema = z.object({
  id: z.string().uuid(),
  countryCode: z.string().regex(/^[A-Z]{2,4}$/),
  userId: z.string().uuid(),
  category: UserMediaCategorySchema,
  objectKey: z.string(),
  fileName: z.string(),
  mimeType: CertificationMimeTypeSchema,
  sizeBytes: z.number().int(),
  confirmedSizeBytes: z.number().int().nullable(),
  uploadStatus: MediaUploadStatusSchema,
  reviewStatus: DocumentReviewStatusSchema,
  reviewerNote: z.string().nullable(),
  reviewedByUserId: z.string().uuid().nullable(),
  reviewedAtIso: z.string().datetime().nullable(),
  sha256Checksum: z.string().nullable().optional(),
  downloadUrl: z.string().url(),
  createdAtIso: z.string().datetime(),
});
export type UserMediaDocument = z.infer<typeof UserMediaDocumentSchema>;

export const FacilityPresignedUploadResponseSchema = z.object({
  document: FacilityMediaDocumentSchema,
  uploadUrl: z.string().url(),
  method: z.literal("PUT"),
  expiresInSeconds: z.number().int().positive(),
  maxBytes: z.number().int().positive(),
  requiredHeaders: z.record(z.string(), z.string()),
});
export type FacilityPresignedUploadResponse = z.infer<
  typeof FacilityPresignedUploadResponseSchema
>;

export const UserPresignedUploadResponseSchema = z.object({
  document: UserMediaDocumentSchema,
  uploadUrl: z.string().url(),
  method: z.literal("PUT"),
  expiresInSeconds: z.number().int().positive(),
  maxBytes: z.number().int().positive(),
  requiredHeaders: z.record(z.string(), z.string()),
});
export type UserPresignedUploadResponse = z.infer<
  typeof UserPresignedUploadResponseSchema
>;

export const FacilityMediaDocumentResponseSchema = z.object({
  document: FacilityMediaDocumentSchema,
});
export type FacilityMediaDocumentResponse = z.infer<
  typeof FacilityMediaDocumentResponseSchema
>;

export const FacilityMediaListResponseSchema = z.object({
  documents: z.array(FacilityMediaDocumentSchema),
});
export type FacilityMediaListResponse = z.infer<
  typeof FacilityMediaListResponseSchema
>;

export const UserMediaDocumentResponseSchema = z.object({
  document: UserMediaDocumentSchema,
  avatarUrl: z.string().url().nullable().optional(),
});
export type UserMediaDocumentResponse = z.infer<
  typeof UserMediaDocumentResponseSchema
>;

export const UserMediaListResponseSchema = z.object({
  documents: z.array(UserMediaDocumentSchema),
});
export type UserMediaListResponse = z.infer<
  typeof UserMediaListResponseSchema
>;
