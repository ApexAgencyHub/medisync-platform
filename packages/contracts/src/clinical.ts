import { z } from "zod";
import { MediaUploadStatusSchema } from "./media.js";

export const ALLOWED_MEDIA_MIME_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/tiff",
  "image/heic",
  "image/heif",
  "image/bmp",
  "image/gif",
  "application/dicom",
  "text/plain",
  "text/csv",
  "application/json",
  "application/fhir+json",
  "audio/wav",
  "audio/mpeg",
  "video/mp4",
] as const;

export const MAX_CLINICAL_UPLOAD_BYTES = 50 * 1024 * 1024;

export const ClinicalMediaCategorySchema = z.enum([
  "LAB_REPORT",
  "RADIOLOGY_SCAN",
  "PRESCRIPTION_SCAN",
  "INSURANCE_CARD",
  "DISCHARGE_SUMMARY",
  "REFERRAL_LETTER",
  "VOICE_NOTE",
  "FHIR_BUNDLE",
  "OTHER",
]);
export type ClinicalMediaCategory = z.infer<typeof ClinicalMediaCategorySchema>;

export const ClinicalMediaMimeTypeSchema = z.enum(ALLOWED_MEDIA_MIME_TYPES);
export type ClinicalMediaMimeType = z.infer<typeof ClinicalMediaMimeTypeSchema>;

export const PrescriptionStatusSchema = z.enum([
  "ISSUED",
  "DISPENSED",
  "CANCELLED",
]);
export type PrescriptionStatus = z.infer<typeof PrescriptionStatusSchema>;

export const LabOrderStatusSchema = z.enum([
  "ORDERED",
  "SAMPLE_COLLECTED",
  "COMPLETED",
  "CANCELLED",
]);
export type LabOrderStatus = z.infer<typeof LabOrderStatusSchema>;

export const LabUrgencySchema = z.enum(["ROUTINE", "URGENT", "EMERGENCY"]);
export type LabUrgency = z.infer<typeof LabUrgencySchema>;

export const VisitNoteVitalsSchema = z.object({
  temperatureC: z.number().min(30).max(45).optional(),
  systolicMmHg: z.number().int().min(40).max(300).optional(),
  diastolicMmHg: z.number().int().min(20).max(200).optional(),
  heartRateBpm: z.number().int().min(20).max(260).optional(),
});
export type VisitNoteVitals = z.infer<typeof VisitNoteVitalsSchema>;

export const CreateVisitNoteSchema = z.object({
  patientUserId: z.string().uuid(),
  appointmentId: z.string().uuid().optional(),
  facilityId: z.string().uuid().optional(),
  icd10Codes: z.array(z.string().trim().min(2).max(16)).max(10).default([]),
  subjective: z.string().trim().min(2).max(2000),
  objective: z.string().trim().min(2).max(2000),
  assessment: z.string().trim().min(2).max(2000),
  plan: z.string().trim().min(2).max(2000),
  vitals: VisitNoteVitalsSchema.optional(),
});
export type CreateVisitNoteInput = z.infer<typeof CreateVisitNoteSchema>;

export const VisitNoteSummarySchema = z.object({
  id: z.string().uuid(),
  countryCode: z.string().regex(/^[A-Z]{2,4}$/),
  patientUserId: z.string().uuid(),
  patientName: z.string(),
  doctorUserId: z.string().uuid(),
  doctorName: z.string(),
  appointmentId: z.string().uuid().nullable(),
  facilityId: z.string().uuid().nullable(),
  icd10Codes: z.array(z.string()),
  subjective: z.string(),
  objective: z.string(),
  assessment: z.string(),
  plan: z.string(),
  vitals: VisitNoteVitalsSchema.nullable(),
  createdAtIso: z.string().datetime(),
});
export type VisitNoteSummary = z.infer<typeof VisitNoteSummarySchema>;

export const MedicationItemSchema = z.object({
  name: z.string().trim().min(2).max(120),
  dosage: z.string().trim().min(1).max(80),
  frequency: z.string().trim().min(1).max(80),
  durationDays: z.coerce.number().int().min(1).max(365),
  instructions: z.string().trim().max(240).optional(),
});
export type MedicationItem = z.infer<typeof MedicationItemSchema>;

export const CreatePrescriptionSchema = z.object({
  patientUserId: z.string().uuid(),
  appointmentId: z.string().uuid().optional(),
  facilityId: z.string().uuid().optional(),
  medications: z.array(MedicationItemSchema).min(1).max(20),
  notes: z.string().trim().max(500).optional(),
});
export type CreatePrescriptionInput = z.infer<typeof CreatePrescriptionSchema>;

export const VerifyPrescriptionQrSchema = z.object({
  qrToken: z.string().trim().min(16).max(2048),
});
export type VerifyPrescriptionQrInput = z.infer<
  typeof VerifyPrescriptionQrSchema
>;

export const DispensePrescriptionSchema = z.object({
  pharmacyFacilityId: z.string().uuid().optional(),
  dispensingNote: z.string().trim().max(400).optional(),
});
export type DispensePrescriptionInput = z.infer<
  typeof DispensePrescriptionSchema
>;

export const PrescriptionSummarySchema = z.object({
  id: z.string().uuid(),
  countryCode: z.string().regex(/^[A-Z]{2,4}$/),
  patientUserId: z.string().uuid(),
  patientName: z.string(),
  doctorUserId: z.string().uuid(),
  doctorName: z.string(),
  facilityId: z.string().uuid().nullable(),
  medications: z.array(MedicationItemSchema),
  notes: z.string().nullable(),
  qrToken: z.string(),
  qrSignature: z.string(),
  status: PrescriptionStatusSchema,
  dispensedByUserId: z.string().uuid().nullable(),
  pharmacyFacilityId: z.string().uuid().nullable(),
  dispensedAtIso: z.string().datetime().nullable(),
  dispensingNote: z.string().nullable(),
  issuedAtIso: z.string().datetime(),
});
export type PrescriptionSummary = z.infer<typeof PrescriptionSummarySchema>;

export const CreateLabOrderSchema = z.object({
  patientUserId: z.string().uuid(),
  facilityId: z.string().uuid(),
  appointmentId: z.string().uuid().optional(),
  panelName: z.string().trim().min(2).max(180),
  urgency: LabUrgencySchema.default("ROUTINE"),
  clinicalNotes: z.string().trim().max(500).optional(),
});
export type CreateLabOrderInput = z.infer<typeof CreateLabOrderSchema>;

export const UpdateLabOrderStatusSchema = z.object({
  status: LabOrderStatusSchema,
  resultSummary: z.string().trim().max(1000).optional(),
  reportObjectKey: z.string().trim().max(320).optional(),
});
export type UpdateLabOrderStatusInput = z.infer<
  typeof UpdateLabOrderStatusSchema
>;

export const LabOrderSummarySchema = z.object({
  id: z.string().uuid(),
  countryCode: z.string().regex(/^[A-Z]{2,4}$/),
  patientUserId: z.string().uuid(),
  patientName: z.string(),
  orderedByDoctorId: z.string().uuid(),
  orderedByDoctorName: z.string(),
  facilityId: z.string().uuid(),
  facilityName: z.string(),
  appointmentId: z.string().uuid().nullable(),
  panelName: z.string(),
  urgency: LabUrgencySchema,
  clinicalNotes: z.string().nullable(),
  status: LabOrderStatusSchema,
  resultSummary: z.string().nullable(),
  reportObjectKey: z.string().nullable(),
  createdAtIso: z.string().datetime(),
  updatedAtIso: z.string().datetime(),
});
export type LabOrderSummary = z.infer<typeof LabOrderSummarySchema>;

export const PresignClinicalUploadSchema = z.object({
  patientUserId: z.string().uuid(),
  labOrderId: z.string().uuid().optional(),
  mediaCategory: ClinicalMediaCategorySchema.default("OTHER"),
  fileName: z.string().trim().min(1).max(160),
  mimeType: ClinicalMediaMimeTypeSchema,
  sizeBytes: z.coerce
    .number()
    .int()
    .min(1)
    .max(MAX_CLINICAL_UPLOAD_BYTES),
});
export type PresignClinicalUploadInput = z.input<
  typeof PresignClinicalUploadSchema
>;

export const ClinicalMediaObjectSummarySchema = z.object({
  id: z.string().uuid(),
  countryCode: z.string().regex(/^[A-Z]{2,4}$/),
  patientUserId: z.string().uuid(),
  labOrderId: z.string().uuid().nullable(),
  uploadedByUserId: z.string().uuid(),
  mediaCategory: ClinicalMediaCategorySchema.default("OTHER"),
  objectKey: z.string(),
  fileName: z.string(),
  mimeType: ClinicalMediaMimeTypeSchema,
  sizeBytes: z.number().int(),
  confirmedSizeBytes: z.number().int().nullable().default(null),
  uploadStatus: MediaUploadStatusSchema.default("PENDING"),
  sha256Checksum: z.string().nullable().optional(),
  confirmedAtIso: z.string().datetime().nullable().default(null),
  downloadUrl: z.string().url(),
  createdAtIso: z.string().datetime(),
});
export type ClinicalMediaObjectSummary = z.infer<
  typeof ClinicalMediaObjectSummarySchema
>;

export const PresignedUploadResponseSchema = z.object({
  mediaObject: ClinicalMediaObjectSummarySchema,
  uploadUrl: z.string().url(),
  method: z.literal("PUT"),
  expiresInSeconds: z.number().int().positive(),
  maxBytes: z.number().int().positive(),
  requiredHeaders: z.record(z.string(), z.string()),
});
export type PresignedUploadResponse = z.infer<
  typeof PresignedUploadResponseSchema
>;

export const ClinicalFilterQuerySchema = z.object({
  countryCode: z.string().regex(/^[A-Z]{2,4}$/).optional(),
  patientUserId: z.string().uuid().optional(),
  status: z.string().max(32).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
export type ClinicalFilterQuery = z.infer<typeof ClinicalFilterQuerySchema>;

export const VisitNoteResponseSchema = z.object({
  visitNote: VisitNoteSummarySchema,
});
export type VisitNoteResponse = z.infer<typeof VisitNoteResponseSchema>;

export const VisitNotesListResponseSchema = z.object({
  visitNotes: z.array(VisitNoteSummarySchema),
});
export type VisitNotesListResponse = z.infer<
  typeof VisitNotesListResponseSchema
>;

export const PrescriptionResponseSchema = z.object({
  prescription: PrescriptionSummarySchema,
});
export type PrescriptionResponse = z.infer<typeof PrescriptionResponseSchema>;

export const PrescriptionsListResponseSchema = z.object({
  prescriptions: z.array(PrescriptionSummarySchema),
});
export type PrescriptionsListResponse = z.infer<
  typeof PrescriptionsListResponseSchema
>;

export const VerifyPrescriptionQrResponseSchema = z.object({
  valid: z.boolean(),
  prescription: PrescriptionSummarySchema,
});
export type VerifyPrescriptionQrResponse = z.infer<
  typeof VerifyPrescriptionQrResponseSchema
>;

export const LabOrderResponseSchema = z.object({
  labOrder: LabOrderSummarySchema,
});
export type LabOrderResponse = z.infer<typeof LabOrderResponseSchema>;

export const LabOrdersListResponseSchema = z.object({
  labOrders: z.array(LabOrderSummarySchema),
});
export type LabOrdersListResponse = z.infer<typeof LabOrdersListResponseSchema>;

export const ClinicalMediaListResponseSchema = z.object({
  mediaObjects: z.array(ClinicalMediaObjectSummarySchema),
});
export type ClinicalMediaListResponse = z.infer<
  typeof ClinicalMediaListResponseSchema
>;

export const ClinicalMediaObjectResponseSchema = z.object({
  mediaObject: ClinicalMediaObjectSummarySchema,
});
export type ClinicalMediaObjectResponse = z.infer<
  typeof ClinicalMediaObjectResponseSchema
>;
