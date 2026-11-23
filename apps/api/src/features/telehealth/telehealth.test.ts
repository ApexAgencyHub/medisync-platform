import crypto from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import type { Redis } from "ioredis";
import type { Pool } from "pg";
import type {
  AppointmentResponse,
  AuthResponse,
  DoctorScheduleSummary,
  FacilitySummary,
  TelehealthRoomStateResponse,
} from "@medisync/contracts";
import { buildApiServer } from "../../server.js";
import { createDbPool } from "../../shared/db/pool.js";
import { runMigrations } from "../../shared/db/migrate.js";
import { createRedisClient } from "../../shared/redis/client.js";
import { hashPassword } from "../foundation/index.js";
import {
  generateEphemeralTurnCredentials,
  hasTurnRelayConfigured,
  resolveConfiguredIceServers,
} from "./store.js";

const DEFAULT_TEST_DB_URL =
  "postgresql://medisync:medisync_dev_password@127.0.0.1:5433/medisync";
const DEFAULT_TEST_REDIS_URL = "redis://127.0.0.1:6380";
const TEST_AUTH_SECRET =
  process.env.AUTH_SECRET ??
  "medisync-ci-ephemeral-test-secret-minimum-32-chars";

describe("api telehealth video consultation rooms & WebRTC signaling", () => {
  let pool: Pool;
  let redis: Redis;
  let app: FastifyInstance;

  const runSuffix = crypto.randomBytes(4).toString("hex");
  const licenseBase = Math.floor(100000 + crypto.randomInt(0, 700000));
  const createdUserIds: string[] = [];
  const createdFacilityIds: string[] = [];
  const createdScheduleIds: string[] = [];
  const createdAppointmentIds: string[] = [];
  const touchedRedisKeys: string[] = [];

  beforeAll(async () => {
    const databaseUrl = process.env.DATABASE_URL ?? DEFAULT_TEST_DB_URL;
    const redisUrl = process.env.REDIS_URL ?? DEFAULT_TEST_REDIS_URL;
    pool = createDbPool(databaseUrl);
    redis = createRedisClient(redisUrl);
    await runMigrations(pool);

    app = await buildApiServer({
      databaseUrl,
      redisUrl,
      authSecret: TEST_AUTH_SECRET,
      corsOrigins: ["http://127.0.0.1:3000"],
      pool,
      redis,
      runDbMigrations: false,
    });
  });

  afterAll(async () => {
    if (touchedRedisKeys.length > 0) {
      await redis.del(...touchedRedisKeys).catch(() => undefined);
    }
    if (createdAppointmentIds.length > 0) {
      await pool.query("DELETE FROM appointments WHERE id = ANY($1::uuid[])", [
        createdAppointmentIds,
      ]);
    }
    if (createdScheduleIds.length > 0) {
      await pool.query(
        "DELETE FROM doctor_schedules WHERE id = ANY($1::uuid[])",
        [createdScheduleIds],
      );
    }
    if (createdUserIds.length > 0) {
      await pool.query(
        "DELETE FROM doctor_profiles WHERE doctor_user_id = ANY($1::uuid[])",
        [createdUserIds],
      );
      await pool.query(
        "DELETE FROM audit_logs WHERE actor_id = ANY($1::uuid[])",
        [createdUserIds],
      );
    }
    if (createdFacilityIds.length > 0) {
      await pool.query("DELETE FROM facilities WHERE id = ANY($1::uuid[])", [
        createdFacilityIds,
      ]);
    }
    if (createdUserIds.length > 0) {
      await pool.query("DELETE FROM users WHERE id = ANY($1::uuid[])", [
        createdUserIds,
      ]);
    }

    await app.close();
    await redis.quit();
    await pool.end();
  });

  async function registerAccount(input: {
    email: string;
    fullName: string;
    role: "PATIENT" | "DOCTOR" | "CLINIC_STAFF";
  }): Promise<AuthResponse> {
    const res = await app.inject({
      method: "POST",
      url: "/v1/auth/register",
      payload: {
        email: input.email,
        password: "StrongPassword!123",
        fullName: input.fullName,
        role: input.role,
        countryCode: "MA",
      },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json<AuthResponse>();
    createdUserIds.push(body.user.id);
    return body;
  }

  it("enforces strict doctor/patient room ownership, rejects IN_PERSON visits, and relays WebRTC offer/answer/ICE signals", async () => {
    const opsPasswordHash = await hashPassword("OpsSecret!123");
    const opsEmail = `ops.tele.${runSuffix}@medisync.global`;
    const opsInsert = await pool.query<{ id: string }>(
      `INSERT INTO users (email, password_hash, full_name, role, country_code)
       VALUES ($1, $2, 'Ops Tele Admin', 'OPS_ADMIN', 'MA')
       RETURNING id`,
      [opsEmail, opsPasswordHash],
    );
    createdUserIds.push(opsInsert.rows[0]!.id);
    const opsLogin = await app.inject({
      method: "POST",
      url: "/v1/auth/login",
      payload: { email: opsEmail, password: "OpsSecret!123" },
    });
    const opsToken = opsLogin.json<AuthResponse>().token;

    const doctor = await registerAccount({
      email: `dr.tele.${runSuffix}@medisync.ma`,
      fullName: "Dr. Amina Alaoui",
      role: "DOCTOR",
    });
    const otherDoctor = await registerAccount({
      email: `dr.other.${runSuffix}@medisync.ma`,
      fullName: "Dr. Intruder",
      role: "DOCTOR",
    });
    const patient = await registerAccount({
      email: `patient.tele.${runSuffix}@medisync.ma`,
      fullName: "Youssef Idrissi",
      role: "PATIENT",
    });
    const otherPatient = await registerAccount({
      email: `patient.other.${runSuffix}@medisync.ma`,
      fullName: "Malicious Patient",
      role: "PATIENT",
    });
    const clinicStaff = await registerAccount({
      email: `staff.tele.${runSuffix}@medisync.ma`,
      fullName: "Nadia Clinic",
      role: "CLINIC_STAFF",
    });

    const facRes = await app.inject({
      method: "POST",
      url: "/v1/facilities",
      headers: { authorization: `Bearer ${clinicStaff.token}` },
      payload: {
        name: `Clinique Tele ${runSuffix}`,
        kind: "CLINIC",
        countryCode: "MA",
        licenseNumber: `MA-CLIN-${licenseBase}`,
        lat: 33.591,
        lng: -7.64,
        address: "Anfa, Casablanca",
      },
    });
    expect(facRes.statusCode).toBe(201);
    const facility = facRes.json<{ facility: FacilitySummary }>().facility;
    createdFacilityIds.push(facility.id);

    const profRes = await app.inject({
      method: "PUT",
      url: "/v1/booking/profiles",
      headers: { authorization: `Bearer ${doctor.token}` },
      payload: {
        specialty: "Cardiology",
        licenseNumber: `MA-MD-${licenseBase}`,
        consultationFeeMinor: 35000,
      },
    });
    expect(profRes.statusCode).toBe(200);

    // 2026-11-16 is UTC Monday (dayOfWeek = 1)
    const schedRes = await app.inject({
      method: "POST",
      url: "/v1/booking/schedules",
      headers: { authorization: `Bearer ${doctor.token}` },
      payload: {
        facilityId: facility.id,
        dayOfWeek: 1,
        startTimeUtc: "10:00",
        endTimeUtc: "12:00",
        slotDurationMinutes: 30,
        visitMode: "TELEHEALTH",
      },
    });
    expect(schedRes.statusCode).toBe(201);
    const schedule = schedRes.json<{ schedule: DoctorScheduleSummary }>().schedule;
    createdScheduleIds.push(schedule.id);

    const teleBookRes = await app.inject({
      method: "POST",
      url: "/v1/booking/appointments",
      headers: { authorization: `Bearer ${patient.token}` },
      payload: {
        scheduleId: schedule.id,
        slotStartIso: "2026-11-16T10:00:00.000Z",
        visitMode: "TELEHEALTH",
        reason: "Chest tightness video follow-up",
      },
    });
    expect(teleBookRes.statusCode).toBe(201);
    const teleAppt = teleBookRes.json<AppointmentResponse>().appointment;
    createdAppointmentIds.push(teleAppt.id);
    touchedRedisKeys.push(
      `medisync:telehealth:presence:${teleAppt.id}`,
      `medisync:telehealth:signals:${teleAppt.id}`,
      `medisync:telehealth:seq:${teleAppt.id}`,
    );

    const inPersonBookRes = await app.inject({
      method: "POST",
      url: "/v1/booking/appointments",
      headers: { authorization: `Bearer ${patient.token}` },
      payload: {
        scheduleId: schedule.id,
        slotStartIso: "2026-11-16T10:30:00.000Z",
        visitMode: "IN_PERSON",
        reason: "Physical clinic check",
      },
    });
    expect(inPersonBookRes.statusCode).toBe(201);
    const inPersonAppt = inPersonBookRes.json<AppointmentResponse>().appointment;
    createdAppointmentIds.push(inPersonAppt.id);

    // 1. Unauthenticated blocked
    const anonRes = await app.inject({
      method: "GET",
      url: `/v1/telehealth/sessions/${teleAppt.id}`,
    });
    expect(anonRes.statusCode).toBe(401);

    // 2. Unrelated doctor, unrelated patient, and even OPS_ADMIN blocked from private consultation room
    for (const intruderToken of [
      otherDoctor.token,
      otherPatient.token,
      opsToken,
    ]) {
      const forbiddenRes = await app.inject({
        method: "GET",
        url: `/v1/telehealth/sessions/${teleAppt.id}`,
        headers: { authorization: `Bearer ${intruderToken}` },
      });
      expect(forbiddenRes.statusCode).toBe(403);
    }

    // 3. IN_PERSON visit rejected cleanly with 409
    const nonTeleRes = await app.inject({
      method: "GET",
      url: `/v1/telehealth/sessions/${inPersonAppt.id}`,
      headers: { authorization: `Bearer ${doctor.token}` },
    });
    expect(nonTeleRes.statusCode).toBe(409);

    // 4. Assigned Doctor & Booked Patient join room and verify selfRole + presence
    const docJoinRes = await app.inject({
      method: "POST",
      url: `/v1/telehealth/sessions/${teleAppt.id}/presence`,
      headers: { authorization: `Bearer ${doctor.token}` },
      payload: { joined: true, audioEnabled: true, videoEnabled: true },
    });
    expect(docJoinRes.statusCode).toBe(200);

    const patStateRes = await app.inject({
      method: "GET",
      url: `/v1/telehealth/sessions/${teleAppt.id}`,
      headers: { authorization: `Bearer ${patient.token}` },
    });
    expect(patStateRes.statusCode).toBe(200);
    const patState = patStateRes.json<TelehealthRoomStateResponse>();
    expect(patState.selfRole).toBe("PATIENT");
    expect(patState.participants.some((p) => p.role === "DOCTOR" && p.joined)).toBe(true);

    // 5. WebRTC Offer (Doctor -> Room) -> Answer (Patient -> Room) -> ICE Candidate -> Validation check
    const badOfferRes = await app.inject({
      method: "POST",
      url: `/v1/telehealth/sessions/${teleAppt.id}/signal`,
      headers: { authorization: `Bearer ${doctor.token}` },
      payload: { kind: "offer", payload: {} },
    });
    expect(badOfferRes.statusCode).toBe(400);

    const offerRes = await app.inject({
      method: "POST",
      url: `/v1/telehealth/sessions/${teleAppt.id}/signal`,
      headers: { authorization: `Bearer ${doctor.token}` },
      payload: {
        kind: "offer",
        payload: { sdpType: "offer", sdp: "v=0\r\no=- 123 2 IN IP4 127.0.0.1\r\n" },
      },
    });
    expect(offerRes.statusCode).toBe(201);
    const offerSeq = offerRes.json<{ signal: { seq: number } }>().signal.seq;
    expect(offerSeq).toBeGreaterThanOrEqual(1);

    const answerRes = await app.inject({
      method: "POST",
      url: `/v1/telehealth/sessions/${teleAppt.id}/signal`,
      headers: { authorization: `Bearer ${patient.token}` },
      payload: {
        kind: "answer",
        payload: { sdpType: "answer", sdp: "v=0\r\no=- 456 2 IN IP4 127.0.0.1\r\n" },
      },
    });
    expect(answerRes.statusCode).toBe(201);

    const iceRes = await app.inject({
      method: "POST",
      url: `/v1/telehealth/sessions/${teleAppt.id}/signal`,
      headers: { authorization: `Bearer ${doctor.token}` },
      payload: {
        kind: "ice",
        payload: {
          candidate: "candidate:1 1 UDP 2122252543 127.0.0.1 54321 typ host",
          sdpMid: "0",
          sdpMLineIndex: 0,
        },
      },
    });
    expect(iceRes.statusCode).toBe(201);

    // Lossless reconnect sinceSeq filtering
    const deltaRes = await app.inject({
      method: "GET",
      url: `/v1/telehealth/sessions/${teleAppt.id}?sinceSeq=${offerSeq}`,
      headers: { authorization: `Bearer ${doctor.token}` },
    });
    expect(deltaRes.statusCode).toBe(200);
    const deltaBody = deltaRes.json<TelehealthRoomStateResponse>();
    expect(deltaBody.recentSignals.map((s) => s.kind)).toEqual(["answer", "ice"]);

    // 6. Verify ephemeral coturn HMAC-SHA1 TURN credentials returned on live room state when configured
    const prevTurnUrls = process.env.TELEHEALTH_TURN_URLS;
    const prevTurnSecret = process.env.TELEHEALTH_TURN_STATIC_AUTH_SECRET;
    try {
      process.env.TELEHEALTH_TURN_URLS =
        "turn:turn.medisync.ma:3478?transport=udp,turns:turn.medisync.ma:5349?transport=tcp";
      process.env.TELEHEALTH_TURN_STATIC_AUTH_SECRET =
        "test-coturn-hmac-secret-minimum-32-chars";

      const turnRoomRes = await app.inject({
        method: "GET",
        url: `/v1/telehealth/sessions/${teleAppt.id}`,
        headers: { authorization: `Bearer ${doctor.token}` },
      });
      expect(turnRoomRes.statusCode).toBe(200);
      const turnRoom = turnRoomRes.json<TelehealthRoomStateResponse>();
      expect(hasTurnRelayConfigured(turnRoom.iceServers)).toBe(true);
      const turnEntry = turnRoom.iceServers.find((srv) => {
        const urls = Array.isArray(srv.urls) ? srv.urls : [srv.urls];
        return urls.some((u) => u.startsWith("turn:"));
      });
      expect(turnEntry).toBeDefined();
      expect(turnEntry?.username).toContain(doctor.user.id);
      const expectedMac = crypto
        .createHmac("sha1", process.env.TELEHEALTH_TURN_STATIC_AUTH_SECRET)
        .update(turnEntry!.username!, "utf8")
        .digest("base64");
      expect(turnEntry?.credential).toBe(expectedMac);
    } finally {
      if (prevTurnUrls === undefined) delete process.env.TELEHEALTH_TURN_URLS;
      else process.env.TELEHEALTH_TURN_URLS = prevTurnUrls;
      if (prevTurnSecret === undefined) {
        delete process.env.TELEHEALTH_TURN_STATIC_AUTH_SECRET;
      } else {
        process.env.TELEHEALTH_TURN_STATIC_AUTH_SECRET = prevTurnSecret;
      }
    }
  });

  it("resolves STUN fallback, ephemeral coturn TURN HMAC credentials, static TURN, and TELEHEALTH_ICE_SERVERS_JSON overrides cleanly", () => {
    // 1. Default STUN-only fallback
    const defaultIce = resolveConfiguredIceServers({ env: {} });
    expect(defaultIce.length).toBe(1);
    expect(hasTurnRelayConfigured(defaultIce)).toBe(false);

    // 2. Deterministic coturn HMAC-SHA1 REST credentials
    const creds = generateEphemeralTurnCredentials({
      secret: "coturn-shared-secret-value-123456",
      userId: "user-42",
      ttlSeconds: 1800,
      nowEpochSec: 1_700_000_000,
    });
    expect(creds.username).toBe("1700001800:user-42");
    expect(creds.credential).toBe(
      crypto
        .createHmac("sha1", "coturn-shared-secret-value-123456")
        .update("1700001800:user-42", "utf8")
        .digest("base64"),
    );

    const ephemeralIce = resolveConfiguredIceServers({
      userId: "user-42",
      nowEpochSec: 1_700_000_000,
      env: {
        TELEHEALTH_STUN_URLS: "stun:stun.medisync.ma:3478",
        TELEHEALTH_TURN_URLS:
          "turn:turn.medisync.ma:3478?transport=udp,turns:turn.medisync.ma:5349?transport=tcp",
        TELEHEALTH_TURN_STATIC_AUTH_SECRET: "coturn-shared-secret-value-123456",
        TELEHEALTH_TURN_TTL_SECONDS: "1800",
      },
    });
    expect(ephemeralIce.length).toBe(2);
    expect(hasTurnRelayConfigured(ephemeralIce)).toBe(true);
    expect(ephemeralIce[1]?.username).toBe("1700001800:user-42");
    expect(ephemeralIce[1]?.credential).toBe(creds.credential);

    // 3. Static TURN credentials fallback
    const staticIce = resolveConfiguredIceServers({
      env: {
        TELEHEALTH_TURN_URLS: "turn:relay.medisync.ma:3478",
        TELEHEALTH_TURN_USERNAME: "medisync-turn",
        TELEHEALTH_TURN_CREDENTIAL: "turn-pass-123",
      },
    });
    expect(hasTurnRelayConfigured(staticIce)).toBe(true);
    expect(staticIce[1]?.username).toBe("medisync-turn");
    expect(staticIce[1]?.credential).toBe("turn-pass-123");

    // 4. Explicit TELEHEALTH_ICE_SERVERS_JSON override takes precedence
    const jsonIce = resolveConfiguredIceServers({
      env: {
        TELEHEALTH_ICE_SERVERS_JSON: JSON.stringify([
          { urls: "stun:stun.custom.ma:3478" },
          {
            urls: ["turns:turn.custom.ma:5349"],
            username: "custom-u",
            credential: "custom-p",
          },
        ]),
        TELEHEALTH_TURN_URLS: "turn:ignored.example:3478",
        TELEHEALTH_TURN_STATIC_AUTH_SECRET: "ignored-secret-value-min-16",
      },
    });
    expect(jsonIce.length).toBe(2);
    expect(jsonIce[1]?.username).toBe("custom-u");

    // 5. Malformed JSON falls back cleanly without throwing
    const malformedIce = resolveConfiguredIceServers({
      env: { TELEHEALTH_ICE_SERVERS_JSON: "{not-json" },
    });
    expect(malformedIce.length).toBe(1);
    expect(hasTurnRelayConfigured(malformedIce)).toBe(false);

    // 6. Unauthenticated TURN URL without username/credential is NOT reported as ready
    expect(
      hasTurnRelayConfigured([{ urls: "turn:turn.medisync.ma:3478" }]),
    ).toBe(false);
    expect(
      hasTurnRelayConfigured([
        {
          urls: "turn:turn.medisync.ma:3478",
          username: "u",
          credential: "p",
        },
      ]),
    ).toBe(true);
  });
});
