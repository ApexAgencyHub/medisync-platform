import { z } from "zod";
import { AppointmentSummarySchema } from "./booking.js";

export const TelehealthParticipantRoleSchema = z.enum(["DOCTOR", "PATIENT"]);
export type TelehealthParticipantRole = z.infer<
  typeof TelehealthParticipantRoleSchema
>;

export const TelehealthSignalKindSchema = z.enum([
  "ready",
  "offer",
  "answer",
  "ice",
  "media-state",
  "hangup",
  "clinical-updated",
]);
export type TelehealthSignalKind = z.infer<typeof TelehealthSignalKindSchema>;

export const TelehealthSignalPayloadSchema = z
  .object({
    sdp: z.string().max(32_768).optional(),
    sdpType: z.enum(["offer", "answer"]).optional(),
    candidate: z.string().max(2_048).optional(),
    sdpMid: z.string().max(64).nullable().optional(),
    sdpMLineIndex: z.number().int().min(0).max(32).nullable().optional(),
    audioEnabled: z.boolean().optional(),
    videoEnabled: z.boolean().optional(),
    clinicalEvent: z.enum(["visit-note", "prescription"]).optional(),
    note: z.string().trim().max(240).optional(),
  })
  .strict();
export type TelehealthSignalPayload = z.infer<
  typeof TelehealthSignalPayloadSchema
>;

export const TelehealthSignalInputSchema = z.object({
  kind: TelehealthSignalKindSchema,
  payload: TelehealthSignalPayloadSchema.default({}),
});
export type TelehealthSignalInput = z.infer<typeof TelehealthSignalInputSchema>;

export const TelehealthPresenceInputSchema = z.object({
  joined: z.boolean(),
  audioEnabled: z.boolean().default(true),
  videoEnabled: z.boolean().default(true),
});
export type TelehealthPresenceInput = z.infer<
  typeof TelehealthPresenceInputSchema
>;

export const TelehealthParticipantPresenceSchema = z.object({
  userId: z.string().uuid(),
  role: TelehealthParticipantRoleSchema,
  fullName: z.string(),
  joined: z.boolean(),
  audioEnabled: z.boolean(),
  videoEnabled: z.boolean(),
  updatedAtIso: z.string().datetime(),
});
export type TelehealthParticipantPresence = z.infer<
  typeof TelehealthParticipantPresenceSchema
>;

export const TelehealthSignalEnvelopeSchema = z.object({
  seq: z.number().int().min(1),
  appointmentId: z.string().uuid(),
  senderUserId: z.string().uuid(),
  senderRole: TelehealthParticipantRoleSchema,
  senderName: z.string(),
  kind: TelehealthSignalKindSchema,
  payload: TelehealthSignalPayloadSchema,
  sentAtIso: z.string().datetime(),
});
export type TelehealthSignalEnvelope = z.infer<
  typeof TelehealthSignalEnvelopeSchema
>;

export const TelehealthIceServerSchema = z.object({
  urls: z.union([z.string(), z.array(z.string())]),
  username: z.string().optional(),
  credential: z.string().optional(),
});
export type TelehealthIceServer = z.infer<typeof TelehealthIceServerSchema>;

export const TelehealthRoomStateResponseSchema = z.object({
  appointment: AppointmentSummarySchema,
  selfRole: TelehealthParticipantRoleSchema,
  participants: z.array(TelehealthParticipantPresenceSchema),
  recentSignals: z.array(TelehealthSignalEnvelopeSchema),
  iceServers: z.array(TelehealthIceServerSchema),
});
export type TelehealthRoomStateResponse = z.infer<
  typeof TelehealthRoomStateResponseSchema
>;

export const TelehealthPresenceResponseSchema = z.object({
  participant: TelehealthParticipantPresenceSchema,
});
export type TelehealthPresenceResponse = z.infer<
  typeof TelehealthPresenceResponseSchema
>;

export const TelehealthSignalResponseSchema = z.object({
  signal: TelehealthSignalEnvelopeSchema,
});
export type TelehealthSignalResponse = z.infer<
  typeof TelehealthSignalResponseSchema
>;

export const TelehealthStreamEventSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("snapshot"),
    appointmentId: z.string().uuid(),
    selfRole: TelehealthParticipantRoleSchema,
    participants: z.array(TelehealthParticipantPresenceSchema),
    recentSignals: z.array(TelehealthSignalEnvelopeSchema),
    timestampIso: z.string().datetime(),
  }),
  z.object({
    type: z.literal("presence"),
    appointmentId: z.string().uuid(),
    participant: TelehealthParticipantPresenceSchema,
  }),
  z.object({
    type: z.literal("signal"),
    appointmentId: z.string().uuid(),
    signal: TelehealthSignalEnvelopeSchema,
  }),
]);
export type TelehealthStreamEvent = z.infer<typeof TelehealthStreamEventSchema>;
