import type { LocaleCode } from "@medisync/contracts";
import {
  MOROCCAN_CITIES_CATALOG,
  MOROCCAN_REGIONS,
  expandMoroccanCityKeywords,
  findMoroccanCity,
  matchesMoroccanCity,
  normalizeLocationText,
  searchMoroccanLocations,
  type MoroccanCityDefinition,
  type MoroccanLocationMatch,
  type MoroccanPlaceDefinition,
  type MoroccanRegionCode,
  type MoroccanRegionDefinition,
} from "@medisync/country-packs";

export {
  MOROCCAN_CITIES_CATALOG,
  MOROCCAN_REGIONS,
  expandMoroccanCityKeywords,
  findMoroccanCity,
  matchesMoroccanCity,
  normalizeLocationText,
  searchMoroccanLocations,
  type MoroccanCityDefinition,
  type MoroccanLocationMatch,
  type MoroccanPlaceDefinition,
  type MoroccanRegionCode,
  type MoroccanRegionDefinition,
};

export interface MoroccanCityPreset {
  id: string;
  name: string;
  aliases: readonly string[];
  labels: Record<LocaleCode, string>;
  lat: number;
  lng: number;
  region: string;
  regionCode: MoroccanRegionCode;
  isMajorHub?: boolean;
}

export const MOROCCAN_CITIES: readonly MoroccanCityPreset[] =
  MOROCCAN_CITIES_CATALOG.map((city) => ({
    id: city.id,
    name: city.name,
    aliases: city.aliases,
    labels: city.labels,
    lat: city.lat,
    lng: city.lng,
    region: city.region,
    regionCode: city.regionCode,
    ...(city.isMajorHub ? { isMajorHub: true } : {}),
  }));

export function normalizeCityText(value: string): string {
  return normalizeLocationText(value);
}

export function isNursingSpecialty(value: string | null | undefined): boolean {
  if (!value) return false;
  return /nursing|infirmier|nurse|تمريض|ممرض/i.test(value);
}

export function matchesAccentInsensitiveQuery(
  rawQuery: string,
  fields: readonly (string | null | undefined)[],
): boolean {
  const normalized = normalizeLocationText(rawQuery);
  if (!normalized) return true;
  const tokens = normalized.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return true;
  const haystack = fields
    .filter((f): f is string => typeof f === "string" && f.length > 0)
    .map(normalizeLocationText)
    .join(" ");
  if (!haystack) return false;
  return tokens.every((token) => haystack.includes(token));
}

export interface MoroccanInsurerPreset {
  code: string;
  providerName: string;
  planType: "AMO_CNSS" | "MUTUELLE" | "PRIVATE";
  defaultCoveragePercent: number;
  labels: Record<LocaleCode, string>;
}

export const MOROCCAN_INSURERS: readonly MoroccanInsurerPreset[] = [
  {
    code: "CNSS",
    providerName: "CNSS / AMO",
    planType: "AMO_CNSS",
    defaultCoveragePercent: 70,
    labels: { en: "CNSS / AMO", fr: "CNSS / AMO", ar: "الضمان الاجتماعي AMO" },
  },
  {
    code: "CNOPS",
    providerName: "CNOPS",
    planType: "AMO_CNSS",
    defaultCoveragePercent: 80,
    labels: { en: "CNOPS", fr: "CNOPS", ar: "كنوبس CNOPS" },
  },
  {
    code: "AMO_TADAMON",
    providerName: "AMO Tadamon",
    planType: "AMO_CNSS",
    defaultCoveragePercent: 100,
    labels: { en: "AMO Tadamon", fr: "AMO Tadamon", ar: "أمو تضامن" },
  },
  {
    code: "AXA",
    providerName: "AXA Assurance Maroc",
    planType: "PRIVATE",
    defaultCoveragePercent: 85,
    labels: { en: "AXA Maroc", fr: "AXA Maroc", ar: "أكسا المغرب" },
  },
  {
    code: "RMA",
    providerName: "RMA Assurance",
    planType: "PRIVATE",
    defaultCoveragePercent: 85,
    labels: { en: "RMA", fr: "RMA", ar: "آر إم إيه RMA" },
  },
  {
    code: "WAFA",
    providerName: "Wafa Assurance",
    planType: "PRIVATE",
    defaultCoveragePercent: 85,
    labels: { en: "Wafa Assurance", fr: "Wafa Assurance", ar: "وفا للتأمين" },
  },
  {
    code: "SANLAM",
    providerName: "Sanlam Maroc",
    planType: "MUTUELLE",
    defaultCoveragePercent: 80,
    labels: { en: "Sanlam Maroc", fr: "Sanlam Maroc", ar: "سانلام المغرب" },
  },
] as const;

export interface MoroccanFormularyItem {
  id: string;
  label: string;
  medication: string;
  dosage: string;
  frequency: string;
  durationDays: number;
  note: string;
  allergenKeywords?: readonly string[];
}

export const MOROCCAN_FORMULARY_PRESETS: readonly MoroccanFormularyItem[] = [
  {
    id: "doliprane",
    label: "Doliprane 1g",
    medication: "Doliprane (Paracétamol) 1000mg",
    dosage: "1 comprimé",
    frequency: "Toutes les 8 heures (max 3g/j)",
    durationDays: 5,
    note: "En cas de douleur ou fièvre. Loi 17-04 : substitution générique DCI autorisée.",
  },
  {
    id: "augmentin",
    label: "Augmentin 1g",
    medication: "Augmentin (Amoxicilline / Ac. clavulanique) 1g",
    dosage: "1 sachet / comprimé",
    frequency: "Matin et soir au repas",
    durationDays: 7,
    note: "Terminer le traitement complet. Contre-indiqué si allergie Pénicilline.",
    allergenKeywords: ["penicillin", "pénicilline", "amoxicillin", "amoxicilline", "beta-lactam"],
  },
  {
    id: "amlor",
    label: "Amlor 5mg",
    medication: "Amlor (Amlodipine) 5mg",
    dosage: "1 gélule",
    frequency: "1 fois par jour le matin",
    durationDays: 30,
    note: "Suivi tensionnel régulier recommandé.",
  },
  {
    id: "omeprazole",
    label: "Oméprazole 20mg",
    medication: "Oméprazole 20mg (IPP)",
    dosage: "1 gélule",
    frequency: "1 fois par jour avant petit-déjeuner",
    durationDays: 14,
    note: "À prendre 30 min avant le repas.",
  },
  {
    id: "glucophage",
    label: "Glucophage 850mg",
    medication: "Glucophage (Metformine) 850mg",
    dosage: "1 comprimé",
    frequency: "Matin et soir pendant les repas",
    durationDays: 30,
    note: "Contrôle HbA1c trimestriel recommandé.",
  },
  {
    id: "ventoline",
    label: "Ventoline 100µg",
    medication: "Ventoline (Salbutamol) 100µg Spray",
    dosage: "2 bouffées",
    frequency: "Si dyspnée ou crise d'asthme",
    durationDays: 30,
    note: "Consulter en urgence (SAMU 141) si absence d'amélioration.",
  },
] as const;

export const MOROCCAN_TARIFF_PRESETS_MAD = [200, 250, 300, 350, 400, 500] as const;

export const MOROCCAN_CHRONIC_CONDITION_PRESETS: readonly {
  canonical: string;
  labels: Record<LocaleCode, string>;
}[] = [
  {
    canonical: "Hypertension",
    labels: { en: "Hypertension", fr: "Hypertension (HTA)", ar: "ارتفاع ضغط الدم" },
  },
  {
    canonical: "Type 2 Diabetes",
    labels: { en: "Diabetes (Type 2)", fr: "Diabète Type 2", ar: "السكري النوع 2" },
  },
  {
    canonical: "Asthma",
    labels: { en: "Asthma", fr: "Asthme", ar: "الربو" },
  },
  {
    canonical: "Thyroid Disorder",
    labels: { en: "Thyroid", fr: "Thyroïde", ar: "الغدة الدرقية" },
  },
  {
    canonical: "Cardiovascular",
    labels: { en: "Cardiac", fr: "Cardiaque", ar: "أمراض القلب" },
  },
  {
    canonical: "Chronic Kidney Disease",
    labels: { en: "Renal", fr: "Rénal", ar: "قصور كلوي" },
  },
] as const;

export const MOROCCAN_SPECIALTY_CHIPS: readonly {
  value: string;
  labels: Record<LocaleCode, string>;
}[] = [
  { value: "General Medicine", labels: { en: "General Medicine", fr: "Médecine Générale", ar: "الطب العام" } },
  { value: "Cardiology", labels: { en: "Cardiology", fr: "Cardiologie", ar: "أمراض القلب" } },
  { value: "Pediatrics", labels: { en: "Pediatrics", fr: "Pédiatrie", ar: "طب الأطفال" } },
  { value: "Gynecology", labels: { en: "Gynecology", fr: "Gynécologie", ar: "أمراض النساء" } },
  { value: "Dermatology", labels: { en: "Dermatology", fr: "Dermatologie", ar: "الأمراض الجلدية" } },
  { value: "Orthopedics", labels: { en: "Orthopedics", fr: "Orthopédie", ar: "جراحة العظام" } },
  { value: "Ophthalmology", labels: { en: "Ophthalmology", fr: "Ophtalmologie", ar: "طب العيون" } },
  { value: "Dentistry", labels: { en: "Dentistry", fr: "Chirurgie Dentaire", ar: "طب الأسنان" } },
] as const;

export type MoroccanComplianceDomain =
  | "doctor"
  | "telehealth"
  | "nurse"
  | "lab"
  | "pharmacy"
  | "hospital"
  | "driver"
  | "patient"
  | "admin";

export const MOROCCAN_REGULATION_BADGES: Record<
  MoroccanComplianceDomain,
  Record<LocaleCode, string>
> = {
  doctor: {
    en: "Law 131-13 · CNOM / INPE · CNDP 09-08",
    fr: "Loi 131-13 · CNOM / INPE · CNDP 09-08",
    ar: "قانون 131-13 · الهيئة الوطنية للأطباء · قانون 09-08",
  },
  telehealth: {
    en: "Decree 2-18-378 · Moroccan Telemedicine · CNDP 09-08",
    fr: "Décret 2-18-378 · Télémédecine Maroc · CNDP 09-08",
    ar: "مرسوم 2-18-378 · التطبيب عن بُعد بالمغرب · CNDP 09-08",
  },
  nurse: {
    en: "Law 43-13 · Nursing Practice · Physician-Only E-Rx",
    fr: "Loi 43-13 · Soins Infirmiers · Ordonnance réservée au médecin",
    ar: "قانون 43-13 · مهنة التمريض · الوصفات للطبيب فقط",
  },
  lab: {
    en: "Law 12-01 · Medical Biology Lab · NM ISO 15189",
    fr: "Loi 12-01 · Laboratoire de Biologie · NM ISO 15189",
    ar: "قانون 12-01 · مختبرات التحاليل الطبية · NM ISO 15189",
  },
  pharmacy: {
    en: "Law 17-04 · In-Person Rx Dispensing · PPV MAD",
    fr: "Loi 17-04 · Délivrance Rx au comptoir · PPV MAD",
    ar: "قانون 17-04 · صرف الوصفات بالصيدلية فقط · PPV بالدرهم",
  },
  hospital: {
    en: "Law 131-13 · ANAM / AMO / CNSS / CNOPS · SAMU 141",
    fr: "Loi 131-13 · ANAM / AMO / CNSS / CNOPS · SAMU 141",
    ar: "قانون 131-13 · التأمين الإجباري AMO / CNSS / CNOPS · 141",
  },
  driver: {
    en: "SAMU 141 Transport · Law 17-04 OTC/Parapharma Only",
    fr: "Transport Sanitaire 141 · Loi 17-04 Parapharmacie uniquement",
    ar: "النقل الطبي 141 · توصيل شبه الصيدلية فقط (قانون 17-04)",
  },
  patient: {
    en: "CNDP Law 09-08 · AMO / CNSS / CNOPS · SAMU 141",
    fr: "Loi CNDP 09-08 · AMO / CNSS / CNOPS · SAMU 141",
    ar: "قانون حماية المعطيات 09-08 · AMO / CNSS / CNOPS · 141",
  },
  admin: {
    en: "CNDP 09-08 · Law 131-13 · Law 17-04 · Law 12-01",
    fr: "CNDP 09-08 · Loi 131-13 · Loi 17-04 · Loi 12-01",
    ar: "الامتثال المغربي · 09-08 · 131-13 · 17-04 · 12-01",
  },
};
