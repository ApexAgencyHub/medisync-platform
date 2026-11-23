import type {
  LocaleCode,
  MedicationItem,
  PatientMedicalProfile,
} from "@medisync/contracts";

export interface SoapTemplate {
  readonly id: string;
  readonly labels: Record<LocaleCode, string>;
  readonly icd: string;
  readonly s: Record<LocaleCode, string>;
  readonly o: Record<LocaleCode, string>;
  readonly a: Record<LocaleCode, string>;
  readonly p: Record<LocaleCode, string>;
  readonly vitals: {
    readonly temp: string;
    readonly sys: string;
    readonly dia: string;
    readonly hr: string;
  };
}

export const SOAP_TEMPLATES: readonly SoapTemplate[] = [
  {
    id: "cardio",
    labels: {
      en: "Cardiology Follow-Up",
      fr: "Suivi Cardiologie (HTA)",
      ar: "متابعة أمراض القلب",
    },
    icd: "I10",
    s: {
      en: "Routine blood pressure follow-up; denies chest pain, orthopnea, or exertional dyspnea.",
      fr: "Suivi tensionnel régulier ; absence de douleur thoracique, d'orthopnée ou de dyspnée d'effort.",
      ar: "متابعة دورية لضغط الدم؛ لا ألم بالصدر ولا ضيق تنفس.",
    },
    o: {
      en: "BP 126/78 mmHg, HR 72 bpm regular, SpO2 99%, clear lungs bilaterally, no peripheral edema.",
      fr: "TA 126/78 mmHg, FC 72 bpm régulière, SpO2 99 %, auscultation pulmonaire libre, pas d'OMI.",
      ar: "الضغط 126/78 مم زئبق، النبض 72 منتظم، الأكسجين 99%، الرئتان سليمتان.",
    },
    a: {
      en: "Controlled essential hypertension (I10).",
      fr: "Hypertension artérielle essentielle équilibrée (I10).",
      ar: "ارتفاع ضغط الدم الأساسي مستقر (I10).",
    },
    p: {
      en: "Continue current antihypertensive regimen; repeat lipid & metabolic panel in 3 months.",
      fr: "Poursuite du traitement antihypertenseur ; bilan lipidique et métabolique de contrôle à 3 mois.",
      ar: "الاستمرار على العلاج الحالي وإعادة تحاليل الدهون والدم بعد 3 أشهر.",
    },
    vitals: { temp: "36.7", sys: "126", dia: "78", hr: "72" },
  },
  {
    id: "uri",
    labels: {
      en: "Acute URI / Fever",
      fr: "Infection ORL / Fièvre",
      ar: "التهاب تنفسي / حمى",
    },
    icd: "J06.9",
    s: {
      en: "3 days sore throat, low-grade fever, nasal congestion, dry cough.",
      fr: "Odynophagie depuis 3 jours, fébricule, congestion nasale et toux sèche.",
      ar: "ألم بالحلق منذ 3 أيام مع حرارة خفيفة واحتقان أنفي وسعال جاف.",
    },
    o: {
      en: "Temp 37.8°C, mild pharyngeal erythema without exudate, lungs clear to auscultation.",
      fr: "T° 37,8 °C, pharynx érythémateux sans exsudat, champs pulmonaires libres.",
      ar: "الحرارة 37.8 درجة، احمرار خفيف بالحلق دون صديد، الصدر سليم.",
    },
    a: {
      en: "Acute upper respiratory tract infection (J06.9), likely viral.",
      fr: "Infection aiguë des voies aériennes supérieures (J06.9), probable origine virale.",
      ar: "التهاب حاد في المسالك التنفسية العلوية (J06.9)، يرجح أنه فيروسي.",
    },
    p: {
      en: "Oral hydration, antipyretic PRN, rest; return if dyspnea or fever persists >72h.",
      fr: "Hydratation orale, antipyrétique si besoin, repos ; reconsulter si fièvre > 72h ou dyspnée.",
      ar: "شرب السوائل، خافض حرارة عند الحاجة، راحة ومراجعة الطبيب إذا استمرت الحمى أكثر من 72 ساعة.",
    },
    vitals: { temp: "37.8", sys: "118", dia: "74", hr: "84" },
  },
  {
    id: "diabetes",
    labels: {
      en: "Diabetes Check",
      fr: "Suivi Diabète",
      ar: "متابعة السكري",
    },
    icd: "E11.9",
    s: {
      en: "Quarterly glycemic follow-up; good medication adherence, no hypoglycemic episodes.",
      fr: "Contrôle glycémique trimestriel ; bonne observance thérapeutique, aucun malaise hypoglycémique.",
      ar: "متابعة فصلية للسكري؛ التزام جيد بالدواء دون نوبات هبوط سكر.",
    },
    o: {
      en: "Fasting capillary glucose 112 mg/dL, BP 124/76 mmHg, monofilament foot exam intact.",
      fr: "Glycémie capillaire à jeun 1,12 g/L, TA 124/76 mmHg, examen des pieds au monofilament normal.",
      ar: "السكر الصائم 112 ملغ/ديسيلتر، الضغط 124/76، فحص القدمين سليم.",
    },
    a: {
      en: "Type 2 diabetes mellitus without complications (E11.9), stable.",
      fr: "Diabète de type 2 sans complication (E11.9), équilibré.",
      ar: "السكري من النوع الثاني بدون مضاعفات (E11.9)، مستقر.",
    },
    p: {
      en: "Order HbA1c + microalbuminuria; continue Metformin and Mediterranean diet.",
      fr: "Prescrire HbA1c + microalbuminurie ; poursuivre Metformine et régime méditerranéen.",
      ar: "طلب تحليل الخزان HbA1c ومواصلة الميتفورمين والنظام الغذائي المتوازن.",
    },
    vitals: { temp: "36.6", sys: "124", dia: "76", hr: "70" },
  },
  {
    id: "asthma",
    labels: {
      en: "Asthma / Dyspnea",
      fr: "Asthme / Dyspnée",
      ar: "الربو / ضيق التنفس",
    },
    icd: "J45.9",
    s: {
      en: "Intermittent nighttime wheezing over the past week, relieved by rescue inhaler.",
      fr: "Sifflements nocturnes intermittents depuis 7 jours, soulagés par bronchodilatateur.",
      ar: "صفير ليلي متقطع منذ أسبوع يتحسن ببخاخ التوسيع.",
    },
    o: {
      en: "SpO2 97% RA, mild end-expiratory wheeze bilaterally, no accessory muscle use.",
      fr: "SpO2 97 % AA, discrets sibilants bilatéraux en fin d'expiration, sans signe de lutte.",
      ar: "الأكسجين 97%، صفير خفيف بنهاية الزفير دون علامات إجهاد تنفسي.",
    },
    a: {
      en: "Mild persistent bronchial asthma (J45.9).",
      fr: "Asthme bronchique persistant léger (J45.9).",
      ar: "ربو قصبي مستمر خفيف (J45.9).",
    },
    p: {
      en: "Step up daily ICS controller, review inhaler technique, peak flow action plan.",
      fr: "Ajustement du traitement de fond inhalé, vérification technique d'inhalation et plan d'action.",
      ar: "تعديل البخاخ الوقائي اليومي ومراجعة طريقة الاستعمال وخطة الطوارئ.",
    },
    vitals: { temp: "36.8", sys: "122", dia: "78", hr: "86" },
  },
  {
    id: "postop",
    labels: {
      en: "Post-Op Review",
      fr: "Contrôle Post-Op",
      ar: "متابعة ما بعد العملية",
    },
    icd: "Z48.0",
    s: {
      en: "Post-operative day 7 surgical check; minimal incisional discomfort, tolerating diet.",
      fr: "Contrôle chirurgical à J7 ; douleur cicatricielle minime, bonne tolérance alimentaire.",
      ar: "فحص ما بعد الجراحة اليوم السابع؛ ألم خفيف بموضع الجرح مع تغذية عادية.",
    },
    o: {
      en: "Surgical site clean, dry, intact, well-approximated edges, afebrile.",
      fr: "Cicatrice propre, sèche, berges bien affrontées, patient apyrétique.",
      ar: "الجرح نظيف وجاف وملتحم جيداً دون حمى.",
    },
    a: {
      en: "Normal post-operative surgical recovery (Z48.0).",
      fr: "Évolution post-opératoire satisfaisante (Z48.0).",
      ar: "تعافي طبيعي بعد الجراحة (Z48.0).",
    },
    p: {
      en: "Remove sutures/steri-strips, resume light activity, follow-up PRN.",
      fr: "Ablation des fils, reprise progressive des activités, contrôle si besoin.",
      ar: "إزالة الغرز واستئناف النشاط الخفيف والمراجعة عند الحاجة.",
    },
    vitals: { temp: "36.7", sys: "120", dia: "76", hr: "74" },
  },
];

export const ICD10_QUICK_CHIPS: ReadonlyArray<{
  readonly code: string;
  readonly labels: Record<LocaleCode, string>;
}> = [
  { code: "I10", labels: { en: "Hypertension", fr: "HTA", ar: "ارتفاع الضغط" } },
  { code: "J06.9", labels: { en: "Acute URI", fr: "Infection ORL", ar: "التهاب تنفسي" } },
  { code: "E11.9", labels: { en: "Type 2 Diabetes", fr: "Diabète T2", ar: "السكري T2" } },
  { code: "I20.9", labels: { en: "Angina", fr: "Angor", ar: "ذبحة صدرية" } },
  { code: "J45.9", labels: { en: "Asthma", fr: "Asthme", ar: "الربو" } },
  { code: "K21.9", labels: { en: "GERD", fr: "RGO", ar: "ارتجاع معدي" } },
  { code: "M54.5", labels: { en: "Low Back Pain", fr: "Lombalgie", ar: "ألم أسفل الظهر" } },
  { code: "R51", labels: { en: "Headache", fr: "Céphalée", ar: "صداع" } },
];

export const RX_FREQUENCY_PILLS: Record<
  LocaleCode,
  ReadonlyArray<{ readonly label: string; readonly value: string }>
> = {
  en: [
    { label: "1×/d", value: "Once daily in the morning" },
    { label: "2×/d", value: "Twice daily" },
    { label: "3×/d", value: "Every 8 hours" },
    { label: "PRN", value: "As needed (PRN)" },
  ],
  fr: [
    { label: "1×/j", value: "1 fois par jour le matin" },
    { label: "2×/j", value: "Matin et soir" },
    { label: "3×/j", value: "Toutes les 8 heures" },
    { label: "PRN", value: "Si besoin (PRN)" },
  ],
  ar: [
    { label: "1×/يوم", value: "مرة واحدة صباحاً" },
    { label: "2×/يوم", value: "صباحاً ومساءً" },
    { label: "3×/يوم", value: "كل 8 ساعات" },
    { label: "عند الحاجة", value: "عند الحاجة" },
  ],
};

export const RX_DURATION_PILLS = [3, 5, 7, 14, 30] as const;

export function formatRxDurationChip(days: number, locale: LocaleCode): string {
  if (locale === "fr") return `${days}j`;
  if (locale === "ar") return days <= 10 ? `${days} أيام` : `${days} يوم`;
  return `${days}d`;
}

export interface AllergyConflict {
  readonly medName: string;
  readonly allergen: string;
  readonly severity: string;
  readonly reason: string;
}

export function normalizeClinicalTerm(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f\u064B-\u065F\u0670]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .toLowerCase()
    .trim();
}

// Clinical drug-class cross-reactivity matrix (EN + FR diacritic-normalized + AR alef-normalized + Moroccan brands)
const ALLERGY_CROSS_REACTIVITY: ReadonlyArray<{
  readonly allergyPattern: RegExp;
  readonly drugPattern: RegExp;
  readonly reason: Record<LocaleCode, string>;
}> = [
  {
    allergyPattern:
      /penicillin|penicilline|beta[\s-]?lactam|beta[\s-]?lactamine|amoxicillin|amoxicilline|cephalosporin|cephalosporine|بنسلين|بنيسلين|بنيسيلين|اموكسيسيلين|بيتالاكتام|سيفالوسبورين/i,
    drugPattern:
      /penicillin|penicilline|amoxicillin|amoxicilline|augmentin|clamoxyl|curam|amoxil|fleming|orapen|ospen|ampicillin|ampicilline|cloxacillin|cloxacilline|piperacillin|piperacilline|oroken|rocephine|(?:^|[\s(/,-])cef|ceph|اموكسيسيلين|اوغمنتين|اوجمنتين|كلافوكس|بنسلين|سيفيكسيم|سيفالوسبورين/i,
    reason: {
      en: "Beta-lactam / Penicillin allergy cross-reactivity risk",
      fr: "Risque de réaction croisée Bêta-lactamine / Pénicilline",
      ar: "خطر حساسية متقاطعة تجاه البنسلين / البيتالاكتام",
    },
  },
  {
    allergyPattern:
      /nsaid|ains|aspirin|aspirine|ibuprofen|ibuprofene|salicylate|salicyle|diclofenac|اسبرين|ايبوبروفين|بروفين|مضادات الالتهاب/i,
    drugPattern:
      /ibuprofen|ibuprofene|advil|nurofen|spifen|aspirin|aspirine|aspegic|diclofenac|voltarene|cataflam|naproxen|naproxene|apranax|ketoprofen|ketoprofene|profenid|flurbiprofen|antadys|nifluril|celecoxib|indomethacin|اسبرين|ايبوبروفين|بروفين|فولتارين|ديكلوفيناك/i,
    reason: {
      en: "NSAID / Aspirin hypersensitivity risk",
      fr: "Risque d'hypersensibilité AINS / Aspirine",
      ar: "خطر فرط الحساسية تجاه الأسبرين أو مضادات الالتهاب (AINS)",
    },
  },
  {
    allergyPattern: /sulfa|sulfonamide|sulfamide|سلفا|سلفوناميد/i,
    drugPattern:
      /sulfa|sulfamide|bactrim|cotrimoxazole|furosemide|lasilix|thiazide|gliclazide|diamicron|سلفا|باكتريم|سلفاميثوكسازول/i,
    reason: {
      en: "Sulfonamide allergy sensitivity warning",
      fr: "Alerte d'allergie aux sulfamides",
      ar: "تنبيه حساسية تجاه مركبات السلفوناميد",
    },
  },
  {
    allergyPattern:
      /macrolide|erythromycin|erythromycine|azithromycin|azithromycine|clarithromycin|clarithromycine|ماكروليد|ازيثروميسين|كلاريثرومايسين|اريثروميسين/i,
    drugPattern:
      /azithromycin|azithromycine|zithromax|azix|clarithromycin|clarithromycine|zeclar|erythromycin|erythromycine|roxithromycin|roxithromycine|rulid|josacine|ازيثروميسين|زيثروماكس|كلاريثرومايسين|اريثروميسين|ارثروميسين/i,
    reason: {
      en: "Macrolide antibiotic class allergy",
      fr: "Allergie à la classe des macrolides",
      ar: "حساسية تجاه المضادات الحيوية من فئة الماكروليد",
    },
  },
  {
    allergyPattern:
      /paracetamol|acetaminophen|doliprane|باراسيتامول|باراسيتمول|دوليبران/i,
    drugPattern:
      /paracetamol|acetaminophen|doliprane|dafalgan|efferalgan|panadol|باراسيتامول|باراسيتمول|دوليبران|بانادول/i,
    reason: {
      en: "Paracetamol / Acetaminophen documented hypersensitivity",
      fr: "Hypersensibilité documentée au Paracétamol",
      ar: "حساسية مسجلة تجاه الباراسيتامول / دوليبران",
    },
  },
];

export function detectAllergyConflicts(
  meds: readonly Pick<MedicationItem, "name">[],
  profile: PatientMedicalProfile | null,
  locale: LocaleCode,
): AllergyConflict[] {
  if (!profile || profile.allergies.length === 0 || meds.length === 0) return [];
  const conflicts: AllergyConflict[] = [];

  for (const med of meds) {
    const cleanDrug = med.name.trim();
    if (!cleanDrug) continue;
    const normDrug = normalizeClinicalTerm(cleanDrug);
    for (const alg of profile.allergies) {
      const cleanAlg = alg.allergen.trim();
      if (!cleanAlg) continue;
      const normAlg = normalizeClinicalTerm(cleanAlg);
      if (
        normDrug.length >= 3 &&
        normAlg.length >= 3 &&
        (normDrug.includes(normAlg) || normAlg.includes(normDrug))
      ) {
        conflicts.push({
          medName: cleanDrug,
          allergen: cleanAlg,
          severity: alg.severity,
          reason:
            locale === "fr"
              ? `Correspondance directe avec l'allergie documentée : ${cleanAlg}`
              : locale === "ar"
                ? `تطابق مباشر مع الحساسية المسجلة: ${cleanAlg}`
                : `Direct match with documented ${cleanAlg} allergy`,
        });
        continue;
      }
      for (const rule of ALLERGY_CROSS_REACTIVITY) {
        if (rule.allergyPattern.test(normAlg) && rule.drugPattern.test(normDrug)) {
          conflicts.push({
            medName: cleanDrug,
            allergen: cleanAlg,
            severity: alg.severity,
            reason: rule.reason[locale],
          });
          break;
        }
      }
    }
  }
  return conflicts;
}
