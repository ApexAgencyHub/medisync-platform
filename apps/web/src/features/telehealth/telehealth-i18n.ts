import type { LocaleCode } from "@medisync/contracts";

export interface TelehealthUiCopy {
  headerEyebrow: string;
  encryptedBadge: string;
  turnRelayBadge: string;
  signInRequiredTitle: string;
  signInRequiredBody: string;
  signInCta: string;
  backToCareBtn: string;
  accessDeniedTitle: string;
  accessDeniedBody: string;
  nonTelehealthTitle: string;
  nonTelehealthBody: string;
  inactiveTitle: string;
  inactiveBody: string;
  notFoundTitle: string;
  notFoundBody: string;
  loadingRoom: string;
  waitingForDoctor: string;
  waitingForPatient: string;
  connectedLiveHd: string;
  connectingRtc: string;
  reconnectingRtc: string;
  clinicalSyncModeTitle: string;
  clinicalSyncModeBody: string;
  peerMutedMic: string;
  peerCameraOff: string;
  youLabel: string;
  doctorLabel: string;
  patientLabel: string;
  micOnAria: string;
  micOffAria: string;
  camOnAria: string;
  camOffAria: string;
  reconnectBtn: string;
  completeVisitBtn: string;
  completingVisitBtn: string;
  endCallBtn: string;
  callEndedTitle: string;
  callEndedBody: string;
  rejoinCallBtn: string;
  safetyAlertTitle: string;
  bloodTypePrefix: string;
  noAllergiesLabel: string;
  unknownBloodLabel: string;
  doctorDeskTitle: string;
  doctorDeskSub: string;
  icd10Label: string;
  subjectiveLabel: string;
  subjectivePlaceholder: string;
  objectiveLabel: string;
  objectivePlaceholder: string;
  assessmentLabel: string;
  assessmentPlaceholder: string;
  planLabel: string;
  planPlaceholder: string;
  saveDiagnosisBtn: string;
  diagnosisSavedBanner: string;
  rxHeading: string;
  medLabel: string;
  medPlaceholder: string;
  dosageLabel: string;
  dosagePlaceholder: string;
  freqLabel: string;
  freqPlaceholder: string;
  daysLabel: string;
  issueRxBtn: string;
  rxIssuedBanner: string;
  patientCompanionTitle: string;
  patientCompanionSub: string;
  reasonPrefix: string;
  liveUpdateToast: string;
  latestDiagnosisTitle: string;
  noDiagnosisYet: string;
  latestRxTitle: string;
  noRxYet: string;
  openPharmacyCta: string;
  historyErrorPrefix: string;
}

export const TELEHEALTH_COPY: Record<LocaleCode, TelehealthUiCopy> = {
  en: {
    headerEyebrow: "Live Encrypted Video Consultation",
    encryptedBadge: "WebRTC DTLS-SRTP",
    turnRelayBadge: "TURN Firewall Relay",
    signInRequiredTitle: "Sign in to join your private video room",
    signInRequiredBody:
      "MediSync video consultations are strictly restricted to the booked patient and assigned doctor.",
    signInCta: "Sign In on Portal",
    backToCareBtn: "Back to Care Workspace",
    accessDeniedTitle: "Private Consultation Room Restricted",
    accessDeniedBody:
      "Only the assigned doctor and booked patient for this telehealth appointment may join or view this session.",
    nonTelehealthTitle: "In-Person Visit — Video Room Not Active",
    nonTelehealthBody:
      "This appointment is scheduled as an in-clinic or home visit. Use Video Call bookings to open a live telehealth room.",
    inactiveTitle: "Appointment Inactive or Cancelled",
    inactiveBody:
      "This appointment has been cancelled or closed and cannot host a live consultation.",
    notFoundTitle: "Consultation Room Not Found",
    notFoundBody:
      "Check your My Visits or Doctor Calendar link and ensure the appointment exists.",
    loadingRoom: "Securing encrypted video room and clinical chart...",
    waitingForDoctor: "Waiting for the doctor to join the room...",
    waitingForPatient: "Waiting for the patient to join the video room...",
    connectedLiveHd: "Live Video Connected",
    connectingRtc: "Connecting Media...",
    reconnectingRtc: "Reconnecting Media...",
    clinicalSyncModeTitle: "Camera / mic unavailable — Clinical consultation mode active",
    clinicalSyncModeBody:
      "You can still receive remote video/audio if available, and live diagnosis notes and QR prescriptions synchronize in real time.",
    peerMutedMic: "Microphone muted",
    peerCameraOff: "Camera turned off",
    youLabel: "You",
    doctorLabel: "Attending Physician",
    patientLabel: "Patient",
    micOnAria: "Mute microphone",
    micOffAria: "Unmute microphone",
    camOnAria: "Turn camera off",
    camOffAria: "Turn camera on",
    reconnectBtn: "Reconnect Video",
    completeVisitBtn: "Complete & Close Visit",
    completingVisitBtn: "Completing...",
    endCallBtn: "Leave Call",
    callEndedTitle: "Consultation session disconnected",
    callEndedBody:
      "Your saved clinical notes and QR e-prescriptions remain accessible in the patient health folder.",
    rejoinCallBtn: "Rejoin Room",
    safetyAlertTitle: "Patient Clinical Safety",
    bloodTypePrefix: "Blood Group:",
    noAllergiesLabel: "No recorded allergies",
    unknownBloodLabel: "Unverified",
    doctorDeskTitle: "Live Clinical Diagnosis & E-Rx",
    doctorDeskSub:
      "Notes & prescriptions saved here appear immediately on the patient's consultation screen.",
    icd10Label: "Diagnosis Code (ICD-10)",
    subjectiveLabel: "Patient Symptoms (Subjective)",
    subjectivePlaceholder: "Reported symptoms, duration, and pain severity...",
    objectiveLabel: "Visual Exam & Vitals (Objective)",
    objectivePlaceholder: "Visual breathing, skin signs, home BP/HR readings...",
    assessmentLabel: "Medical Diagnosis (Assessment)",
    assessmentPlaceholder: "Primary clinical impression / diagnosis...",
    planLabel: "Treatment & Follow-Up Plan",
    planPlaceholder: "Therapy instructions, warning signs, follow-up timeframe...",
    saveDiagnosisBtn: "Save & Share Diagnosis Live",
    diagnosisSavedBanner: "Clinical diagnosis saved and pushed live to the patient.",
    rxHeading: "Issue Instant QR Prescription",
    medLabel: "Medication",
    medPlaceholder: "e.g. Amoxicillin 500mg",
    dosageLabel: "Dosage",
    dosagePlaceholder: "1 capsule",
    freqLabel: "Frequency",
    freqPlaceholder: "Every 8 hours",
    daysLabel: "Days",
    issueRxBtn: "Send QR E-Prescription",
    rxIssuedBanner: "QR E-Prescription issued and sent live to the patient.",
    patientCompanionTitle: "Your Consultation File",
    patientCompanionSub:
      "The doctor's diagnosis and prescriptions appear here automatically during the video call.",
    reasonPrefix: "Visit reason:",
    liveUpdateToast: "Your doctor just updated your live diagnosis / prescription.",
    latestDiagnosisTitle: "Live Diagnosis & Care Plan",
    noDiagnosisYet:
      "The doctor has not published a diagnosis for this session yet. Stay on the call and it will appear here automatically.",
    latestRxTitle: "Prescriptions from This Consultation",
    noRxYet: "Any digital QR prescription issued during this call will show up right here.",
    openPharmacyCta: "Dispense QR at Duty Pharmacy",
    historyErrorPrefix: "Unable to save:",
  },
  fr: {
    headerEyebrow: "Téléconsultation Vidéo Chiffrée",
    encryptedBadge: "WebRTC DTLS-SRTP",
    turnRelayBadge: "Relais TURN Pare-feu",
    signInRequiredTitle: "Connectez-vous pour rejoindre la salle vidéo privée",
    signInRequiredBody:
      "Les téléconsultations MediSync sont strictement réservées au patient et au médecin assigné.",
    signInCta: "Connexion au Portail",
    backToCareBtn: "Retour à l'espace soins",
    accessDeniedTitle: "Accès à la salle vidéo restreint",
    accessDeniedBody:
      "Seuls le médecin assigné et le patient concerné par ce rendez-vous peuvent accéder à cette téléconsultation.",
    nonTelehealthTitle: "Visite physique — Salle vidéo inactive",
    nonTelehealthBody:
      "Ce rendez-vous est prévu au cabinet ou à domicile. Réservez un créneau Appel Vidéo pour lancer une téléconsultation.",
    inactiveTitle: "Rendez-vous annulé ou inactif",
    inactiveBody: "Ce rendez-vous a été annulé et ne peut plus héberger d'appel vidéo.",
    notFoundTitle: "Salle de consultation introuvable",
    notFoundBody:
      "Vérifiez le lien depuis Mes Visites ou l'Agenda Médecin et assurez-vous que le rendez-vous existe.",
    loadingRoom: "Sécurisation du flux vidéo chiffré et du dossier...",
    waitingForDoctor: "En attente de l'arrivée du médecin dans la salle...",
    waitingForPatient: "En attente de la connexion du patient...",
    connectedLiveHd: "Vidéo en Direct Active",
    connectingRtc: "Connexion média...",
    reconnectingRtc: "Reconnexion média...",
    clinicalSyncModeTitle: "Caméra / micro indisponible — Mode clinique actif",
    clinicalSyncModeBody:
      "Vous pouvez recevoir la vidéo distante si disponible, et le diagnostic ainsi que l'ordonnance QR restent synchronisés en direct.",
    peerMutedMic: "Micro coupé",
    peerCameraOff: "Caméra coupée",
    youLabel: "Vous",
    doctorLabel: "Médecin Traitant",
    patientLabel: "Patient",
    micOnAria: "Couper le micro",
    micOffAria: "Activer le micro",
    camOnAria: "Couper la caméra",
    camOffAria: "Allumer la caméra",
    reconnectBtn: "Reconnecter la vidéo",
    completeVisitBtn: "Terminer la consultation",
    completingVisitBtn: "Clôture...",
    endCallBtn: "Quitter l'appel",
    callEndedTitle: "Session vidéo terminée",
    callEndedBody:
      "Les notes cliniques et ordonnances QR enregistrées restent disponibles dans le dossier patient.",
    rejoinCallBtn: "Rejoindre à nouveau",
    safetyAlertTitle: "Sécurité Clinique Patient",
    bloodTypePrefix: "Groupe sanguin :",
    noAllergiesLabel: "Aucune allergie signalée",
    unknownBloodLabel: "Non vérifié",
    doctorDeskTitle: "Diagnostic en Direct & Ordonnance QR",
    doctorDeskSub:
      "Tout diagnostic ou ordonnance enregistré s'affiche instantanément chez le patient.",
    icd10Label: "Code Diagnostic (CIM-10)",
    subjectiveLabel: "Symptômes décrits (Subjectif)",
    subjectivePlaceholder: "Plaintes du patient, durée, intensité...",
    objectiveLabel: "Examen visuel & Constantes (Objectif)",
    objectivePlaceholder: "Aspect clinique, signes vitaux communiqués...",
    assessmentLabel: "Diagnostic Médical (Évaluation)",
    assessmentPlaceholder: "Diagnostic retenu ou hypothèse clinique...",
    planLabel: "Traitement & Suivi (Plan)",
    planPlaceholder: "Conduite à tenir, signaux d'alerte, prochain contrôle...",
    saveDiagnosisBtn: "Enregistrer & Partager le Diagnostic",
    diagnosisSavedBanner: "Diagnostic enregistré et transmis en direct au patient.",
    rxHeading: "Émettre une Ordonnance QR en Direct",
    medLabel: "Médicament",
    medPlaceholder: "ex. Amoxicilline 500mg",
    dosageLabel: "Posologie",
    dosagePlaceholder: "1 gélule",
    freqLabel: "Fréquence",
    freqPlaceholder: "Toutes les 8h",
    daysLabel: "Jours",
    issueRxBtn: "Envoyer Ordonnance QR",
    rxIssuedBanner: "Ordonnance QR émise et visible immédiatement par le patient.",
    patientCompanionTitle: "Votre Dossier de Consultation",
    patientCompanionSub:
      "Le diagnostic du médecin et vos ordonnances apparaissent ici automatiquement pendant l'appel.",
    reasonPrefix: "Motif :",
    liveUpdateToast: "Le médecin vient de mettre à jour votre diagnostic / ordonnance.",
    latestDiagnosisTitle: "Diagnostic & Plan de Soins en Direct",
    noDiagnosisYet:
      "Le médecin n'a pas encore publié de diagnostic pour cette téléconsultation.",
    latestRxTitle: "Ordonnances de cette Consultation",
    noRxYet: "Toute ordonnance numérique émise pendant cet appel s'affichera ici.",
    openPharmacyCta: "Présenter l'Ordonnance QR en Pharmacie",
    historyErrorPrefix: "Erreur d'enregistrement :",
  },
  ar: {
    headerEyebrow: "استشارة طبية مباشرة بالفيديو (مشفرة)",
    encryptedBadge: "تشفير WebRTC DTLS-SRTP",
    turnRelayBadge: "ممر TURN محمي",
    signInRequiredTitle: "سجّل الدخول لفتح غرفة الاستشارة الخاصة",
    signInRequiredBody:
      "غرف الفحص بالفيديو فـ MediSync محمية ومسموحة فقط للمريض صاحب الموعد والطبيب المعالج.",
    signInCta: "تسجيل الدخول عبر البوابة",
    backToCareBtn: "الرجوع إلى فضاء الرعاية",
    accessDeniedTitle: "هذه الغرفة الطبية خاصة ومحمية",
    accessDeniedBody:
      "فقط الطبيب المعني والمريض صاحب هذا الموعد يمكنهما الدخول ومشاهدة المكالمة والتشخيص.",
    nonTelehealthTitle: "هذا الموعد حضوري وليس مكالمة فيديو",
    nonTelehealthBody:
      "تم حجز هذا الموعد كزيارة في العيادة أو المنزل. لحجز مكالمة فيديو اختر طريقة 'مكالمة فيديو'.",
    inactiveTitle: "الموعد ملغى أو غير نشط",
    inactiveBody: "لا يمكن بدء مكالمة فيديو لموعد تم إلغاؤه أو إغلاقه.",
    notFoundTitle: "غرفة الاستشارة غير موجودة",
    notFoundBody:
      "تأكد من رابط الموعد من صفحة مواعيدي أو من جدول مواعيد الطبيب.",
    loadingRoom: "جاري تأمين مكالمة الفيديو المشفرة والملف الطبي...",
    waitingForDoctor: "في انتظار دخول الطبيب إلى غرفة الفحص...",
    waitingForPatient: "في انتظار دخول المريض إلى مكالمة الفيديو...",
    connectedLiveHd: "مكالمة فيديو مباشرة",
    connectingRtc: "جاري ربط الصوت والصورة...",
    reconnectingRtc: "جاري إعادة ربط الفيديو...",
    clinicalSyncModeTitle: "الكاميرا أو الميكروفون غير متاحين — وضع المزامنة الطبية شغال",
    clinicalSyncModeBody:
      "يمكنك الاستمرار في المتابعة واستقبال التشخيص والوصفة الطبية الرقمية مباشرة من الطبيب أثناء الموعد.",
    peerMutedMic: "الميكروفون صامت",
    peerCameraOff: "الكاميرا مغلقة",
    youLabel: "أنت",
    doctorLabel: "الطبيب المعالج",
    patientLabel: "المريض",
    micOnAria: "كتم الميكروفون",
    micOffAria: "تشغيل الميكروفون",
    camOnAria: "إيقاف الكاميرا",
    camOffAria: "تشغيل الكاميرا",
    reconnectBtn: "إعادة ربط الفيديو",
    completeVisitBtn: "إنهاء الفحص وإغلاق الموعد",
    completingVisitBtn: "جاري الإغلاق...",
    endCallBtn: "مغادرة المكالمة",
    callEndedTitle: "تم إنهاء جلسة الفيديو",
    callEndedBody:
      "التشخيص الطبي والوصفات الإلكترونية المحفوظة كتبقى متوفرة في الملف الصحي للمريض.",
    rejoinCallBtn: "العودة للمكالمة",
    safetyAlertTitle: "تنبيهات السلامة الطبية",
    bloodTypePrefix: "فصيلة الدم:",
    noAllergiesLabel: "لا توجد حساسية مسجلة",
    unknownBloodLabel: "غير محددة",
    doctorDeskTitle: "كتابة التشخيص المباشر والوصفة الطبية",
    doctorDeskSub:
      "أي تشخيص أو وصفة دواء تكتبها هنا كتبان للمريض مباشرة على شاشته داخل الموقع.",
    icd10Label: "رمز التشخيص (ICD-10)",
    subjectiveLabel: "الأعراض التي يشتكي منها المريض",
    subjectivePlaceholder: "وصف الأعراض، مدة الألم، التاريخ المرضي...",
    objectiveLabel: "الملاحظات السريرية والفحص البصري",
    objectivePlaceholder: "الحالة العامة، التنفس، القياسات المنزلية...",
    assessmentLabel: "التشخيص الطبي النهائي",
    assessmentPlaceholder: "التشخيص الطبي للحالة...",
    planLabel: "خطة العلاج والنصائح والمتابعة",
    planPlaceholder: "العلاج المقترح، علامات الخطر، موعد المتابعة...",
    saveDiagnosisBtn: "حفظ ومشاركة التشخيص مباشرة",
    diagnosisSavedBanner: "تم حفظ التشخيص وإرساله مباشرة لشاشة المريض.",
    rxHeading: "إصدار وصفة دواء إلكترونية (QR) مباشرة",
    medLabel: "اسم الدواء",
    medPlaceholder: "مثال: Amoxicillin 500mg",
    dosageLabel: "الجرعة",
    dosagePlaceholder: "حبة واحدة",
    freqLabel: "الوتيرة",
    freqPlaceholder: "كل 8 ساعات",
    daysLabel: "المدة (أيام)",
    issueRxBtn: "إرسال الوصفة الرقمية الآن",
    rxIssuedBanner: "تم إرسال الوصفة الرقمية (QR) لشاشة المريض فوراً.",
    patientCompanionTitle: "ملف الفحص المباشر الخاص بك",
    patientCompanionSub:
      "تشخيص الطبيب ووصفات الأدوية غادي تطلع ليك هنا أوتوماتيكياً خلال مكالمة الفيديو.",
    reasonPrefix: "سبب الاستشارة:",
    liveUpdateToast: "قام الطبيب بتحديث التشخيص أو الوصفة الطبية الآن.",
    latestDiagnosisTitle: "التشخيص الطبي وخطة العلاج",
    noDiagnosisYet:
      "الطبيب مازال ما سجلش التشخيص النهائي لهذا الموعد. غادي يظهر هنا مباشرة فور تسجيله.",
    latestRxTitle: "الوصفات الطبية الصادرة فهاد الجلسة",
    noRxYet: "أي وصفة دواء يكتبها الطبيب أثناء المكالمة ستظهر هنا برمز QR.",
    openPharmacyCta: "صرف الوصفة QR بالصيدلية",
    historyErrorPrefix: "تعذر الحفظ:",
  },
};
