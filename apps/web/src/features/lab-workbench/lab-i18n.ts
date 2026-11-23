import type { LocaleCode } from "@medisync/contracts";

export interface LabCopy {
  title: string;
  guestLabel: string;
  guardTitle: string;
  guardRoles: string;
  syncBtn: string;
  tabQueue: string;
  tabPapers: string;
  kpiOrdered: string;
  kpiCollected: string;
  kpiCompleted: string;
  filterAll: string;
  filterOrdered: string;
  filterCollected: string;
  filterCompleted: string;
  queueHeading: (n: number) => string;
  emptyQueue: string;
  collectSpecimenBtn: string;
  completeOrderBtn: string;
  summaryLabel: string;
  summaryPlaceholder: string;
  attachReportTitle: string;
  dropzoneLabel: string;
  dropzoneHint: string;
  uploadBtn: string;
  uploadedArchiveHeading: (n: number) => string;
  specimenCollectedMsg: (panel: string) => string;
  completedMsg: (panel: string) => string;
  uploadDoneMsg: (name: string) => string;
}

export const LAB_COPY: Record<LocaleCode, LabCopy> = {
  en: {
    title: "Diagnostic Laboratory Workbench",
    guestLabel: "Lab Technician Sign-In",
    guardTitle: "Diagnostic Laboratory Workbench",
    guardRoles: "Verified Medical Laboratory Technicians",
    syncBtn: "Sync LIMS Queue",
    tabQueue: "LIMS Specimen Queue",
    tabPapers: "ISO 15189 & Lab Papers",
    kpiOrdered: "New Orders",
    kpiCollected: "Specimen Collected",
    kpiCompleted: "Reports Issued",
    filterAll: "All",
    filterOrdered: "Ordered",
    filterCollected: "Sample Collected",
    filterCompleted: "Completed",
    queueHeading: (n) => `Diagnostic Panels (${n})`,
    emptyQueue: "No matching diagnostic orders.",
    collectSpecimenBtn: "Collect Specimen",
    completeOrderBtn: "Complete & Release Result",
    summaryLabel: "Lab Result Summary (signed with report)",
    summaryPlaceholder: "e.g. Hb 13.4 g/dL, WBC normal range, CRP < 5 mg/L",
    attachReportTitle: "Attach Signed PDF / DICOM / Scan Result",
    dropzoneLabel: "Drop PDF lab report or imaging scan",
    dropzoneHint: "PDF, DICOM, PNG, JPEG, CSV, FHIR JSON · up to 50 MB",
    uploadBtn: "Upload & Link Report to Patient",
    uploadedArchiveHeading: (n) => `Confirmed Lab Media Files (${n})`,
    specimenCollectedMsg: (panel) => `Specimen marked collected for ${panel}.`,
    completedMsg: (panel) => `Diagnostic report finalized for ${panel}.`,
    uploadDoneMsg: (name) => `Uploaded certified diagnostic file: ${name}`,
  },
  fr: {
    title: "Laboratoire d'Analyses & Imagerie",
    guestLabel: "Accès Technicien Labo",
    guardTitle: "Laboratoire d'Analyses & Imagerie",
    guardRoles: "Techniciens de Laboratoire Vérifiés",
    syncBtn: "Actualiser SIL",
    tabQueue: "File Prélèvements & Résultats",
    tabPapers: "ISO 15189 & Agréments",
    kpiOrdered: "Prescrits",
    kpiCollected: "Prélevés",
    kpiCompleted: "Validés",
    filterAll: "Tous",
    filterOrdered: "Prescrits",
    filterCollected: "Prélevés",
    filterCompleted: "Validés",
    queueHeading: (n) => `Bilans Diagnostiques (${n})`,
    emptyQueue: "Aucune demande d'analyse correspondante.",
    collectSpecimenBtn: "Valider Prélèvement",
    completeOrderBtn: "Publier Résultat",
    summaryLabel: "Synthèse du Bilan (signée)",
    summaryPlaceholder: "ex. Hb 13,4 g/dL, CRP < 5 mg/L, bilan normal",
    attachReportTitle: "Joindre Compte-Rendu PDF / DICOM / Scanner",
    dropzoneLabel: "Déposer compte-rendu PDF ou image médicale",
    dropzoneHint: "PDF, DICOM, PNG, JPEG, CSV, FHIR · max 50 Mo",
    uploadBtn: "Téléverser & Lier au Patient",
    uploadedArchiveHeading: (n) => `Archives Diagnostiques Validées (${n})`,
    specimenCollectedMsg: (panel) => `Prélèvement enregistré pour ${panel}.`,
    completedMsg: (panel) => `Résultat publié pour ${panel}.`,
    uploadDoneMsg: (name) => `Fichier diagnostique vérifié : ${name}`,
  },
  ar: {
    title: "مختبر التحاليل الطبية والأشعة",
    guestLabel: "دخول تقني المختبر",
    guardTitle: "مختبر التحاليل الطبية والأشعة",
    guardRoles: "تقنيي المختبرات الطبية المرخصين فقط",
    syncBtn: "تحديث قائمة المختبر",
    tabQueue: "قائمة العينات والنتائج",
    tabPapers: "شهادة ISO 15189 والوثائق",
    kpiOrdered: "طلبات جديدة",
    kpiCollected: "تم أخذ العينة",
    kpiCompleted: "نتائج صادرة",
    filterAll: "الكل",
    filterOrdered: "مطلوبة",
    filterCollected: "تم جمع العينة",
    filterCompleted: "مكتملة",
    queueHeading: (n) => `الفحوصات المخبرية (${n})`,
    emptyQueue: "لا توجد طلبات تحليل مطابقة.",
    collectSpecimenBtn: "تسجيل أخذ العينة",
    completeOrderBtn: "اعتماد وإصدار النتيجة",
    summaryLabel: "ملخص نتيجة التحليل",
    summaryPlaceholder: "مثال: نتائج التحاليل في النطاق الطبيعي",
    attachReportTitle: "إرفاق ملف النتيجة PDF أو صورة الأشعة",
    dropzoneLabel: "اسحب ملف PDF أو DICOM أو صورة الفحص هنا",
    dropzoneHint: "PDF, DICOM, PNG, JPEG, CSV · حتى 50 ميجابايت",
    uploadBtn: "رفع التقرير وربطه بالمريض",
    uploadedArchiveHeading: (n) => `الملفات المخبرية المؤكدة (${n})`,
    specimenCollectedMsg: (panel) => `تم تسجيل أخذ العينة لفحص ${panel}.`,
    completedMsg: (panel) => `تم اعتماد نتيجة فحص ${panel}.`,
    uploadDoneMsg: (name) => `تم رفع الملف المخبري بنجاح: ${name}`,
  },
};
