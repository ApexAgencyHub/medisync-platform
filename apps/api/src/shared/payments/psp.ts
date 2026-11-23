import crypto from "node:crypto";
import { readOptionalEnvBool } from "../env.js";

/**
 * Normalizes a payment webhook payload HMAC-SHA256 verification and timing-safe check.
 */
export function verifyPaymentWebhookSignature(
  rawPayload: string,
  signatureHeader: string | undefined,
  secret: string | undefined,
): boolean {
  if (!secret || !signatureHeader) return false;
  const cleanedHeader = signatureHeader.trim().replace(/^sha256=/i, "");
  if (!/^[a-f0-9]{64}$/i.test(cleanedHeader)) return false;

  const expectedHex = crypto
    .createHmac("sha256", secret)
    .update(rawPayload, "utf8")
    .digest("hex");

  const bufA = Buffer.from(expectedHex, "hex");
  const bufB = Buffer.from(cleanedHeader, "hex");
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Enforces simulated payment restrictions in production environments.
 */
export function isSimulatedCardAllowed(overrideFlag?: boolean): boolean {
  if (overrideFlag !== undefined) return overrideFlag;
  return (
    readOptionalEnvBool("ALLOW_SIMULATED_PAYMENTS") ??
    process.env.NODE_ENV !== "production"
  );
}
