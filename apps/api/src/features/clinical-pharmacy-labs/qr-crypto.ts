import crypto from "node:crypto";
import { z } from "zod";

const QrPayloadSchema = z.object({
  rxId: z.string().uuid(),
  countryCode: z.string().regex(/^[A-Z]{2,4}$/),
  patientUserId: z.string().uuid(),
  doctorUserId: z.string().uuid(),
  nonce: z.string().min(8),
});

export type VerifiedPrescriptionQrClaims = z.infer<typeof QrPayloadSchema>;

function toBase64Url(input: string): string {
  return Buffer.from(input, "utf8")
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function fromBase64Url(input: string): string {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(normalized, "base64").toString("utf8");
}

export function signPrescriptionQr(
  claims: VerifiedPrescriptionQrClaims,
  secret: string,
): { qrToken: string; qrSignature: string } {
  const encodedPayload = toBase64Url(JSON.stringify(claims));
  const qrSignature = crypto
    .createHmac("sha256", secret)
    .update(`rx:v1:${encodedPayload}`)
    .digest("hex");

  return {
    qrToken: `v1.${encodedPayload}.${qrSignature}`,
    qrSignature,
  };
}

export function verifyPrescriptionQr(
  qrToken: string,
  secret: string,
): VerifiedPrescriptionQrClaims | null {
  const parts = qrToken.trim().split(".");
  if (parts.length !== 3) return null;
  const [version, encodedPayload, signatureHex] = parts;
  if (version !== "v1" || !encodedPayload || !signatureHex) return null;

  const expectedHex = crypto
    .createHmac("sha256", secret)
    .update(`rx:v1:${encodedPayload}`)
    .digest("hex");

  const providedBuf = Buffer.from(signatureHex, "utf8");
  const expectedBuf = Buffer.from(expectedHex, "utf8");
  if (
    providedBuf.length !== expectedBuf.length ||
    !crypto.timingSafeEqual(providedBuf, expectedBuf)
  ) {
    return null;
  }

  try {
    const parsedJson = JSON.parse(fromBase64Url(encodedPayload)) as unknown;
    const validated = QrPayloadSchema.safeParse(parsedJson);
    return validated.success ? validated.data : null;
  } catch {
    return null;
  }
}
