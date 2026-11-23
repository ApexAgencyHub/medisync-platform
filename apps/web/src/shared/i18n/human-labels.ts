import type { LocaleCode } from "@medisync/contracts";

/** Human-readable display formatters keeping domain enums friendly across English, French & Arabic. */

const ROLE_LABELS: Record<string, Record<LocaleCode, string>> = {
  PATIENT: { en: "Patient", fr: "Patient", ar: "مريض" },
  CAREGIVER: { en: "Family Caregiver", fr: "Aidant Familial", ar: "مرافق عائلي" },
  DOCTOR: { en: "Doctor", fr: "Médecin", ar: "طبيب" },
  NURSE: { en: "Nurse / Infirmier", fr: "Infirmier(ère)", ar: "ممرض(ة)" },
  CLINIC_STAFF: { en: "Clinic Staff", fr: "Personnel de Clinique", ar: "طاقم العيادة" },
  HOSPITAL_ADMIN: { en: "Hospital Coordinator", fr: "Coordinateur Hôpital", ar: "منسق المستشفى" },
  DRIVER: { en: "Medical Transport", fr: "Transport Médical", ar: "سائق إسعاف وتوصيل طبي" },
  PHARMACIST: { en: "Pharmacist", fr: "Pharmacien", ar: "صيدلي" },
  LAB_TECH: { en: "Diagnostic Lab", fr: "Technicien de Labo", ar: "تقني مختبر" },
  OPS_ADMIN: { en: "Operations Support", fr: "Support Opérations", ar: "إدارة المنصة" },
};

const FACILITY_KIND_LABELS: Record<string, Record<LocaleCode, string>> = {
  HOSPITAL: { en: "Hospital", fr: "Hôpital", ar: "مستشفى" },
  CLINIC: { en: "Clinic", fr: "Clinique", ar: "عيادة" },
  PHARMACY: { en: "Pharmacy", fr: "Pharmacie", ar: "صيدلية" },
  DIAGNOSTIC_LAB: { en: "Diagnostic Lab", fr: "Laboratoire & Imagerie", ar: "مختبر التحاليل والأشعة" },
};

const OPEN_STATUS_LABELS: Record<string, Record<LocaleCode, string>> = {
  OPEN: { en: "Open Now", fr: "Ouvert", ar: "مفتوح دابا" },
  BUSY: { en: "High Demand", fr: "Forte Affluence", ar: "ضغط مرتفع" },
  CLOSED: { en: "Closed", fr: "Fermé", ar: "مغلق" },
};

const DRIVER_STATUS_LABELS: Record<string, Record<LocaleCode, string>> = {
  AVAILABLE: { en: "Ready Nearby", fr: "Disponible", ar: "متاح قريب" },
  ASSIGNED: { en: "Assigned", fr: "Assigné", ar: "تم التعيين" },
  EN_ROUTE: { en: "En Route", fr: "En Route", ar: "في الطريق" },
  OFF_DUTY: { en: "Off Duty", fr: "Hors Service", ar: "خارج الخدمة" },
};

const URGENCY_LABELS: Record<string, Record<LocaleCode, string>> = {
  ROUTINE: { en: "Routine Transfer", fr: "Transfert Normal", ar: "نقل عادي" },
  URGENT: { en: "Urgent Care", fr: "Soin Urgent", ar: "حالة مستعجلة" },
  EMERGENCY: { en: "Emergency Dispatch", fr: "Urgence Immédiate", ar: "تدخل إسعافي مستعجل" },
};

const DISPATCH_STATUS_LABELS: Record<string, Record<LocaleCode, string>> = {
  REQUESTED: { en: "Requested", fr: "Demandé", ar: "تم الطلب" },
  ASSIGNED: { en: "Driver Assigned", fr: "Chauffeur Assigné", ar: "السائق مكلّف" },
  EN_ROUTE: { en: "On the Way", fr: "En Route", ar: "في الطريق إليك" },
  ARRIVED: { en: "Arrived at Location", fr: "Arrivé sur Place", ar: "وصل للمكان" },
  COMPLETED: { en: "Completed", fr: "Terminé", ar: "مكتمل" },
  CANCELLED: { en: "Cancelled", fr: "Annulé", ar: "ملغى" },
};

const MIME_LABELS: Record<string, Record<LocaleCode, string>> = {
  "application/pdf": {
    en: "PDF Report (.pdf)",
    fr: "Rapport PDF (.pdf)",
    ar: "تقرير PDF",
  },
  "image/png": { en: "PNG Image (.png)", fr: "Image PNG (.png)", ar: "صورة PNG" },
  "image/jpeg": { en: "JPEG Photo (.jpg)", fr: "Photo JPEG (.jpg)", ar: "صورة JPEG" },
  "image/webp": { en: "WebP Image (.webp)", fr: "Image WebP (.webp)", ar: "صورة WebP" },
  "image/tiff": { en: "TIFF Scan (.tiff)", fr: "Scan TIFF (.tiff)", ar: "صورة أشعة TIFF" },
  "image/heic": { en: "HEIC Photo (.heic)", fr: "Photo HEIC (.heic)", ar: "صورة HEIC" },
  "application/dicom": { en: "DICOM Imaging (.dcm)", fr: "Imagerie DICOM (.dcm)", ar: "أشعة طبية DICOM" },
};

const COVERAGE_HUB_LABELS: Record<string, Record<LocaleCode, string>> = {
  "ma-casablanca": {
    en: "Morocco Health Network",
    fr: "Réseau Santé Maroc",
    ar: "شبكة الرعاية الصحية · المغرب",
  },
  "fr-paris": {
    en: "France Health Network",
    fr: "Réseau Santé France",
    ar: "شبكة الرعاية · فرنسا",
  },
  "us-east": {
    en: "United States Health Network",
    fr: "Réseau Santé États-Unis",
    ar: "شبكة الرعاية · الولايات المتحدة",
  },
  "eu-central": {
    en: "International Health Network",
    fr: "Réseau Santé International",
    ar: "الشبكة الصحية الدولية",
  },
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

const VISIT_MODE_LABELS: Record<string, Record<LocaleCode, string>> = {
  IN_PERSON: { en: "Clinic Visit", fr: "Visite au Cabinet", ar: "زيارة فالعيادة" },
  TELEHEALTH: { en: "Video Visit", fr: "Appel Vidéo", ar: "مكالمة فيديو" },
  HOME_VISIT: { en: "Home Visit", fr: "Visite à Domicile", ar: "زيارة منزلية" },
};

const COUNTRY_NAMES: Record<string, Record<LocaleCode, string>> = {
  MA: { en: "Morocco", fr: "Maroc", ar: "المغرب" },
  FR: { en: "France", fr: "France", ar: "فرنسا" },
  US: { en: "United States", fr: "États-Unis", ar: "الولايات المتحدة" },
  INTL: { en: "International", fr: "International", ar: "دولي" },
};

function pickLocaleEntry(
  table: Record<string, Record<LocaleCode, string>>,
  key: string,
  locale: LocaleCode,
): string | undefined {
  const entry = table[key];
  if (!entry) return undefined;
  if (locale === "ar") return entry.ar;
  if (locale === "fr") return entry.fr;
  return entry.en;
}

export function formatRoleLabel(
  role: string | null | undefined,
  locale: LocaleCode = "en",
): string {
  if (!role) {
    return locale === "ar" ? "عضو" : locale === "fr" ? "Membre" : "Member";
  }
  return pickLocaleEntry(ROLE_LABELS, role, locale) ?? role;
}

export function formatFacilityKind(
  kind: string,
  locale: LocaleCode = "en",
): string {
  return pickLocaleEntry(FACILITY_KIND_LABELS, kind, locale) ?? kind;
}

export function formatOpenStatus(
  status: string,
  locale: LocaleCode = "en",
): string {
  return pickLocaleEntry(OPEN_STATUS_LABELS, status, locale) ?? status;
}

export function formatDriverStatus(
  status: string,
  locale: LocaleCode = "en",
): string {
  return pickLocaleEntry(DRIVER_STATUS_LABELS, status, locale) ?? status;
}

export function formatUrgencyLabel(
  urgency: string,
  locale: LocaleCode = "en",
): string {
  return pickLocaleEntry(URGENCY_LABELS, urgency, locale) ?? urgency;
}

export function formatDispatchStatus(
  status: string,
  locale: LocaleCode = "en",
): string {
  return pickLocaleEntry(DISPATCH_STATUS_LABELS, status, locale) ?? status;
}

export function formatClinicalFileType(
  mime: string,
  locale: LocaleCode = "en",
): string {
  return pickLocaleEntry(MIME_LABELS, mime, locale) ?? mime;
}

export function formatCoverageHub(
  regionSlug: string,
  locale: LocaleCode = "en",
): string {
  return pickLocaleEntry(COVERAGE_HUB_LABELS, regionSlug, locale) ?? regionSlug;
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

export function formatVisitMode(
  mode: string,
  locale: LocaleCode = "en",
): string {
  return pickLocaleEntry(VISIT_MODE_LABELS, mode, locale) ?? mode;
}

export function formatCountryDisplayName(
  countryCode: string,
  fallbackName: string,
  locale: LocaleCode = "en",
): string {
  return pickLocaleEntry(COUNTRY_NAMES, countryCode, locale) ?? fallbackName;
}
