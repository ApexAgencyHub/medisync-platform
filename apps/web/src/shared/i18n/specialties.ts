import type { LocaleCode } from "@medisync/contracts";

export interface CanonicalSpecialtyEntry {
  value: string;
  matchTokens: readonly string[];
  en: string;
  fr: string;
  ar: string;
  keywords: string;
  isNurse?: boolean;
}

export const CANONICAL_SPECIALTIES: readonly CanonicalSpecialtyEntry[] = [
  {
    value: "Cardiology",
    matchTokens: ["cardiology", "cardiolog", "heart"],
    en: "Cardiology · Heart & Blood Pressure",
    fr: "Cardiologie · Cœur & Tension",
    ar: "طب القلب وضغط الدم",
    keywords: "cardiology cardiologue cœur coeur heart blood pressure hypertension قلب ضغط الدم طونسيو",
  },
  {
    value: "General Practice",
    matchTokens: ["general", "family medicine", "gp", "généraliste"],
    en: "General Practice · Family Doctor",
    fr: "Médecine Générale · Généraliste",
    ar: "الطب العام وطب الأسرة",
    keywords: "general practice family doctor gp médecin généraliste fever flu طب عام طبيب الأسرة سخانة",
  },
  {
    value: "Pediatrics",
    matchTokens: ["pediatric", "pédiatri", "child"],
    en: "Pediatrics · Children & Babies",
    fr: "Pédiatrie · Enfants & Bébés",
    ar: "طب الأطفال والرضع",
    keywords: "pediatrics pédiatrie children baby child fever طب الأطفال أطفال رضيع",
  },
  {
    value: "Dermatology",
    matchTokens: ["dermatolog", "skin"],
    en: "Dermatology · Skin, Hair & Allergies",
    fr: "Dermatologie · Peau & Allergies",
    ar: "طب الجلد والشعر والحساسية",
    keywords: "dermatology dermatologue skin rash hair allergy جلد بشرة شعر حساسية",
  },
  {
    value: "Orthopedics",
    matchTokens: ["orthop", "bone", "joint", "trauma"],
    en: "Orthopedics · Bones, Back & Joints",
    fr: "Orthopédie · Os, Dos & Articulations",
    ar: "طب العظام والمفاصل والظهر",
    keywords: "orthopedics orthopédie bone joint back fracture knee عظام مفاصل ظهر ركبة",
  },
  {
    value: "Gynecology",
    matchTokens: ["gynecol", "obstet", "women"],
    en: "Gynecology · Women's Health",
    fr: "Gynécologie · Santé Féminine",
    ar: "طب النساء والتوليد",
    keywords: "gynecology obstetrics women health pregnancy gynécologie نساء توليد حمل",
  },
  {
    value: "Ophthalmology",
    matchTokens: ["ophthal", "eye", "vision"],
    en: "Ophthalmology · Eyes & Vision",
    fr: "Ophtalmologie · Yeux & Vision",
    ar: "طب وجراحة العيون",
    keywords: "ophthalmology eye vision glasses ophtalmologue عيون نظر",
  },
  {
    value: "Internal Medicine",
    matchTokens: ["internal", "interne", "diabet", "chronic"],
    en: "Internal Medicine · Chronic Care",
    fr: "Médecine Interne · Suivi Chronique",
    ar: "الطب الباطني والأمراض المزمنة",
    keywords: "internal medicine diabetes thyroid chronic باطني سكري غدة أمراض مزمنة",
  },
  {
    value: "Emergency Medicine",
    matchTokens: ["emergency", "urgent", "trauma"],
    en: "Emergency & Urgent Care",
    fr: "Médecine d'Urgence",
    ar: "طب الطوارئ والمستعجلات",
    keywords: "emergency urgent care trauma urgences مستعجلات طوارئ",
  },
  {
    value: "Nursing",
    matchTokens: ["nursing", "infirmier", "nurse"],
    en: "Home Nursing & Infirmiers",
    fr: "Infirmier · Soins à Domicile",
    ar: "التمريض المنزلي (ممرض للدار)",
    keywords: "nursing infirmier nurse home visit injection dressing ممرض ممرضة تمريض منزلي شوكة فاصمة",
    isNurse: true,
  },
];

export function formatSpecialtyLabel(
  rawSpecialty: string,
  locale: LocaleCode,
): string {
  const lower = rawSpecialty.toLowerCase();
  for (const entry of CANONICAL_SPECIALTIES) {
    if (entry.matchTokens.some((tok) => lower.includes(tok))) {
      if (locale === "ar") return entry.ar;
      if (locale === "fr") return entry.fr;
      return entry.en;
    }
  }
  return rawSpecialty;
}

export function getSpecialtyKeywords(rawSpecialty: string): string {
  const lower = rawSpecialty.toLowerCase();
  for (const entry of CANONICAL_SPECIALTIES) {
    if (entry.matchTokens.some((tok) => lower.includes(tok))) {
      return `${rawSpecialty} ${entry.en} ${entry.fr} ${entry.ar} ${entry.keywords}`;
    }
  }
  return rawSpecialty;
}

export function matchesDoctorSpecialtyFilter(
  doctorSpecialty: string,
  selectedValue: string,
): boolean {
  const cleanFilter = selectedValue.trim();
  if (!cleanFilter || cleanFilter === "ALL") return true;
  const lowerDoc = doctorSpecialty.toLowerCase();
  const lowerFilter = cleanFilter.toLowerCase();
  if (lowerDoc.includes(lowerFilter)) return true;

  const entry = CANONICAL_SPECIALTIES.find(
    (s) =>
      s.value.toLowerCase() === lowerFilter ||
      s.matchTokens.some((tok) => lowerFilter.includes(tok)) ||
      s.keywords.toLowerCase().split(/\s+/).includes(lowerFilter) ||
      s.en.toLowerCase().includes(lowerFilter) ||
      s.fr.toLowerCase().includes(lowerFilter) ||
      s.ar.toLowerCase().includes(lowerFilter),
  );
  if (!entry) return false;
  return entry.matchTokens.some((tok) => lowerDoc.includes(tok));
}

export function resolveCanonicalSpecialtyValue(
  rawQuery: string,
): string | null {
  const clean = rawQuery.trim().toLowerCase();
  if (!clean) return null;
  const entry = CANONICAL_SPECIALTIES.find(
    (s) =>
      s.value.toLowerCase() === clean ||
      s.matchTokens.some((tok) => clean.includes(tok)) ||
      s.keywords.toLowerCase().split(/\s+/).some((kw) => kw === clean) ||
      s.en.toLowerCase().includes(clean) ||
      s.fr.toLowerCase().includes(clean) ||
      s.ar.toLowerCase().includes(clean),
  );
  return entry ? entry.value : null;
}

export interface SpecialtyOption {
  value: string;
  label: string;
}

export function buildSpecialtyFilterOptions(
  rawSpecialties: readonly string[],
  locale: LocaleCode,
  options?: { includeNurse?: boolean },
): SpecialtyOption[] {
  const includeNurse = options?.includeNurse ?? true;
  const seen = new Set<string>();
  const result: SpecialtyOption[] = [];

  for (const raw of rawSpecialties) {
    const trimmed = raw.trim();
    if (!trimmed) continue;
    const isNurse = /nursing|infirmier|nurse/i.test(trimmed);
    if (!includeNurse && isNurse) continue;

    const canonical = CANONICAL_SPECIALTIES.find((entry) =>
      entry.matchTokens.some((tok) => trimmed.toLowerCase().includes(tok)),
    );
    const value = canonical ? canonical.value : trimmed;
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push({
      value,
      label: formatSpecialtyLabel(trimmed, locale),
    });
  }

  for (const entry of CANONICAL_SPECIALTIES) {
    if (!includeNurse && entry.isNurse) continue;
    const key = entry.value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push({
      value: entry.value,
      label:
        locale === "ar" ? entry.ar : locale === "fr" ? entry.fr : entry.en,
    });
  }

  return result;
}
