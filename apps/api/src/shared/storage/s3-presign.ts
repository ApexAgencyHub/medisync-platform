import crypto from "node:crypto";

export interface S3PresignConfig {
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  expiresInSeconds: number;
}

export const DEFAULT_DEV_S3_CONFIG: S3PresignConfig = {
  endpoint: "https://s3.sovereign.medisync.local",
  region: "auto",
  bucket: "medisync-clinical-media",
  accessKeyId: "medisync-dev-s3-access-key",
  secretAccessKey: "medisync-dev-s3-secret-key-min-32-chars",
  expiresInSeconds: 900,
};

function sha256Hex(value: string): string {
  return crypto.createHash("sha256").update(value, "utf8").digest("hex");
}

function hmacSha256(key: Buffer | string, value: string): Buffer {
  return crypto.createHmac("sha256", key).update(value, "utf8").digest();
}

function encodeRfc3986(value: string): string {
  return encodeURIComponent(value).replace(
    /[!'()*]/g,
    (ch) => `%${ch.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

function encodePathSegments(rawPath: string): string {
  return rawPath
    .split("/")
    .map((segment) => encodeRfc3986(segment))
    .join("/");
}

export function sanitizeUploadFileName(fileName: string): string {
  const cleaned = fileName
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return cleaned.slice(0, 80) || "clinical-document";
}

export function createSigV4PresignedUrl(params: {
  config: S3PresignConfig;
  method: "PUT" | "GET";
  objectKey: string;
  contentType?: string;
  now?: Date;
}): string {
  const { config, method, objectKey, contentType } = params;
  const now = params.now ?? new Date();

  const endpointUrl = new URL(config.endpoint);
  const basePath = endpointUrl.pathname.replace(/\/+$/, "");
  const cleanKey = objectKey.replace(/^\/+/, "");
  const canonicalUri = encodePathSegments(
    `${basePath}/${config.bucket}/${cleanKey}`.replace(/\/+/g, "/"),
  );

  const isoBasic = now
    .toISOString()
    .replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = isoBasic.slice(0, 8);
  const credentialScope = `${dateStamp}/${config.region}/s3/aws4_request`;
  const expires = Math.max(
    60,
    Math.min(86400, Math.floor(config.expiresInSeconds)),
  );

  const hostHeader = endpointUrl.host;
  const signedHeadersMap = new Map<string, string>();
  signedHeadersMap.set("host", hostHeader);
  if (method === "PUT" && contentType) {
    signedHeadersMap.set("content-type", contentType);
  }

  const sortedSignedKeys = [...signedHeadersMap.keys()].sort();
  const canonicalHeaders = sortedSignedKeys
    .map((key) => `${key}:${signedHeadersMap.get(key)!.trim()}\n`)
    .join("");
  const signedHeadersList = sortedSignedKeys.join(";");

  const queryParams: Array<[string, string]> = [
    ["X-Amz-Algorithm", "AWS4-HMAC-SHA256"],
    ["X-Amz-Credential", `${config.accessKeyId}/${credentialScope}`],
    ["X-Amz-Date", isoBasic],
    ["X-Amz-Expires", String(expires)],
    ["X-Amz-SignedHeaders", signedHeadersList],
  ];

  const canonicalQuery = queryParams
    .slice()
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([k, v]) => `${encodeRfc3986(k)}=${encodeRfc3986(v)}`)
    .join("&");

  const canonicalRequest = [
    method,
    canonicalUri,
    canonicalQuery,
    canonicalHeaders,
    signedHeadersList,
    "UNSIGNED-PAYLOAD",
  ].join("\n");

  const stringToSign = [
    "AWS4-HMAC-SHA256",
    isoBasic,
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join("\n");

  const kDate = hmacSha256(`AWS4${config.secretAccessKey}`, dateStamp);
  const kRegion = hmacSha256(kDate, config.region);
  const kService = hmacSha256(kRegion, "s3");
  const kSigning = hmacSha256(kService, "aws4_request");
  const signature = crypto
    .createHmac("sha256", kSigning)
    .update(stringToSign, "utf8")
    .digest("hex");

  return `${endpointUrl.origin}${canonicalUri}?${canonicalQuery}&X-Amz-Signature=${signature}`;
}
