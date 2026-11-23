import {
  ClinicalMediaListResponseSchema,
  ClinicalMediaObjectResponseSchema,
  LabOrderResponseSchema,
  LabOrdersListResponseSchema,
  PatientInsuranceListResponseSchema,
  PatientInsuranceResponseSchema,
  PatientMedicalProfileResponseSchema,
  PresignedUploadResponseSchema,
  PrescriptionResponseSchema,
  PrescriptionsListResponseSchema,
  VerifyPrescriptionQrResponseSchema,
  VisitNoteResponseSchema,
  VisitNotesListResponseSchema,
  type ClinicalMediaListResponse,
  type ClinicalMediaObjectSummary,
  type CreateLabOrderInput,
  type CreatePatientInsuranceInput,
  type CreatePrescriptionInput,
  type CreateVisitNoteInput,
  type DispensePrescriptionInput,
  type LabOrderResponse,
  type LabOrdersListResponse,
  type PatientInsurancePolicy,
  type PatientMedicalProfile,
  type PresignClinicalUploadInput,
  type PresignedUploadResponse,
  type PrescriptionResponse,
  type PrescriptionsListResponse,
  type UpdateLabOrderStatusInput,
  type UpsertPatientMedicalProfileInput,
  type VerifyPrescriptionQrResponse,
  type VisitNoteResponse,
  type VisitNotesListResponse,
} from "@medisync/contracts";
import { requestTyped, type ApiResult } from "@/shared/api/http-client";

export async function fetchVisitNotes(
  apiBaseUrl: string,
  token: string,
  countryCode?: string | undefined,
): Promise<ApiResult<VisitNotesListResponse>> {
  const qs = countryCode
    ? `?countryCode=${encodeURIComponent(countryCode)}`
    : "";
  return requestTyped(
    `${apiBaseUrl}/v1/clinical/visit-notes${qs}`,
    {
      method: "GET",
      headers: { authorization: `Bearer ${token}` },
    },
    VisitNotesListResponseSchema,
  );
}

export async function createVisitNote(
  apiBaseUrl: string,
  token: string,
  input: CreateVisitNoteInput,
): Promise<ApiResult<VisitNoteResponse>> {
  return requestTyped(
    `${apiBaseUrl}/v1/clinical/visit-notes`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(input),
    },
    VisitNoteResponseSchema,
  );
}

export async function fetchPrescriptions(
  apiBaseUrl: string,
  token: string,
  countryCode?: string | undefined,
): Promise<ApiResult<PrescriptionsListResponse>> {
  const qs = countryCode
    ? `?countryCode=${encodeURIComponent(countryCode)}`
    : "";
  return requestTyped(
    `${apiBaseUrl}/v1/clinical/prescriptions${qs}`,
    {
      method: "GET",
      headers: { authorization: `Bearer ${token}` },
    },
    PrescriptionsListResponseSchema,
  );
}

export async function createPrescription(
  apiBaseUrl: string,
  token: string,
  input: CreatePrescriptionInput,
): Promise<ApiResult<PrescriptionResponse>> {
  return requestTyped(
    `${apiBaseUrl}/v1/clinical/prescriptions`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(input),
    },
    PrescriptionResponseSchema,
  );
}

export async function verifyPrescriptionQr(
  apiBaseUrl: string,
  token: string,
  qrToken: string,
): Promise<ApiResult<VerifyPrescriptionQrResponse>> {
  return requestTyped(
    `${apiBaseUrl}/v1/clinical/prescriptions/verify-qr`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ qrToken }),
    },
    VerifyPrescriptionQrResponseSchema,
  );
}

export async function dispensePrescription(
  apiBaseUrl: string,
  token: string,
  prescriptionId: string,
  input: DispensePrescriptionInput,
): Promise<ApiResult<PrescriptionResponse>> {
  return requestTyped(
    `${apiBaseUrl}/v1/clinical/prescriptions/${encodeURIComponent(prescriptionId)}/dispense`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(input),
    },
    PrescriptionResponseSchema,
  );
}

export async function fetchLabOrders(
  apiBaseUrl: string,
  token: string,
  countryCode?: string | undefined,
): Promise<ApiResult<LabOrdersListResponse>> {
  const qs = countryCode
    ? `?countryCode=${encodeURIComponent(countryCode)}`
    : "";
  return requestTyped(
    `${apiBaseUrl}/v1/clinical/lab-orders${qs}`,
    {
      method: "GET",
      headers: { authorization: `Bearer ${token}` },
    },
    LabOrdersListResponseSchema,
  );
}

export async function createLabOrder(
  apiBaseUrl: string,
  token: string,
  input: CreateLabOrderInput,
): Promise<ApiResult<LabOrderResponse>> {
  return requestTyped(
    `${apiBaseUrl}/v1/clinical/lab-orders`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(input),
    },
    LabOrderResponseSchema,
  );
}

export async function updateLabOrderStatus(
  apiBaseUrl: string,
  token: string,
  labOrderId: string,
  input: UpdateLabOrderStatusInput,
): Promise<ApiResult<LabOrderResponse>> {
  return requestTyped(
    `${apiBaseUrl}/v1/clinical/lab-orders/${encodeURIComponent(labOrderId)}/status`,
    {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(input),
    },
    LabOrderResponseSchema,
  );
}

export async function fetchClinicalMedia(
  apiBaseUrl: string,
  token: string,
  countryCode?: string | undefined,
): Promise<ApiResult<ClinicalMediaListResponse>> {
  const qs = countryCode
    ? `?countryCode=${encodeURIComponent(countryCode)}`
    : "";
  return requestTyped(
    `${apiBaseUrl}/v1/clinical/media${qs}`,
    {
      method: "GET",
      headers: { authorization: `Bearer ${token}` },
    },
    ClinicalMediaListResponseSchema,
  );
}

export async function presignClinicalUpload(
  apiBaseUrl: string,
  token: string,
  input: PresignClinicalUploadInput,
): Promise<ApiResult<PresignedUploadResponse>> {
  return requestTyped(
    `${apiBaseUrl}/v1/clinical/media/presign-upload`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(input),
    },
    PresignedUploadResponseSchema,
  );
}

export async function confirmClinicalMediaUpload(
  apiBaseUrl: string,
  token: string,
  mediaId: string,
): Promise<ApiResult<{ mediaObject: ClinicalMediaObjectSummary }>> {
  return requestTyped(
    `${apiBaseUrl}/v1/clinical/media/${encodeURIComponent(mediaId)}/confirm`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
      },
    },
    ClinicalMediaObjectResponseSchema,
  );
}

export async function fetchPatientMedicalProfile(
  apiBaseUrl: string,
  token: string,
  patientId: string,
): Promise<ApiResult<{ profile: PatientMedicalProfile }>> {
  return requestTyped(
    `${apiBaseUrl}/v1/clinical/patients/${encodeURIComponent(patientId)}/profile`,
    {
      method: "GET",
      headers: { authorization: `Bearer ${token}` },
    },
    PatientMedicalProfileResponseSchema,
  );
}

export async function fetchMyPatientProfile(
  apiBaseUrl: string,
  token: string,
): Promise<ApiResult<{ profile: PatientMedicalProfile }>> {
  return requestTyped(
    `${apiBaseUrl}/v1/clinical/patients/me/profile`,
    {
      method: "GET",
      headers: { authorization: `Bearer ${token}` },
    },
    PatientMedicalProfileResponseSchema,
  );
}

export async function updateMyPatientProfile(
  apiBaseUrl: string,
  token: string,
  input: UpsertPatientMedicalProfileInput,
): Promise<ApiResult<{ profile: PatientMedicalProfile }>> {
  return requestTyped(
    `${apiBaseUrl}/v1/clinical/patients/me/profile`,
    {
      method: "PUT",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(input),
    },
    PatientMedicalProfileResponseSchema,
  );
}

export async function listMyPatientInsurances(
  apiBaseUrl: string,
  token: string,
): Promise<ApiResult<{ policies: PatientInsurancePolicy[] }>> {
  return requestTyped(
    `${apiBaseUrl}/v1/clinical/patients/me/insurances`,
    {
      method: "GET",
      headers: { authorization: `Bearer ${token}` },
    },
    PatientInsuranceListResponseSchema,
  );
}

export async function createMyPatientInsurance(
  apiBaseUrl: string,
  token: string,
  input: CreatePatientInsuranceInput,
): Promise<ApiResult<{ policy: PatientInsurancePolicy }>> {
  return requestTyped(
    `${apiBaseUrl}/v1/clinical/patients/me/insurances`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(input),
    },
    PatientInsuranceResponseSchema,
  );
}
