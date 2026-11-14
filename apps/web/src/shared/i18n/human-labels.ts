/** Human-readable display formatters keeping domain enums friendly for non-engineers. */

const ROLE_LABELS: Record<string, string> = {
  PATIENT: "Patient",
  CAREGIVER: "Family Caregiver",
  DOCTOR: "Doctor",
  CLINIC_STAFF: "Clinic Staff",
  HOSPITAL_ADMIN: "Hospital Coordinator",
  DRIVER: "Medical Transport",
  PHARMACIST: "Pharmacist",
  LAB_TECH: "Diagnostic Lab",
  OPS_ADMIN: "Operations Support",
};

const FACILITY_KIND_LABELS: Record<string, string> = {
  HOSPITAL: "Hospital",
  CLINIC: "Clinic",
  PHARMACY: "Pharmacy",
  DIAGNOSTIC_LAB: "Diagnostic Lab",
};

const OPEN_STATUS_LABELS: Record<string, string> = {
  OPEN: "Open Now",
  BUSY: "High Demand",
  CLOSED: "Closed",
};

const DRIVER_STATUS_LABELS: Record<string, string> = {
  AVAILABLE: "Ready Nearby",
  ASSIGNED: "Assigned",
  EN_ROUTE: "En Route",
  OFF_DUTY: "Off Duty",
};

const URGENCY_LABELS: Record<string, string> = {
  ROUTINE: "Routine Transfer",
  URGENT: "Urgent Care",
  EMERGENCY: "Emergency Dispatch",
};

const DISPATCH_STATUS_LABELS: Record<string, string> = {
  REQUESTED: "Requested",
  ASSIGNED: "Driver Assigned",
  EN_ROUTE: "On the Way",
  ARRIVED: "Arrived at Location",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

const MIME_LABELS: Record<string, string> = {
  "application/pdf": "PDF Report (.pdf)",
  "image/png": "PNG Image (.png)",
  "image/jpeg": "JPEG Photo (.jpg)",
  "image/webp": "WebP Image (.webp)",
};

const COVERAGE_HUB_LABELS: Record<string, string> = {
  "ma-casablanca": "Morocco Health Network",
  "fr-paris": "France Health Network",
  "us-east": "United States Health Network",
  "eu-central": "International Health Network",
};

const LANGUAGE_LABELS: Record<string, string> = {
  "ar-MA": "العربية",
  "fr-MA": "Français",
  "fr-FR": "Français",
  "en-US": "English",
  "en-INTL": "English",
  "en-GB": "English",
  en: "English",
  fr: "Français",
  ar: "العربية",
};

const LICENSE_EXAMPLES: Record<string, string> = {
  MA: "MA-CLIN-90812",
  FR: "FR-75-109283",
  US: "US-CA-881209",
  INTL: "INTL-CLIN-1024",
};

const VISIT_MODE_LABELS: Record<string, string> = {
  IN_PERSON: "Clinic Visit",
  TELEHEALTH: "Video Visit",
};

export function formatRoleLabel(role: string | null | undefined): string {
  if (!role) {
    return "Member";
  }
  return ROLE_LABELS[role] ?? role;
}

export function formatFacilityKind(kind: string): string {
  return FACILITY_KIND_LABELS[kind] ?? kind;
}

export function formatOpenStatus(status: string): string {
  return OPEN_STATUS_LABELS[status] ?? status;
}

export function formatDriverStatus(status: string): string {
  return DRIVER_STATUS_LABELS[status] ?? status;
}

export function formatUrgencyLabel(urgency: string): string {
  return URGENCY_LABELS[urgency] ?? urgency;
}

export function formatDispatchStatus(status: string): string {
  return DISPATCH_STATUS_LABELS[status] ?? status;
}

export function formatClinicalFileType(mime: string): string {
  return MIME_LABELS[mime] ?? mime;
}

export function formatCoverageHub(regionSlug: string): string {
  return COVERAGE_HUB_LABELS[regionSlug] ?? regionSlug;
}

export function formatLanguageList(locales: readonly string[]): string {
  const unique = Array.from(
    new Set(locales.map((code) => LANGUAGE_LABELS[code] ?? code)),
  );
  return unique.join(" · ");
}

export function getLicenseExample(countryCode: string): string {
  return LICENSE_EXAMPLES[countryCode] ?? "INTL-CLIN-1024";
}

export function formatVisitMode(mode: string): string {
  return VISIT_MODE_LABELS[mode] ?? mode;
}
