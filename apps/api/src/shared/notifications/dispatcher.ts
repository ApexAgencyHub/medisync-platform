import crypto from "node:crypto";
import { readOptionalEnvString } from "../env.js";

export interface NotificationDispatchPayload {
  channel: "EMAIL" | "SMS";
  recipient: string;
  purpose: "LOGIN_OTP" | "VERIFY_EMAIL" | "VERIFY_PHONE" | "RESET_PASSWORD";
  code: string;
  expiresInMinutes: number;
}

export interface NotificationTransportConfig {
  smtpWebhookUrl?: string | undefined;
  smsWebhookUrl?: string | undefined;
}

export interface NotificationDispatchResult {
  delivered: boolean;
  provider: "WEBHOOK_SMTP" | "WEBHOOK_SMS" | "DEV_PREVIEW";
}

function maskRecipient(recipient: string): string {
  const trimmed = recipient.trim();
  if (trimmed.includes("@")) {
    const [local = "", domain = ""] = trimmed.split("@");
    return `${local.slice(0, 2)}***@${domain}`;
  }
  return `***${trimmed.slice(-4)}`;
}

/**
 * Production notification adapter.
 * Routes transactional OTP and verification alerts through external SMTP/SMS HTTP webhooks
 * when configured; never leaks raw OTPs into application logs.
 */
export async function dispatchVerificationNotification(
  payload: NotificationDispatchPayload,
  config: NotificationTransportConfig = {},
): Promise<NotificationDispatchResult> {
  const endpoint =
    payload.channel === "EMAIL"
      ? (config.smtpWebhookUrl?.trim() || readOptionalEnvString("SMTP_WEBHOOK_URL"))
      : (config.smsWebhookUrl?.trim() || readOptionalEnvString("SMS_WEBHOOK_URL"));

  if (!endpoint) {
    return {
      delivered: false,
      provider: "DEV_PREVIEW",
    };
  }

  const body = JSON.stringify({
    id: crypto.randomUUID(),
    channel: payload.channel,
    to: payload.recipient,
    recipientMasked: maskRecipient(payload.recipient),
    purpose: payload.purpose,
    code: payload.code,
    expiresInMinutes: payload.expiresInMinutes,
    issuedAtIso: new Date().toISOString(),
  });

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok) {
      return {
        delivered: true,
        provider: payload.channel === "EMAIL" ? "WEBHOOK_SMTP" : "WEBHOOK_SMS",
      };
    }
  } catch {
    // Graceful resilience: surface delivery status cleanly without crashing OTP endpoint
  }

  return {
    delivered: false,
    provider: payload.channel === "EMAIL" ? "WEBHOOK_SMTP" : "WEBHOOK_SMS",
  };
}
