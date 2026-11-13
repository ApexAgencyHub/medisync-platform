import {
  AppointmentResponseSchema,
  AppointmentsListResponseSchema,
  DoctorProfileResponseSchema,
  DoctorProfilesListResponseSchema,
  ScheduleResponseSchema,
  SchedulesListResponseSchema,
  SlotsListResponseSchema,
  type AppointmentResponse,
  type AppointmentsListResponse,
  type CreateAppointmentInput,
  type CreateScheduleInput,
  type DoctorProfileResponse,
  type DoctorProfilesListResponse,
  type ScheduleResponse,
  type SchedulesListResponse,
  type SlotsListResponse,
  type TransitionAppointmentStatusInput,
  type UpsertDoctorProfileInput,
  type VisitMode,
} from "@medisync/contracts";
import { requestTyped, type ApiResult } from "@/shared/api/http-client";

export async function fetchDoctorProfiles(
  apiBaseUrl: string,
  countryCode?: string,
): Promise<ApiResult<DoctorProfilesListResponse>> {
  const qs = countryCode
    ? `?countryCode=${encodeURIComponent(countryCode)}`
    : "";
  return requestTyped(
    `${apiBaseUrl}/v1/booking/profiles${qs}`,
    { method: "GET" },
    DoctorProfilesListResponseSchema,
  );
}

export async function upsertDoctorProfile(
  apiBaseUrl: string,
  token: string,
  input: UpsertDoctorProfileInput,
): Promise<ApiResult<DoctorProfileResponse>> {
  return requestTyped(
    `${apiBaseUrl}/v1/booking/profiles`,
    {
      method: "PUT",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(input),
    },
    DoctorProfileResponseSchema,
  );
}

export async function fetchSchedules(
  apiBaseUrl: string,
  query: {
    countryCode?: string | undefined;
    facilityId?: string | undefined;
    doctorUserId?: string | undefined;
  },
): Promise<ApiResult<SchedulesListResponse>> {
  const params = new URLSearchParams();
  if (query.countryCode) params.set("countryCode", query.countryCode);
  if (query.facilityId) params.set("facilityId", query.facilityId);
  if (query.doctorUserId) params.set("doctorUserId", query.doctorUserId);
  const qs = params.toString();

  return requestTyped(
    `${apiBaseUrl}/v1/booking/schedules${qs ? `?${qs}` : ""}`,
    { method: "GET" },
    SchedulesListResponseSchema,
  );
}

export async function createSchedule(
  apiBaseUrl: string,
  token: string,
  input: CreateScheduleInput,
): Promise<ApiResult<ScheduleResponse>> {
  return requestTyped(
    `${apiBaseUrl}/v1/booking/schedules`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(input),
    },
    ScheduleResponseSchema,
  );
}

export async function fetchAvailableSlots(
  apiBaseUrl: string,
  query: {
    date: string;
    countryCode?: string | undefined;
    facilityId?: string | undefined;
    doctorUserId?: string | undefined;
    specialty?: string | undefined;
    visitMode?: VisitMode | undefined;
    includeBooked?: boolean | undefined;
  },
): Promise<ApiResult<SlotsListResponse>> {
  const params = new URLSearchParams();
  params.set("date", query.date);
  if (query.countryCode) params.set("countryCode", query.countryCode);
  if (query.facilityId) params.set("facilityId", query.facilityId);
  if (query.doctorUserId) params.set("doctorUserId", query.doctorUserId);
  if (query.specialty) params.set("specialty", query.specialty);
  if (query.visitMode) params.set("visitMode", query.visitMode);
  if (query.includeBooked !== undefined) {
    params.set("includeBooked", String(query.includeBooked));
  }

  return requestTyped(
    `${apiBaseUrl}/v1/booking/slots?${params.toString()}`,
    { method: "GET" },
    SlotsListResponseSchema,
  );
}

export async function fetchAppointments(
  apiBaseUrl: string,
  token: string,
  countryCode?: string,
): Promise<ApiResult<AppointmentsListResponse>> {
  const qs = countryCode
    ? `?countryCode=${encodeURIComponent(countryCode)}`
    : "";
  return requestTyped(
    `${apiBaseUrl}/v1/booking/appointments${qs}`,
    {
      method: "GET",
      headers: { authorization: `Bearer ${token}` },
    },
    AppointmentsListResponseSchema,
  );
}

export async function createAppointment(
  apiBaseUrl: string,
  token: string,
  input: CreateAppointmentInput,
): Promise<ApiResult<AppointmentResponse>> {
  return requestTyped(
    `${apiBaseUrl}/v1/booking/appointments`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(input),
    },
    AppointmentResponseSchema,
  );
}

export async function transitionAppointmentStatus(
  apiBaseUrl: string,
  token: string,
  appointmentId: string,
  input: TransitionAppointmentStatusInput,
): Promise<ApiResult<AppointmentResponse>> {
  return requestTyped(
    `${apiBaseUrl}/v1/booking/appointments/${encodeURIComponent(appointmentId)}/status`,
    {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(input),
    },
    AppointmentResponseSchema,
  );
}
