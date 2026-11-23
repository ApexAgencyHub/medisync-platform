import type { LocaleCode } from "@medisync/contracts";

export interface NurseCopy {
  title: string;
  guestLabel: string;
  guardTitle: string;
  guardRoles: string;
  syncBtn: string;
  tabRounds: string;
  tabCare: string;
  tabSchedule: string;
  tabPapers: string;
  careTitle: string;
  careSubtitle: string;
  rxRestrictionBanner: string;
  vitalsHeading: string;
  tempLabel: string;
  systolicLabel: string;
  diastolicLabel: string;
  hrLabel: string;
  patientLabel: string;
  patientPlaceholder: string;
  patientEmpty: string;
  subjectiveLabel: string;
  subjectivePlaceholder: string;
  objectiveLabel: string;
  objectivePlaceholder: string;
  assessmentLabel: string;
  assessmentPlaceholder: string;
  planLabel: string;
  planPlaceholder: string;
  saveCareBtn: string;
  historyHeading: (n: number) => string;
  historyEmpty: string;
  shiftHeading: string;
  facilityLabel: string;
  facilityPlaceholder: string;
  facilityEmpty: string;
  publishWeekdaysLabel: string;
  publishShiftBtn: string;
  activeShiftsHeading: (n: number) => string;
  activeStatus: string;
  pausedStatus: string;
  pauseBtn: string;
  resumeBtn: string;
  deleteBtn: string;
  noteSaved: (patientName: string) => string;
  shiftPublished: (count: number) => string;
  shiftToggled: (active: boolean) => string;
  shiftDeleted: string;
}

export const NURSE_COPY: Record<LocaleCode, NurseCopy> = {
  en: {
    title: "Nursing & Home Care Station",
    guestLabel: "Registered Nurse Sign-In",
    guardTitle: "Nursing & Home Care Station",
    guardRoles: "Verified Registered Nurses (Infirmiers / RN)",
    syncBtn: "Sync Rounds & Visits",
    tabRounds: "Home & Ward Rounds",
    tabCare: "Vitals & Care Notes",
    tabSchedule: "Home-Visit Shifts",
    tabPapers: "Nursing License & Papers",
    careTitle: "Nursing Care, Vitals & Chart Note",
    careSubtitle:
      "Record bedside or home-visit vital signs, wound care observations, and patient recovery milestones.",
    rxRestrictionBanner:
      "Prescription issuing (E-Rx) is reserved for physicians.",
    vitalsHeading: "Bedside Vital Signs",
    tempLabel: "Temperature (°C)",
    systolicLabel: "Systolic BP (mmHg)",
    diastolicLabel: "Diastolic BP (mmHg)",
    hrLabel: "Heart Rate (bpm)",
    patientLabel: "Patient",
    patientPlaceholder: "Search patient...",
    patientEmpty: "No patient matched",
    subjectiveLabel: "Subjective Symptoms / Tolerance",
    subjectivePlaceholder: "Patient pain score, hydration, dressing comfort...",
    objectiveLabel: "Objective Exam & Nursing Care",
    objectivePlaceholder: "Wound edges clean, IV line patent, SpO2 98% on room air...",
    assessmentLabel: "Nursing Assessment",
    assessmentPlaceholder: "Stable post-op recovery, vitals within baseline...",
    planLabel: "Care Continuation Plan",
    planPlaceholder: "Repeat sterile dressing change in 48h, hydrate, alert MD if fever >38°C...",
    saveCareBtn: "Save Nursing Note & Vitals",
    historyHeading: (n) => `Patient Care & Vital Log (${n})`,
    historyEmpty: "No nursing notes recorded yet for this region.",
    shiftHeading: "Publish Home-Visit & Clinic Nursing Shifts",
    facilityLabel: "Affiliated Clinic / Care Base",
    facilityPlaceholder: "Select linked clinic...",
    facilityEmpty: "No active facility found",
    publishWeekdaysLabel: "Publish across Mon–Fri (Home Care Week)",
    publishShiftBtn: "Publish Nursing Shift",
    activeShiftsHeading: (n) => `Published Nursing Shifts (${n})`,
    activeStatus: "Active",
    pausedStatus: "Paused",
    pauseBtn: "Pause",
    resumeBtn: "Resume",
    deleteBtn: "Delete",
    noteSaved: (name) => `Saved nursing care note & vitals for ${name}.`,
    shiftPublished: (n) =>
      n > 1 ? `Published ${n} nursing shifts.` : "Nursing shift published.",
    shiftToggled: (active) => (active ? "Shift resumed." : "Shift paused."),
    shiftDeleted: "Shift removed from nurse roster.",
  },
  fr: {
    title: "Poste Infirmier & Soins à Domicile",
    guestLabel: "Accès Infirmier(ère)",
    guardTitle: "Poste Infirmier & Soins à Domicile",
    guardRoles: "Infirmiers Diplômés d'État Vérifiés",
    syncBtn: "Actualiser Tournée",
    tabRounds: "Tournée & Visites",
    tabCare: "Constantes & Soins",
    tabSchedule: "Créneaux Domicile",
    tabPapers: "Ordre & Justificatifs",
    careTitle: "Soins Infirmiers, Constantes & Suivi",
    careSubtitle:
      "Enregistrez les paramètres vitaux, pansements, injections et évolution du patient à domicile ou en service.",
    rxRestrictionBanner:
      "L'émission d'ordonnances médicales (E-Rx) est réservée aux médecins.",
    vitalsHeading: "Paramètres Vitaux",
    tempLabel: "Température (°C)",
    systolicLabel: "Tension Systolique (mmHg)",
    diastolicLabel: "Tension Diastolique (mmHg)",
    hrLabel: "Fréquence Cardiaque (bpm)",
    patientLabel: "Patient",
    patientPlaceholder: "Rechercher un patient...",
    patientEmpty: "Aucun patient",
    subjectiveLabel: "Plainte / Ressenti Patient",
    subjectivePlaceholder: "Douleur, confort du pansement, tolérance du traitement...",
    objectiveLabel: "Examen & Acte Infirmier",
    objectivePlaceholder: "Plaie propre, voie veineuse perméable, SpO2 98%...",
    assessmentLabel: "Évaluation Infirmière",
    assessmentPlaceholder: "Évolution favorable, constantes stables...",
    planLabel: "Conduite à Tenir / Suivi",
    planPlaceholder: "Prochain passage dans 48h, alerter médecin si fièvre >38°C...",
    saveCareBtn: "Enregistrer Note & Constantes",
    historyHeading: (n) => `Journal des Soins & Constantes (${n})`,
    historyEmpty: "Aucune note de soin enregistrée pour cette région.",
    shiftHeading: "Publier Créneaux Visites à Domicile & Cabinet",
    facilityLabel: "Établissement de rattachement",
    facilityPlaceholder: "Choisir clinique ou cabinet...",
    facilityEmpty: "Aucun établissement",
    publishWeekdaysLabel: "Publier sur toute la semaine (Lun–Ven)",
    publishShiftBtn: "Publier Créneau Infirmier",
    activeShiftsHeading: (n) => `Créneaux Publiés (${n})`,
    activeStatus: "Actif",
    pausedStatus: "En pause",
    pauseBtn: "Pause",
    resumeBtn: "Réactiver",
    deleteBtn: "Supprimer",
    noteSaved: (name) => `Note infirmière et constantes enregistrées pour ${name}.`,
    shiftPublished: (n) =>
      n > 1 ? `${n} créneaux infirmiers publiés.` : "Créneau infirmier publié.",
    shiftToggled: (active) => (active ? "Créneau réactivé." : "Créneau mis en pause."),
    shiftDeleted: "Créneau supprimé.",
  },
  ar: {
    title: "محطة التمريض والرعاية المنزلية",
    guestLabel: "تسجيل دخول الممرض",
    guardTitle: "محطة التمريض والرعاية المنزلية",
    guardRoles: "الممرضون والممرضات المرخصون فقط",
    syncBtn: "تحديث الجولات",
    tabRounds: "جولات وزيارات المرضى",
    tabCare: "المؤشرات الحيوية والرعاية",
    tabSchedule: "جدول الزيارات المنزلية",
    tabPapers: "الرخصة والوثائق المهنية",
    careTitle: "العناية التمريضية، المؤشرات الحيوية والتقرير",
    careSubtitle:
      "سجل العلامات الحيوية، العناية بالجروح، ومتابعة تعافي المريض في المنزل أو المصحة.",
    rxRestrictionBanner:
      "إصدار الوصفات الرقمية (E-Rx) مخصص للأطباء فقط.",
    vitalsHeading: "المؤشرات الحيوية للمريض",
    tempLabel: "الحرارة (°C)",
    systolicLabel: "الضغط الانقباضي (mmHg)",
    diastolicLabel: "الضغط الانبساطي (mmHg)",
    hrLabel: "نبضات القلب (bpm)",
    patientLabel: "المريض",
    patientPlaceholder: "ابحث عن مريض...",
    patientEmpty: "لا يوجد مريض مطابق",
    subjectiveLabel: "شكوى وحالة المريض",
    subjectivePlaceholder: "مستوى الألم، الراحة، تقبل الرعاية...",
    objectiveLabel: "الفحص السريري والإجراء التمريضي",
    objectivePlaceholder: "نظافة الجرح، مؤشرات التنفس 98%...",
    assessmentLabel: "التقييم التمريضي",
    assessmentPlaceholder: "تحسن مستقر بعد العملية...",
    planLabel: "خطة المتابعة",
    planPlaceholder: "تغيير الضماد بعد 48 ساعة، مراجعة الطبيب عند الحرارة...",
    saveCareBtn: "حفظ التقرير والمؤشرات",
    historyHeading: (n) => `سجل الرعاية التمريضية (${n})`,
    historyEmpty: "لا توجد تقارير تمريضية بعد.",
    shiftHeading: "نشر فترات الزيارات المنزلية والمداومة",
    facilityLabel: "العيادة أو المركز المرتبط",
    facilityPlaceholder: "اختر المركز...",
    facilityEmpty: "لا توجد مراكز نشطة",
    publishWeekdaysLabel: "نشر طيلة أيام الأسبوع (الإثنين - الجمعة)",
    publishShiftBtn: "نشر فترة تمريض",
    activeShiftsHeading: (n) => `الفترات المنشورة (${n})`,
    activeStatus: "نشط",
    pausedStatus: "متوقف مؤقتاً",
    pauseBtn: "إيقاف مؤقت",
    resumeBtn: "تفعيل",
    deleteBtn: "حذف",
    noteSaved: (name) => `تم حفظ التقرير التمريضي والمؤشرات للمريض ${name}.`,
    shiftPublished: (n) =>
      n > 1 ? `تم نشر ${n} فترات تمريض أسبوعية.` : "تم نشر فترة التمريض.",
    shiftToggled: (active) => (active ? "تم تفعيل الفترة." : "تم إيقاف الفترة مؤقتاً."),
    shiftDeleted: "تم حذف الفترة من الجدول.",
  },
};
