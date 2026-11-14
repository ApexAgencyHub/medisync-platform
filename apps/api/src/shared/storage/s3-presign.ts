import crypto from "node:crypto";

export interface S3PresignConfig {
  endpoint: string;
  publicEndpoint?: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  expiresInSeconds: number;
}

export const DEFAULT_DEV_S3_CONFIG: S3PresignConfig = {
  endpoint: "http://127.0.0.1:9010",
  region: "us-east-1",
  bucket: "medisync-clinical-media",
  accessKeyId: "medisync-dev-s3-access-key",
  secretAccessKey: "medisync-dev-s3-secret-key-min-32-chars",
  expiresInSeconds: 900,
};

export type SupportedBinaryMime =
  | "application/pdf"
  | "image/png"
  | "image/jpeg"
  | "image/webp"
  | "image/tiff"
  | "image/heic"
  | "image/heif"
  | "image/bmp"
  | "image/gif"
  | "application/dicom"
  | "text/plain"
  | "text/csv"
  | "application/json"
  | "application/fhir+json"
  | "audio/wav"
  | "audio/mpeg"
  | "video/mp4";

export class S3ObjectNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "S3ObjectNotFoundError";
  }
}

export class S3InvalidSignatureError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "S3InvalidSignatureError";
  }
}

function sha256Hex(value: string | Buffer): string {
  return crypto.createHash("sha256").update(value).digest("hex");
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

function deriveSigningKey(
  secretAccessKey: string,
  dateStamp: string,
  region: string,
): Buffer {
  const kDate = hmacSha256(`AWS4${secretAccessKey}`, dateStamp);
  const kRegion = hmacSha256(kDate, region);
  const kService = hmacSha256(kRegion, "s3");
  return hmacSha256(kService, "aws4_request");
}

export function sanitizeUploadFileName(fileName: string): string {
  const cleaned = fileName
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return cleaned.slice(0, 80) || "clinical-document";
}

export function detectFileSignature(header: Buffer): SupportedBinaryMime | null {
  if (
    header.length >= 5 &&
    header.subarray(0, 5).toString("ascii") === "%PDF-"
  ) {
    return "application/pdf";
  }

  if (
    header.length >= 8 &&
    header[0] === 0x89 &&
    header[1] === 0x50 &&
    header[2] === 0x4e &&
    header[3] === 0x47 &&
    header[4] === 0x0d &&
    header[5] === 0x0a &&
    header[6] === 0x1a &&
    header[7] === 0x0a
  ) {
    return "image/png";
  }

  if (
    header.length >= 3 &&
    header[0] === 0xff &&
    header[1] === 0xd8 &&
    header[2] === 0xff
  ) {
    return "image/jpeg";
  }

  if (
    header.length >= 12 &&
    header.subarray(0, 4).toString("ascii") === "RIFF" &&
    header.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return "image/webp";
  }

  if (
    header.length >= 12 &&
    header.subarray(0, 4).toString("ascii") === "RIFF" &&
    header.subarray(8, 12).toString("ascii") === "WAVE"
  ) {
    return "audio/wav";
  }

  if (
    header.length >= 6 &&
    (header.subarray(0, 6).toString("ascii") === "GIF87a" ||
      header.subarray(0, 6).toString("ascii") === "GIF89a")
  ) {
    return "image/gif";
  }

  if (header.length >= 2 && header[0] === 0x42 && header[1] === 0x4d) {
    return "image/bmp";
  }

  if (
    header.length >= 4 &&
    ((header[0] === 0x49 &&
      header[1] === 0x49 &&
      header[2] === 0x2a &&
      header[3] === 0x00) ||
      (header[0] === 0x4d &&
        header[1] === 0x4d &&
        header[2] === 0x00 &&
        header[3] === 0x2a))
  ) {
    return "image/tiff";
  }

  if (
    header.length >= 12 &&
    header.subarray(4, 8).toString("ascii") === "ftyp"
  ) {
    const brand = header.subarray(8, 12).toString("ascii");
    if (brand === "heic" || brand === "heix" || brand === "hevc" || brand === "hevx") {
      return "image/heic";
    }
    if (brand === "mif1" || brand === "msf1") {
      return "image/heif";
    }
    if (
      brand === "isom" ||
      brand === "iso2" ||
      brand === "mp41" ||
      brand === "mp42" ||
      brand === "avc1" ||
      brand === "M4V " ||
      brand === "qt  "
    ) {
      return "video/mp4";
    }
  }

  if (
    header.length >= 3 &&
    (header.subarray(0, 3).toString("ascii") === "ID3" ||
      (header[0] === 0xff && (header[1]! & 0xe0) === 0xe0))
  ) {
    return "audio/mpeg";
  }

  if (
    header.length >= 132 &&
    header.subarray(128, 132).toString("ascii") === "DICM"
  ) {
    return "application/dicom";
  }

  return null;
}

const TEXTUAL_CLINICAL_MIMES = new Set<string>([
  "text/plain",
  "text/csv",
  "application/json",
  "application/fhir+json",
]);

function isSafeTextualPayload(sample: Buffer, expectedMimeType: string): boolean {
  if (sample.length === 0) return false;
  for (let i = 0; i < sample.length; i += 1) {
    const byte = sample[i]!;
    // Reject NUL or unsafe binary control chars (allow \t, \n, \r)
    if (byte === 0 || (byte < 0x20 && byte !== 0x09 && byte !== 0x0a && byte !== 0x0d)) {
      return false;
    }
  }
  const text = sample.toString("utf8").trimStart();
  const lowerPrefix = text.slice(0, 64).toLowerCase();
  if (
    lowerPrefix.startsWith("<!doctype") ||
    lowerPrefix.startsWith("<html") ||
    lowerPrefix.startsWith("<script") ||
    lowerPrefix.startsWith("<svg")
  ) {
    return false;
  }
  if (expectedMimeType === "application/json" || expectedMimeType === "application/fhir+json") {
    return text.startsWith("{") || text.startsWith("[");
  }
  return true;
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

  const endpointUrl = new URL(config.publicEndpoint ?? config.endpoint);
  const basePath = endpointUrl.pathname.replace(/\/+$/, "");
  const cleanKey = objectKey.replace(/^\/+/, "");
  const canonicalUri = encodePathSegments(
    `${basePath}/${config.bucket}/${cleanKey}`.replace(/\/+/g, "/"),
  );

  const isoBasic = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
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

  const kSigning = deriveSigningKey(
    config.secretAccessKey,
    dateStamp,
    config.region,
  );
  const signature = crypto
    .createHmac("sha256", kSigning)
    .update(stringToSign, "utf8")
    .digest("hex");

  return `${endpointUrl.origin}${canonicalUri}?${canonicalQuery}&X-Amz-Signature=${signature}`;
}

async function signedS3Request(params: {
  config: S3PresignConfig;
  method: "HEAD" | "PUT" | "GET" | "DELETE";
  pathSuffix: string;
  headers?: Record<string, string>;
  body?: Buffer;
}): Promise<Response> {
  const { config, method, pathSuffix, body } = params;
  const now = new Date();
  const isoBasic = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = isoBasic.slice(0, 8);
  const endpointUrl = new URL(config.endpoint);
  const basePath = endpointUrl.pathname.replace(/\/+$/, "");
  const cleanSuffix = pathSuffix.replace(/^\/+/, "");
  const canonicalUri = encodePathSegments(
    `${basePath}/${config.bucket}${cleanSuffix ? `/${cleanSuffix}` : ""}`.replace(
      /\/+/g,
      "/",
    ),
  );

  const payloadHash = sha256Hex(body ?? Buffer.alloc(0));
  const requestHeaders = new Map<string, string>();
  requestHeaders.set("host", endpointUrl.host);
  requestHeaders.set("x-amz-content-sha256", payloadHash);
  requestHeaders.set("x-amz-date", isoBasic);
  if (params.headers) {
    for (const [k, v] of Object.entries(params.headers)) {
      requestHeaders.set(k.toLowerCase(), v);
    }
  }

  const sortedKeys = [...requestHeaders.keys()].sort();
  const canonicalHeaders = sortedKeys
    .map((key) => `${key}:${requestHeaders.get(key)!.trim()}\n`)
    .join("");
  const signedHeaders = sortedKeys.join(";");

  const canonicalRequest = [
    method,
    canonicalUri,
    "",
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");

  const credentialScope = `${dateStamp}/${config.region}/s3/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    isoBasic,
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join("\n");

  const kSigning = deriveSigningKey(
    config.secretAccessKey,
    dateStamp,
    config.region,
  );
  const signature = crypto
    .createHmac("sha256", kSigning)
    .update(stringToSign, "utf8")
    .digest("hex");

  const authorization = `AWS4-HMAC-SHA256 Credential=${config.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const fetchHeaders: Record<string, string> = {};
  for (const [key, value] of requestHeaders.entries()) {
    if (key !== "host") {
      fetchHeaders[key] = value;
    }
  }
  fetchHeaders.authorization = authorization;

  return fetch(`${endpointUrl.origin}${canonicalUri}`, {
    method,
    headers: fetchHeaders,
    signal: AbortSignal.timeout(4000),
    ...(body ? { body: new Uint8Array(body) } : {}),
  });
}

export async function ensureS3BucketExists(
  config: S3PresignConfig,
): Promise<boolean> {
  try {
    const headRes = await signedS3Request({
      config,
      method: "HEAD",
      pathSuffix: "",
    });
    if (headRes.status === 200) {
      return true;
    }
    if (headRes.status === 404) {
      const putRes = await signedS3Request({
        config,
        method: "PUT",
        pathSuffix: "",
      });
      return putRes.status === 200 || putRes.status === 409;
    }
    return false;
  } catch {
    return false;
  }
}

export async function deleteS3Object(
  config: S3PresignConfig,
  objectKey: string,
): Promise<void> {
  await signedS3Request({
    config,
    method: "DELETE",
    pathSuffix: objectKey,
  }).catch(() => undefined);
}

export async function inspectUploadedS3Object(params: {
  config: S3PresignConfig;
  objectKey: string;
  expectedMimeType: string;
  maxBytes: number;
}): Promise<{
  observedSizeBytes: number;
  detectedMimeType: SupportedBinaryMime;
  sha256Checksum: string;
}> {
  const { config, objectKey, expectedMimeType, maxBytes } = params;

  const headRes = await signedS3Request({
    config,
    method: "HEAD",
    pathSuffix: objectKey,
  });

  if (headRes.status === 404) {
    throw new S3ObjectNotFoundError(
      "Uploaded file was not found in S3/MinIO object storage yet.",
    );
  }
  if (!headRes.ok) {
    throw new Error(`S3 HEAD verification failed with status ${headRes.status}`);
  }

  const lengthHeader = headRes.headers.get("content-length");
  const observedSizeBytes = Number(lengthHeader ?? "0");
  if (!Number.isFinite(observedSizeBytes) || observedSizeBytes <= 0 || observedSizeBytes > maxBytes) {
    await deleteS3Object(config, objectKey);
    throw new S3InvalidSignatureError(
      "Uploaded object size is empty or exceeds the security byte cap.",
    );
  }

  // Range GET inspects header magic bytes while streaming full-object SHA-256 up to 15 MB for integrity.
  const inspectEntireForHash = observedSizeBytes <= 15 * 1024 * 1024;
  const getRes = await signedS3Request({
    config,
    method: "GET",
    pathSuffix: objectKey,
    ...(inspectEntireForHash ? {} : { headers: { range: "bytes=0-1023" } }),
  });

  if (getRes.status !== 200 && getRes.status !== 206) {
    throw new Error(`S3 byte signature read failed with status ${getRes.status}`);
  }

  const hash = crypto.createHash("sha256");
  const headChunks: Buffer[] = [];
  let headBytesCollected = 0;

  if (getRes.body) {
    const reader = getRes.body.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunkBuf = Buffer.from(value);
      hash.update(chunkBuf);
      if (headBytesCollected < 1024) {
        const remaining = 1024 - headBytesCollected;
        headChunks.push(chunkBuf.subarray(0, remaining));
        headBytesCollected += Math.min(remaining, chunkBuf.length);
      }
    }
  } else {
    const raw = Buffer.from(await getRes.arrayBuffer());
    hash.update(raw);
    headChunks.push(raw.subarray(0, 1024));
  }

  const headerBuf = Buffer.concat(headChunks);
  const sha256Checksum = inspectEntireForHash
    ? hash.digest("hex")
    : `partial-${hash.digest("hex").slice(0, 40)}`;

  let detectedMimeType = detectFileSignature(headerBuf);
  if (!detectedMimeType && TEXTUAL_CLINICAL_MIMES.has(expectedMimeType)) {
    if (isSafeTextualPayload(headerBuf, expectedMimeType)) {
      detectedMimeType = expectedMimeType as SupportedBinaryMime;
    }
  }

  const isHeicFamilyMatch =
    (detectedMimeType === "image/heic" || detectedMimeType === "image/heif") &&
    (expectedMimeType === "image/heic" || expectedMimeType === "image/heif");

  if (
    !detectedMimeType ||
    (!isHeicFamilyMatch && detectedMimeType !== expectedMimeType)
  ) {
    await deleteS3Object(config, objectKey);
    throw new S3InvalidSignatureError(
      `Binary signature mismatch: expected ${expectedMimeType}, detected ${detectedMimeType ?? "unknown"}.`,
    );
  }

  return {
    observedSizeBytes,
    detectedMimeType: expectedMimeType as SupportedBinaryMime,
    sha256Checksum,
  };
}

export async function checkS3Health(
  config: S3PresignConfig,
): Promise<{ status: "OK" | "DEGRADED"; bucketReady: boolean }> {
  try {
    const headRes = await signedS3Request({
      config,
      method: "HEAD",
      pathSuffix: "",
    });
    if (headRes.status === 200) {
      return { status: "OK", bucketReady: true };
    }
    if (headRes.status === 404) {
      return { status: "OK", bucketReady: false };
    }
    return { status: "DEGRADED", bucketReady: false };
  } catch {
    return { status: "DEGRADED", bucketReady: false };
  }
}
