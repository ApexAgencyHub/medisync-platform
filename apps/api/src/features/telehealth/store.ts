import crypto from "node:crypto";
import type { Pool } from "pg";
import type { Redis } from "ioredis";
import { z } from "zod";
import {
  TelehealthIceServerSchema,
  TelehealthParticipantPresenceSchema,
  TelehealthSignalEnvelopeSchema,
  type AppointmentSummary,
  type TelehealthIceServer,
  type TelehealthParticipantPresence,
  type TelehealthParticipantRole,
  type TelehealthPresenceInput,
  type TelehealthSignalEnvelope,
  type TelehealthSignalInput,
  type TelehealthStreamEvent,
} from "@medisync/contracts";
import type { S3PresignConfig } from "../../shared/storage/s3-presign.js";
import type { AuthTokenClaims } from "../foundation/index.js";
import { fetchHydratedAppointmentById } from "../booking/index.js";

const SIGNAL_HISTORY_LIMIT = 64;
const SIGNAL_TTL_SECONDS = 7_200;
const PRESENCE_TTL_SECONDS = 3_600;
const MAX_SIGNALS_PER_MINUTE = 120;

const SIGNAL_BURST_LUA = `
local current = redis.call("INCR", KEYS[1])
if current == 1 then
  redis.call("EXPIRE", KEYS[1], ARGV[1])
end
return current
`;

export class TelehealthNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TelehealthNotFoundError";
  }
}

export class TelehealthForbiddenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TelehealthForbiddenError";
  }
}

export class TelehealthConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TelehealthConflictError";
  }
}

export class TelehealthBadRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TelehealthBadRequestError";
  }
}

export class TelehealthRateLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TelehealthRateLimitError";
  }
}

export interface VerifiedTelehealthContext {
  appointment: AppointmentSummary;
  selfRole: TelehealthParticipantRole;
}

export function telehealthPubSubChannel(appointmentId: string): string {
  return `medisync:telehealth:room:${appointmentId}`;
}

function presenceHashKey(appointmentId: string): string {
  return `medisync:telehealth:presence:${appointmentId}`;
}

function signalListKey(appointmentId: string): string {
  return `medisync:telehealth:signals:${appointmentId}`;
}

function signalSeqKey(appointmentId: string): string {
  return `medisync:telehealth:seq:${appointmentId}`;
}

const DEFAULT_STUN_URLS: readonly string[] = [
  "stun:stun.l.google.com:19302",
  "stun:stun1.l.google.com:19302",
];

const DEFAULT_TURN_TTL_SECONDS = 3_600;

function parseCommaSeparatedUrls(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

export function generateEphemeralTurnCredentials(params: {
  secret: string;
  userId?: string;
  ttlSeconds?: number;
  nowEpochSec?: number;
}): { username: string; credential: string; expiresAtEpochSec: number } {
  const ttl = Math.max(
    60,
    Math.min(86_400, Math.floor(params.ttlSeconds ?? DEFAULT_TURN_TTL_SECONDS)),
  );
  const nowSec = Math.floor(params.nowEpochSec ?? Date.now() / 1000);
  const expiresAtEpochSec = nowSec + ttl;
  const safeUser =
    (params.userId ?? "telehealth")
      .replace(/[^a-zA-Z0-9._-]/g, "")
      .slice(0, 48) || "telehealth";
  const username = `${expiresAtEpochSec}:${safeUser}`;
  const credential = crypto
    .createHmac("sha1", params.secret)
    .update(username, "utf8")
    .digest("base64");
  return { username, credential, expiresAtEpochSec };
}

export function hasTurnRelayConfigured(
  iceServers: readonly TelehealthIceServer[],
): boolean {
  return iceServers.some((server) => {
    const urls = Array.isArray(server.urls) ? server.urls : [server.urls];
    const hasTurnScheme = urls.some((u) => /^turns?:/i.test(u.trim()));
    if (!hasTurnScheme) return false;
    return (
      typeof server.username === "string" &&
      server.username.trim().length > 0 &&
      typeof server.credential === "string" &&
      server.credential.trim().length > 0
    );
  });
}

export function resolveConfiguredIceServers(options?: {
  userId?: string;
  nowEpochSec?: number;
  env?: NodeJS.ProcessEnv;
}): TelehealthIceServer[] {
  const env = options?.env ?? process.env;
  const rawJson = env.TELEHEALTH_ICE_SERVERS_JSON?.trim();
  if (rawJson) {
    try {
      const parsed = z
        .array(TelehealthIceServerSchema)
        .safeParse(JSON.parse(rawJson));
      if (parsed.success && parsed.data.length > 0) {
        return parsed.data;
      }
    } catch {
      // Ignore malformed optional ICE override cleanly
    }
  }

  const configuredStun = parseCommaSeparatedUrls(env.TELEHEALTH_STUN_URLS);
  const servers: TelehealthIceServer[] = [
    {
      urls: configuredStun.length > 0 ? configuredStun : [...DEFAULT_STUN_URLS],
    },
  ];

  const turnUrls = parseCommaSeparatedUrls(env.TELEHEALTH_TURN_URLS);
  if (turnUrls.length > 0) {
    const staticSecret = env.TELEHEALTH_TURN_STATIC_AUTH_SECRET?.trim();
    const staticUser = env.TELEHEALTH_TURN_USERNAME?.trim();
    const staticPass = env.TELEHEALTH_TURN_CREDENTIAL?.trim();
    const parsedTtl = Number.parseInt(
      env.TELEHEALTH_TURN_TTL_SECONDS ?? "",
      10,
    );

    if (staticSecret && staticSecret.length >= 16) {
      const creds = generateEphemeralTurnCredentials({
        secret: staticSecret,
        ...(options?.userId !== undefined ? { userId: options.userId } : {}),
        ...(Number.isFinite(parsedTtl) ? { ttlSeconds: parsedTtl } : {}),
        ...(options?.nowEpochSec !== undefined
          ? { nowEpochSec: options.nowEpochSec }
          : {}),
      });
      servers.push({
        urls: turnUrls,
        username: creds.username,
        credential: creds.credential,
      });
    } else if (staticUser && staticPass) {
      servers.push({
        urls: turnUrls,
        username: staticUser,
        credential: staticPass,
      });
    }
  }

  return servers;
}

export async function verifyTelehealthParticipant(
  pool: Pool,
  appointmentId: string,
  actor: Pick<AuthTokenClaims, "sub">,
  s3Config?: S3PresignConfig,
): Promise<VerifiedTelehealthContext> {
  const appointment = await fetchHydratedAppointmentById(
    pool,
    appointmentId,
    s3Config,
  );
  if (!appointment) {
    throw new TelehealthNotFoundError("Telehealth appointment not found.");
  }

  let selfRole: TelehealthParticipantRole | null = null;
  if (appointment.doctorUserId === actor.sub) {
    selfRole = "DOCTOR";
  } else if (
    appointment.patientUserId === actor.sub ||
    appointment.bookedByUserId === actor.sub
  ) {
    selfRole = "PATIENT";
  }

  if (!selfRole) {
    throw new TelehealthForbiddenError(
      "ONLY_APPOINTMENT_PARTICIPANTS",
    );
  }

  if (appointment.visitMode !== "TELEHEALTH") {
    throw new TelehealthConflictError("APPOINTMENT_NOT_TELEHEALTH");
  }

  if (
    appointment.status === "CANCELLED" ||
    appointment.status === "NO_SHOW"
  ) {
    throw new TelehealthConflictError("APPOINTMENT_INACTIVE");
  }

  return { appointment, selfRole };
}

export async function readRoomParticipants(
  redis: Redis,
  appointmentId: string,
): Promise<TelehealthParticipantPresence[]> {
  const rawHash = await redis.hgetall(presenceHashKey(appointmentId));
  const list: TelehealthParticipantPresence[] = [];
  for (const val of Object.values(rawHash)) {
    try {
      const parsed = TelehealthParticipantPresenceSchema.safeParse(
        JSON.parse(val),
      );
      if (parsed.success) {
        list.push(parsed.data);
      }
    } catch {
      // Ignore corrupt stale entry
    }
  }
  return list.sort((a, b) => a.role.localeCompare(b.role));
}

export async function readRecentSignals(
  redis: Redis,
  appointmentId: string,
  sinceSeq = 0,
): Promise<TelehealthSignalEnvelope[]> {
  const rawEntries = await redis.lrange(signalListKey(appointmentId), 0, -1);
  const items: TelehealthSignalEnvelope[] = [];
  for (const raw of rawEntries) {
    try {
      const parsed = TelehealthSignalEnvelopeSchema.safeParse(JSON.parse(raw));
      if (parsed.success && parsed.data.seq > sinceSeq) {
        items.push(parsed.data);
      }
    } catch {
      // Ignore corrupt signal entry
    }
  }
  return items;
}

export async function updateParticipantPresence(
  redis: Redis,
  appointment: AppointmentSummary,
  actorId: string,
  role: TelehealthParticipantRole,
  input: TelehealthPresenceInput,
): Promise<TelehealthParticipantPresence> {
  const fullName =
    role === "DOCTOR" ? appointment.doctorName : appointment.patientName;
  const presence = TelehealthParticipantPresenceSchema.parse({
    userId: actorId,
    role,
    fullName,
    joined: input.joined,
    audioEnabled: input.audioEnabled,
    videoEnabled: input.videoEnabled,
    updatedAtIso: new Date().toISOString(),
  });

  const hashKey = presenceHashKey(appointment.id);
  const pipeline = redis.pipeline();
  pipeline.hset(hashKey, role, JSON.stringify(presence));
  pipeline.expire(hashKey, PRESENCE_TTL_SECONDS);
  await pipeline.exec();

  const event: TelehealthStreamEvent = {
    type: "presence",
    appointmentId: appointment.id,
    participant: presence,
  };
  await redis.publish(
    telehealthPubSubChannel(appointment.id),
    JSON.stringify(event),
  );

  return presence;
}

export async function appendAndPublishSignal(
  redis: Redis,
  appointment: AppointmentSummary,
  actorId: string,
  role: TelehealthParticipantRole,
  input: TelehealthSignalInput,
): Promise<TelehealthSignalEnvelope> {
  if (
    (input.kind === "offer" || input.kind === "answer") &&
    (!input.payload.sdp || input.payload.sdp.length === 0)
  ) {
    throw new TelehealthBadRequestError(
      "SDP payload is required for offer/answer signals.",
    );
  }
  if (
    input.kind === "ice" &&
    (typeof input.payload.candidate !== "string" ||
      input.payload.candidate.length === 0)
  ) {
    throw new TelehealthBadRequestError(
      "Candidate payload is required for ICE signals.",
    );
  }

  const epochMinute = Math.floor(Date.now() / 60_000);
  const burstKey = `medisync:telehealth:burst:${appointment.id}:${actorId}:${epochMinute}`;
  const countRaw = await redis.eval(SIGNAL_BURST_LUA, 1, burstKey, "65");
  if (Number(countRaw) > MAX_SIGNALS_PER_MINUTE) {
    throw new TelehealthRateLimitError(
      "Telehealth signaling rate limit exceeded for this session.",
    );
  }

  const seq = await redis.incr(signalSeqKey(appointment.id));
  await redis.expire(signalSeqKey(appointment.id), SIGNAL_TTL_SECONDS);

  const envelope = TelehealthSignalEnvelopeSchema.parse({
    seq,
    appointmentId: appointment.id,
    senderUserId: actorId,
    senderRole: role,
    senderName:
      role === "DOCTOR" ? appointment.doctorName : appointment.patientName,
    kind: input.kind,
    payload: input.payload,
    sentAtIso: new Date().toISOString(),
  });

  const listKey = signalListKey(appointment.id);
  const pipeline = redis.pipeline();
  pipeline.rpush(listKey, JSON.stringify(envelope));
  pipeline.ltrim(listKey, -SIGNAL_HISTORY_LIMIT, -1);
  pipeline.expire(listKey, SIGNAL_TTL_SECONDS);
  await pipeline.exec();

  const event: TelehealthStreamEvent = {
    type: "signal",
    appointmentId: appointment.id,
    signal: envelope,
  };
  await redis.publish(
    telehealthPubSubChannel(appointment.id),
    JSON.stringify(event),
  );

  return envelope;
}
