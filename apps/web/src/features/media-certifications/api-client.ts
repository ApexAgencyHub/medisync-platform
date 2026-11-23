import {
  AdminUserMediaListResponseSchema,
  AuthenticatedUserSchema,
  ClinicalMediaObjectResponseSchema,
  DeleteUserMediaResponseSchema,
  FacilityMediaDocumentResponseSchema,
  FacilityMediaListResponseSchema,
  FacilityPresignedUploadResponseSchema,
  PresignClinicalUploadSchema,
  PresignFacilityMediaSchema,
  PresignUserMediaSchema,
  PresignedUploadResponseSchema,
  UserMediaDocumentResponseSchema,
  UserMediaListResponseSchema,
  UserPresignedUploadResponseSchema,
  type AdminFacilityMediaQuery,
  type AdminUserMediaListResponse,
  type AdminUserMediaQuery,
  type ClinicalMediaCategory,
  type ClinicalMediaObjectResponse,
  type ClinicalMediaMimeType,
  type CertificationMimeType,
  type DeleteUserMediaResponse,
  type FacilityMediaCategory,
  type FacilityMediaDocumentResponse,
  type FacilityMediaListResponse,
  type FacilityPresignedUploadResponse,
  type PresignClinicalUploadInput,
  type PresignedUploadResponse,
  type ReviewFacilityDocumentInput,
  type UserMediaCategory,
  type UserMediaDocumentResponse,
  type UserMediaListResponse,
  type UserPresignedUploadResponse,
} from "@medisync/contracts";
import { requestTyped, type ApiResult } from "@/shared/api/http-client";

export interface BinaryUploadResult {
  ok: boolean;
  error?: string;
}

export function uploadBinaryToPresignedUrl(
  uploadUrl: string,
  file: File,
  requiredHeaders: Record<string, string>,
  onProgress?: (percent: number) => void,
): Promise<BinaryUploadResult> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", uploadUrl, true);

    for (const [key, value] of Object.entries(requiredHeaders)) {
      xhr.setRequestHeader(key, value);
    }

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress?.(100);
        resolve({ ok: true });
      } else {
        resolve({
          ok: false,
          error: `Object storage upload failed (HTTP ${xhr.status}).`,
        });
      }
    };

    xhr.onerror = () => {
      resolve({
        ok: false,
        error:
          "Network error while uploading the document. Please retry.",
      });
    };

    xhr.send(file);
  });
}

export function confirmClinicalUpload(
  apiBaseUrl: string,
  token: string,
  mediaId: string,
): Promise<ApiResult<ClinicalMediaObjectResponse>> {
  return requestTyped(
    `${apiBaseUrl}/v1/clinical/media/${mediaId}/confirm`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
      },
    },
    ClinicalMediaObjectResponseSchema,
  );
}

export async function uploadClinicalMediaEndToEnd(params: {
  apiBaseUrl: string;
  token: string;
  patientUserId: string;
  labOrderId?: string;
  mediaCategory?: ClinicalMediaCategory;
  file: File;
  mimeType: ClinicalMediaMimeType;
  onProgress?: (percent: number) => void;
}): Promise<{
  ok: true;
  presigned: PresignedUploadResponse;
  confirmed: ClinicalMediaObjectResponse;
} | { ok: false; error: string }> {
  const input: PresignClinicalUploadInput = {
    patientUserId: params.patientUserId,
    ...(params.labOrderId ? { labOrderId: params.labOrderId } : {}),
    ...(params.mediaCategory ? { mediaCategory: params.mediaCategory } : {}),
    fileName: params.file.name,
    mimeType: params.mimeType,
    sizeBytes: params.file.size,
  };

  const valid = PresignClinicalUploadSchema.safeParse(input);
  if (!valid.success) {
    return {
      ok: false,
      error: valid.error.issues[0]?.message ?? "Invalid clinical file input.",
    };
  }

  const presignRes = await requestTyped(
    `${params.apiBaseUrl}/v1/clinical/media/presign-upload`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${params.token}`,
      },
      body: JSON.stringify(valid.data),
    },
    PresignedUploadResponseSchema,
  );

  if (!presignRes.ok) {
    return { ok: false, error: presignRes.error };
  }

  const putRes = await uploadBinaryToPresignedUrl(
    presignRes.data.uploadUrl,
    params.file,
    presignRes.data.requiredHeaders,
    params.onProgress,
  );

  if (!putRes.ok) {
    return {
      ok: false,
      error: putRes.error ?? "Document transfer failed. Please retry.",
    };
  }

  const confirmRes = await confirmClinicalUpload(
    params.apiBaseUrl,
    params.token,
    presignRes.data.mediaObject.id,
  );

  if (!confirmRes.ok) {
    return { ok: false, error: confirmRes.error };
  }

  return {
    ok: true,
    presigned: presignRes.data,
    confirmed: confirmRes.data,
  };
}

export async function uploadFacilityMediaEndToEnd(params: {
  apiBaseUrl: string;
  token: string;
  facilityId: string;
  category: FacilityMediaCategory;
  file: File;
  mimeType: CertificationMimeType;
  onProgress?: (percent: number) => void;
}): Promise<{
  ok: true;
  presigned: FacilityPresignedUploadResponse;
  confirmed: FacilityMediaDocumentResponse;
} | { ok: false; error: string }> {
  const valid = PresignFacilityMediaSchema.safeParse({
    category: params.category,
    fileName: params.file.name,
    mimeType: params.mimeType,
    sizeBytes: params.file.size,
  });

  if (!valid.success) {
    return {
      ok: false,
      error: valid.error.issues[0]?.message ?? "Invalid facility document.",
    };
  }

  const presignRes = await requestTyped(
    `${params.apiBaseUrl}/v1/facilities/${params.facilityId}/media/presign-upload`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${params.token}`,
      },
      body: JSON.stringify(valid.data),
    },
    FacilityPresignedUploadResponseSchema,
  );

  if (!presignRes.ok) {
    return { ok: false, error: presignRes.error };
  }

  const putRes = await uploadBinaryToPresignedUrl(
    presignRes.data.uploadUrl,
    params.file,
    presignRes.data.requiredHeaders,
    params.onProgress,
  );

  if (!putRes.ok) {
    return {
      ok: false,
      error: putRes.error ?? "Document upload failed. Please retry.",
    };
  }

  const confirmRes = await requestTyped(
    `${params.apiBaseUrl}/v1/facilities/${params.facilityId}/media/${presignRes.data.document.id}/confirm`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${params.token}`,
      },
    },
    FacilityMediaDocumentResponseSchema,
  );

  if (!confirmRes.ok) {
    return { ok: false, error: confirmRes.error };
  }

  return {
    ok: true,
    presigned: presignRes.data,
    confirmed: confirmRes.data,
  };
}

export function listFacilityMedia(
  apiBaseUrl: string,
  token: string,
  facilityId: string,
): Promise<ApiResult<FacilityMediaListResponse>> {
  return requestTyped(
    `${apiBaseUrl}/v1/facilities/${facilityId}/media`,
    {
      method: "GET",
      headers: {
        authorization: `Bearer ${token}`,
      },
    },
    FacilityMediaListResponseSchema,
  );
}

export function listAdminFacilityMedia(
  apiBaseUrl: string,
  token: string,
  query: Partial<AdminFacilityMediaQuery> = {},
): Promise<ApiResult<FacilityMediaListResponse>> {
  const params = new URLSearchParams();
  if (query.countryCode) params.set("countryCode", query.countryCode);
  if (query.facilityId) params.set("facilityId", query.facilityId);
  if (query.reviewStatus) params.set("reviewStatus", query.reviewStatus);
  if (query.limit) params.set("limit", String(query.limit));
  const qs = params.toString();

  return requestTyped(
    `${apiBaseUrl}/v1/admin/facility-media${qs ? `?${qs}` : ""}`,
    {
      method: "GET",
      headers: {
        authorization: `Bearer ${token}`,
      },
    },
    FacilityMediaListResponseSchema,
  );
}

export function reviewFacilityMediaDocument(
  apiBaseUrl: string,
  token: string,
  mediaId: string,
  input: ReviewFacilityDocumentInput,
): Promise<ApiResult<FacilityMediaDocumentResponse>> {
  return requestTyped(
    `${apiBaseUrl}/v1/admin/facility-media/${mediaId}/review`,
    {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(input),
    },
    FacilityMediaDocumentResponseSchema,
  );
}

export async function uploadUserMediaEndToEnd(params: {
  apiBaseUrl: string;
  token: string;
  category: UserMediaCategory;
  file: File;
  mimeType: CertificationMimeType;
  onProgress?: (percent: number) => void;
}): Promise<{
  ok: true;
  presigned: UserPresignedUploadResponse;
  confirmed: UserMediaDocumentResponse;
} | { ok: false; error: string }> {
  const valid = PresignUserMediaSchema.safeParse({
    category: params.category,
    fileName: params.file.name,
    mimeType: params.mimeType,
    sizeBytes: params.file.size,
  });

  if (!valid.success) {
    return {
      ok: false,
      error: valid.error.issues[0]?.message ?? "Invalid profile/credential file.",
    };
  }

  const presignRes = await requestTyped(
    `${params.apiBaseUrl}/v1/users/me/media/presign-upload`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${params.token}`,
      },
      body: JSON.stringify(valid.data),
    },
    UserPresignedUploadResponseSchema,
  );

  if (!presignRes.ok) {
    return { ok: false, error: presignRes.error };
  }

  const putRes = await uploadBinaryToPresignedUrl(
    presignRes.data.uploadUrl,
    params.file,
    presignRes.data.requiredHeaders,
    params.onProgress,
  );

  if (!putRes.ok) {
    return {
      ok: false,
      error: putRes.error ?? "Document upload failed. Please retry.",
    };
  }

  const confirmRes = await requestTyped(
    `${params.apiBaseUrl}/v1/users/me/media/${presignRes.data.document.id}/confirm`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${params.token}`,
      },
    },
    UserMediaDocumentResponseSchema,
  );

  if (!confirmRes.ok) {
    return { ok: false, error: confirmRes.error };
  }

  return {
    ok: true,
    presigned: presignRes.data,
    confirmed: confirmRes.data,
  };
}

export function listMyUserMedia(
  apiBaseUrl: string,
  token: string,
): Promise<ApiResult<UserMediaListResponse>> {
  return requestTyped(
    `${apiBaseUrl}/v1/users/me/media`,
    {
      method: "GET",
      headers: {
        authorization: `Bearer ${token}`,
      },
    },
    UserMediaListResponseSchema,
  );
}

export function listAllAdminUserMedia(
  apiBaseUrl: string,
  token: string,
  query: Partial<AdminUserMediaQuery> = {},
): Promise<ApiResult<AdminUserMediaListResponse>> {
  const qs = new URLSearchParams();
  if (query.countryCode) qs.set("countryCode", query.countryCode);
  if (query.userId) qs.set("userId", query.userId);
  if (query.reviewStatus) qs.set("reviewStatus", query.reviewStatus);
  if (query.category) qs.set("category", query.category);
  if (query.limit) qs.set("limit", String(query.limit));
  const suffix = qs.toString() ? `?${qs.toString()}` : "";

  return requestTyped(
    `${apiBaseUrl}/v1/admin/user-media${suffix}`,
    {
      method: "GET",
      headers: {
        authorization: `Bearer ${token}`,
      },
    },
    AdminUserMediaListResponseSchema,
  );
}

export function listAdminUserMedia(
  apiBaseUrl: string,
  token: string,
  userId: string,
): Promise<ApiResult<UserMediaListResponse>> {
  return requestTyped(
    `${apiBaseUrl}/v1/admin/users/${userId}/media`,
    {
      method: "GET",
      headers: {
        authorization: `Bearer ${token}`,
      },
    },
    UserMediaListResponseSchema,
  );
}

export function deleteMyUserMedia(
  apiBaseUrl: string,
  token: string,
  mediaId: string,
): Promise<ApiResult<DeleteUserMediaResponse>> {
  return requestTyped(
    `${apiBaseUrl}/v1/users/me/media/${encodeURIComponent(mediaId)}`,
    {
      method: "DELETE",
      headers: {
        authorization: `Bearer ${token}`,
      },
    },
    DeleteUserMediaResponseSchema,
  );
}

export function reviewUserMediaDocument(
  apiBaseUrl: string,
  token: string,
  mediaId: string,
  input: ReviewFacilityDocumentInput,
): Promise<ApiResult<UserMediaDocumentResponse>> {
  return requestTyped(
    `${apiBaseUrl}/v1/admin/user-media/${mediaId}/review`,
    {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(input),
    },
    UserMediaDocumentResponseSchema,
  );
}

export function inferUploadMimeType(
  file: File,
  allowedMimes: readonly string[],
): string | null {
  if (file.type && allowedMimes.includes(file.type)) {
    return file.type;
  }
  const lower = file.name.toLowerCase();
  if (lower.endsWith(".pdf") && allowedMimes.includes("application/pdf")) {
    return "application/pdf";
  }
  if (lower.endsWith(".png") && allowedMimes.includes("image/png")) {
    return "image/png";
  }
  if (
    (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) &&
    allowedMimes.includes("image/jpeg")
  ) {
    return "image/jpeg";
  }
  if (lower.endsWith(".webp") && allowedMimes.includes("image/webp")) {
    return "image/webp";
  }
  if (lower.endsWith(".dcm") && allowedMimes.includes("application/dicom")) {
    return "application/dicom";
  }
  return null;
}

export function refreshCurrentUserSession(
  apiBaseUrl: string,
  token: string,
) {
  return requestTyped(
    `${apiBaseUrl}/v1/auth/me`,
    {
      method: "GET",
      headers: {
        authorization: `Bearer ${token}`,
      },
    },
    AuthenticatedUserSchema.transform((user) => ({ user })),
  );
}
