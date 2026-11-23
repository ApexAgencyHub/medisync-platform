import { z } from "zod";

export const VisitModeSchema = z.enum(["IN_PERSON", "TELEHEALTH", "HOME_VISIT"]);

export type VisitMode = z.infer<typeof VisitModeSchema>;

export const AppointmentStatusSchema = z.enum([
  "CONFIRMED",
  "CHECKED_IN",
  "COMPLETED",
  "CANCELLED",
  "NO_SHOW",
]);

export type AppointmentStatus = z.infer<typeof AppointmentStatusSchema>;

const TIME_HH_MM_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

function parseHhMmToMinutes(value: string): number {
  const [hoursStr, minutesStr] = value.split(":");
  return Number(hoursStr) * 60 + Number(minutesStr);
}

export const UpsertDoctorProfileSchema = z.object({
  doctorUserId: z.string().uuid().optional(),
  specialty: z.string().trim().min(2).max(120),
  licenseNumber: z.string().trim().min(4).max(64),
  consultationFeeMinor: z.coerce.number().int().min(0).max(10_000_000).default(0),
  bio: z.string().trim().max(500).optional(),
});

export type UpsertDoctorProfileInput = z.infer<typeof UpsertDoctorProfileSchema>;

export const DoctorProfileSummarySchema = z.object({
  doctorUserId: z.string().uuid(),
  doctorName: z.string(),
  countryCode: z.string().regex(/^[A-Z]{2,4}$/),
  specialty: z.string(),
  licenseNumber: z.string(),
  consultationFeeMinor: z.number().int().min(0),
  bio: z.string().nullable(),
  avatarUrl: z.string().url().nullable().optional(),
  updatedAtIso: z.string().datetime(),
});

export type DoctorProfileSummary = z.infer<typeof DoctorProfileSummarySchema>;

export const CreateScheduleSchema = z
  .object({
    facilityId: z.string().uuid(),
    doctorUserId: z.string().uuid().optional(),
    dayOfWeek: z.coerce.number().int().min(0).max(6),
    startTimeUtc: z.string().regex(TIME_HH_MM_REGEX, "Expected HH:MM UTC"),
    endTimeUtc: z.string().regex(TIME_HH_MM_REGEX, "Expected HH:MM UTC"),
    slotDurationMinutes: z.coerce.number().int().min(10).max(120).default(30),
    visitMode: VisitModeSchema.default("IN_PERSON"),
  })
  .refine(
    (data) =>
      parseHhMmToMinutes(data.endTimeUtc) -
        parseHhMmToMinutes(data.startTimeUtc) >=
      data.slotDurationMinutes,
    {
      message:
        "endTimeUtc must exceed startTimeUtc by at least slotDurationMinutes",
      path: ["endTimeUtc"],
    },
  );

export type CreateScheduleInput = z.infer<typeof CreateScheduleSchema>;

export const UpdateScheduleSchema = z
  .object({
    facilityId: z.string().uuid().optional(),
    dayOfWeek: z.coerce.number().int().min(0).max(6).optional(),
    startTimeUtc: z
      .string()
      .regex(TIME_HH_MM_REGEX, "Expected HH:MM UTC")
      .optional(),
    endTimeUtc: z
      .string()
      .regex(TIME_HH_MM_REGEX, "Expected HH:MM UTC")
      .optional(),
    slotDurationMinutes: z.coerce.number().int().min(10).max(120).optional(),
    visitMode: VisitModeSchema.optional(),
    isActive: z.boolean().optional(),
  })
  .refine(
    (data) => {
      if (data.startTimeUtc && data.endTimeUtc) {
        const dur = data.slotDurationMinutes ?? 10;
        return (
          parseHhMmToMinutes(data.endTimeUtc) -
            parseHhMmToMinutes(data.startTimeUtc) >=
          dur
        );
      }
      return true;
    },
    {
      message: "endTimeUtc must exceed startTimeUtc",
      path: ["endTimeUtc"],
    },
  );

export type UpdateScheduleInput = z.infer<typeof UpdateScheduleSchema>;

export const DeleteScheduleResponseSchema = z.object({
  deleted: z.literal(true),
  scheduleId: z.string().uuid(),
});
export type DeleteScheduleResponse = z.infer<
  typeof DeleteScheduleResponseSchema
>;

export const DoctorScheduleSummarySchema = z.object({
  id: z.string().uuid(),
  countryCode: z.string().regex(/^[A-Z]{2,4}$/),
  doctorUserId: z.string().uuid(),
  doctorName: z.string(),
  doctorAvatarUrl: z.string().url().nullable().optional(),
  specialty: z.string(),
  facilityId: z.string().uuid(),
  facilityName: z.string(),
  dayOfWeek: z.number().int().min(0).max(6),
  startTimeUtc: z.string(),
  endTimeUtc: z.string(),
  slotDurationMinutes: z.number().int(),
  visitMode: VisitModeSchema,
  isActive: z.boolean(),
  createdAtIso: z.string().datetime(),
});

export type DoctorScheduleSummary = z.infer<typeof DoctorScheduleSummarySchema>;

export const ScheduleListQuerySchema = z.object({
  countryCode: z.string().regex(/^[A-Z]{2,4}$/).optional(),
  facilityId: z.string().uuid().optional(),
  doctorUserId: z.string().uuid().optional(),
  includeInactive: z
    .union([
      z.boolean(),
      z.enum(["true", "false"]).transform((value) => value === "true"),
    ])
    .optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export type ScheduleListQuery = z.infer<typeof ScheduleListQuerySchema>;

export const SlotsQuerySchema = z.object({
  countryCode: z.string().regex(/^[A-Z]{2,4}$/).optional(),
  facilityId: z.string().uuid().optional(),
  doctorUserId: z.string().uuid().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD"),
  specialty: z.string().trim().max(120).optional(),
  visitMode: VisitModeSchema.optional(),
  includeBooked: z
    .union([
      z.boolean(),
      z.enum(["true", "false"]).transform((value) => value === "true"),
    ])
    .default(false),
});

export type SlotsQuery = z.infer<typeof SlotsQuerySchema>;

export const AvailableSlotSchema = z.object({
  scheduleId: z.string().uuid(),
  doctorUserId: z.string().uuid(),
  doctorName: z.string(),
  doctorAvatarUrl: z.string().url().nullable().optional(),
  specialty: z.string(),
  facilityId: z.string().uuid(),
  facilityName: z.string(),
  countryCode: z.string().regex(/^[A-Z]{2,4}$/),
  visitMode: VisitModeSchema,
  consultationFeeMinor: z.number().int().min(0),
  slotStartIso: z.string().datetime(),
  slotEndIso: z.string().datetime(),
  isAvailable: z.boolean(),
});

export type AvailableSlot = z.infer<typeof AvailableSlotSchema>;

export const CreateAppointmentSchema = z.object({
  scheduleId: z.string().uuid(),
  slotStartIso: z.string().datetime(),
  visitMode: VisitModeSchema.optional(),
  patientUserId: z.string().uuid().optional(),
  reason: z.string().trim().max(400).optional(),
});

export type CreateAppointmentInput = z.infer<typeof CreateAppointmentSchema>;

export const TransitionAppointmentStatusSchema = z.object({
  status: AppointmentStatusSchema,
  note: z.string().trim().max(300).optional(),
});

export type TransitionAppointmentStatusInput = z.infer<
  typeof TransitionAppointmentStatusSchema
>;

export const AppointmentListQuerySchema = z.object({
  countryCode: z.string().regex(/^[A-Z]{2,4}$/).optional(),
  facilityId: z.string().uuid().optional(),
  doctorUserId: z.string().uuid().optional(),
  status: AppointmentStatusSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export type AppointmentListQuery = z.infer<typeof AppointmentListQuerySchema>;

export const AppointmentSummarySchema = z.object({
  id: z.string().uuid(),
  countryCode: z.string().regex(/^[A-Z]{2,4}$/),
  scheduleId: z.string().uuid(),
  facilityId: z.string().uuid(),
  facilityName: z.string(),
  doctorUserId: z.string().uuid(),
  doctorName: z.string(),
  doctorAvatarUrl: z.string().url().nullable().optional(),
  specialty: z.string(),
  patientUserId: z.string().uuid(),
  patientName: z.string(),
  patientPhone: z.string().nullable().optional(),
  bookedByUserId: z.string().uuid(),
  visitMode: VisitModeSchema,
  slotStartIso: z.string().datetime(),
  slotEndIso: z.string().datetime(),
  status: AppointmentStatusSchema,
  reason: z.string().nullable(),
  triageNote: z.string().nullable(),
  createdAtIso: z.string().datetime(),
  updatedAtIso: z.string().datetime(),
});

export type AppointmentSummary = z.infer<typeof AppointmentSummarySchema>;

export const DoctorProfileResponseSchema = z.object({
  profile: DoctorProfileSummarySchema,
});
export type DoctorProfileResponse = z.infer<typeof DoctorProfileResponseSchema>;

export const DoctorProfilesListResponseSchema = z.object({
  profiles: z.array(DoctorProfileSummarySchema),
});
export type DoctorProfilesListResponse = z.infer<
  typeof DoctorProfilesListResponseSchema
>;

export const ScheduleResponseSchema = z.object({
  schedule: DoctorScheduleSummarySchema,
});
export type ScheduleResponse = z.infer<typeof ScheduleResponseSchema>;

export const SchedulesListResponseSchema = z.object({
  schedules: z.array(DoctorScheduleSummarySchema),
});
export type SchedulesListResponse = z.infer<typeof SchedulesListResponseSchema>;

export const SlotsListResponseSchema = z.object({
  date: z.string(),
  slots: z.array(AvailableSlotSchema),
});
export type SlotsListResponse = z.infer<typeof SlotsListResponseSchema>;

export const AppointmentResponseSchema = z.object({
  appointment: AppointmentSummarySchema,
});
export type AppointmentResponse = z.infer<typeof AppointmentResponseSchema>;

export const AppointmentsListResponseSchema = z.object({
  appointments: z.array(AppointmentSummarySchema),
});
export type AppointmentsListResponse = z.infer<
  typeof AppointmentsListResponseSchema
>;
