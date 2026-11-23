import type {
  AppointmentStatus,
  LabOrderStatus,
  LocaleCode,
} from "@medisync/contracts";

export interface ClinicalCopy {
  weekdaysShort: readonly [string, string, string, string, string, string, string];
  weekdaysFull: readonly [string, string, string, string, string, string, string];
  header: {
    homeNursingTitle: string;
    nursingTitle: string;
    doctorTitle: string;
    guestLab: string;
    guestNursing: string;
    guestClinical: string;
    syncBtn: string;
    guardLabTitle: string;
    guardLabRoles: string;
    guardClinicalTitle: string;
    guardClinicalRoles: string;
    tabsAria: string;
  };
  agenda: {
    title: string;
    subtitle: string;
    allDatesBtn: (count: number) => string;
    todayOnlyBtn: string;
    kpiConfirmed: string;
    kpiCheckedIn: string;
    kpiCompleted: string;
    kpiActiveShifts: string;
    prev7Aria: string;
    jumpDateAria: string;
    next7Aria: string;
    filterAllStatuses: string;
    filterCheckedIn: string;
    filterWaiting: string;
    filterCompleted: string;
    clientsCount: (n: number) => string;
    shiftCount: (n: number) => string;
    openSlotLabel: string;
    clientAppointmentsTitle: (n: number) => string;
    showAllDatesBtn: string;
    signInHint: string;
    emptyVisitsTitle: string;
    emptyVisitsBody: string;
    visitNotePrefix: string;
    openChartBtn: string;
    joinVideoBtn: string;
    checkInBtn: string;
    noShowBtn: string;
    cancelBtn: string;
    completeVisitBtn: string;
    ehrSnapshotTitle: string;
    bloodBadge: (b: string) => string;
    ehrLoading: string;
    ehrEmpty: string;
    dobPrefix: string;
    notSet: string;
    conditionsLabel: string;
    noneRecorded: string;
    activeMedsLabel: string;
    emergencyContactLabel: string;
    recordedAllergiesTitle: (n: number) => string;
    noKnownAllergies: string;
    weeklyGridTitle: string;
    publishEditShiftsBtn: string;
    noShiftWindow: string;
    slotMinutesUnit: string;
  };
  schedule: {
    heading: string;
    signInHint: string;
    specialtyLabel: string;
    licenseLabel: string;
    feeLabel: (currency: string) => string;
    practitionerLabel: string;
    practitionerPlaceholder: string;
    practitionerEmpty: string;
    clinicLabel: string;
    clinicPlaceholder: string;
    clinicEmpty: string;
    dayOfWeekLabel: string;
    visitFormatLabel: string;
    startTimeLabel: string;
    endTimeLabel: string;
    slotDurationLabel: string;
    publishBtn: string;
    activeRostersTitle: (n: number) => string;
  };
  doctorTab: {
    heading: string;
    patientLabel: string;
    patientPlaceholder: string;
    patientEmpty: string;
    icd10Label: string;
    subjectiveLabel: string;
    subjectivePlaceholder: string;
    objectiveLabel: string;
    objectivePlaceholder: string;
    assessmentLabel: string;
    assessmentPlaceholder: string;
    planLabel: string;
    planPlaceholder: string;
    medicationLabel: string;
    dosageLabel: string;
    frequencyLabel: string;
    daysLabel: string;
    historyTitle: (n: number) => string;
    historyEmpty: (country: string) => string;
    unspecifiedCode: string;
    assessmentInlinePrefix: string;
    planInlinePrefix: string;
    qrPrescriptionsTitle: (n: number) => string;
  };
  pharmacyTab: {
    heading: string;
    qrInputLabel: string;
    qrInputPlaceholder: string;
    verifyBtn: string;
    authenticityHint: string;
    patientPrefix: string;
    rxPrefix: string;
    daysShort: string;
    batchNotePlaceholder: string;
    confirmDispensedBtn: string;
    recentTitle: (n: number) => string;
  };
  labsTab: {
    labWorkflowTag: string;
    clinicalWorkflowTag: string;
    signInHint: string;
    noActiveOrders: (country: string) => string;
    markCompletedBtn: string;
    attachSectionTitle: string;
    dropzoneLabel: string;
    dropzoneHint: string;
    docFormatLabel: string;
    linkLabOrderLabel: string;
    standaloneFileOption: string;
    uploadedSuccessPrefix: string;
    diagnosticLabLabel: string;
    diagnosticLabPlaceholder: string;
    diagnosticLabEmpty: string;
    diagnosticPanelLabel: string;
    urgencyLabel: string;
    urgencyAria: string;
    createOrderBtn: string;
    uploadedFilesTitle: (n: number) => string;
    previewBtn: string;
    zoomScanAria: (name: string) => string;
    clinicalMediaSubtitle: (status: string) => string;
    specFileSize: string;
    specFormat: string;
    specStatus: string;
  };
  aside: {
    safetyTitle: string;
    bloodTypeLabel: string;
    pendingVerification: string;
    recordedAllergies: string;
    noDrugAllergies: string;
    conditionsPrefix: string;
    activeRxPrefix: string;
    labMetricsTitle: string;
    clinicalMetricsTitle: string;
    orderedQueue: string;
    inProcessing: string;
    completedPanels: string;
    uploadedScans: string;
    scheduledVisits: string;
    activeLabs: string;
    ePrescriptions: string;
    manageShiftsBtn: string;
  };
  enums: {
    patientAccount: string;
    appointmentStatus: Record<AppointmentStatus, string>;
    labStatus: Record<LabOrderStatus, string>;
    rxStatus: Record<string, string>;
    severity: Record<string, string>;
    uploadStatus: Record<string, string>;
    verifiedStatus: Record<string, string>;
  };
  messages: {
    conflictRefreshed: string;
    apptUpdateFailed: (err: string) => string;
    apptUpdated: (patient: string, status: string) => string;
    signInToPublish: string;
    invalidShiftWindow: string;
    shiftPublishFailed: (err: string) => string;
    shiftPublished: (doc: string, fac: string) => string;
    visitNoteError: (err: string) => string;
    visitNoteSaved: (patient: string) => string;
    rxError: (err: string) => string;
    rxIssued: (shortId: string) => string;
    qrRejected: (err: string) => string;
    rxSignatureVerified: (patient: string) => string;
    doubleDispenseBlocked: string;
    dispenseFailed: (err: string) => string;
    rxDispensed: string;
    labOrderError: (err: string) => string;
    labOrderQueued: (panel: string) => string;
    selectPatientForUpload: string;
    binaryUploadFailed: (err: string) => string;
    uploadedDiagnosticFile: (file: string) => string;
    labUpdateFailed: (err: string) => string;
    labCompleted: (panel: string) => string;
    loadedPatientIntoComposer: (patient: string) => string;
  };
}

export const CLINICAL_COPY: Record<LocaleCode, ClinicalCopy> = {
  en: {
    weekdaysShort: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
    weekdaysFull: [
      "Sunday",
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
    ],
    header: {
      homeNursingTitle: "Home Nursing Care, Vitals & Visit Schedule",
      nursingTitle: "Nursing Care, Triage & Visit Schedule",
      doctorTitle: "Doctor Consultation, E-Rx & Clinic Shifts",
      guestLab: "Lab Desk",
      guestNursing: "Nursing Desk",
      guestClinical: "Clinical Desk",
      syncBtn: "Sync Clinical Records",
      guardLabTitle: "Diagnostic Lab Queue & Encrypted Scans",
      guardLabRoles: "Verified Lab Technicians, Physicians, and Hospital Administrators",
      guardClinicalTitle: "Clinical Care & Consultation Desk",
      guardClinicalRoles: "Verified Physicians (Doctors)",
      tabsAria: "Clinical Workspace Modules",
    },
    agenda: {
      title: "Daily Client Queue & Calendar",
      subtitle:
        "Review upcoming patient bookings, check clients in on arrival, and open any patient chart directly in 1 tap.",
      allDatesBtn: (count) => `All Dates (${count})`,
      todayOnlyBtn: "Today Only",
      kpiConfirmed: "Confirmed",
      kpiCheckedIn: "Checked In",
      kpiCompleted: "Completed",
      kpiActiveShifts: "Active Shifts",
      prev7Aria: "Previous 7 days",
      jumpDateAria: "Jump to calendar date",
      next7Aria: "Next 7 days",
      filterAllStatuses: "All Statuses",
      filterCheckedIn: "Checked In",
      filterWaiting: "Waiting",
      filterCompleted: "Completed",
      clientsCount: (n) => `${n} client${n === 1 ? "" : "s"}`,
      shiftCount: (n) => `${n} shift`,
      openSlotLabel: "Open",
      clientAppointmentsTitle: (n) => `Client Appointments (${n})`,
      showAllDatesBtn: "Show All Upcoming Dates",
      signInHint:
        "Sign in on the Care Portal as a verified Doctor or Clinic Staff coordinator to manage your live client calendar and appointments.",
      emptyVisitsTitle: "No client visits match this calendar filter.",
      emptyVisitsBody:
        "Switch dates above or publish weekly clinic hours so patients can reserve slots.",
      visitNotePrefix: "Visit note:",
      openChartBtn: "Open Chart & Rx",
      joinVideoBtn: "Start Video Consult",
      checkInBtn: "Check In",
      noShowBtn: "No Show",
      cancelBtn: "Cancel",
      completeVisitBtn: "Complete Visit",
      ehrSnapshotTitle: "Patient EHR & Allergy Snapshot",
      bloodBadge: (b) => `Blood: ${b}`,
      ehrLoading: "Loading patient medical record...",
      ehrEmpty: "Select a patient to view record.",
      dobPrefix: "DOB",
      notSet: "Not set",
      conditionsLabel: "Conditions:",
      noneRecorded: "None recorded",
      activeMedsLabel: "Active Medications:",
      emergencyContactLabel: "Emergency Contact:",
      recordedAllergiesTitle: (n) => `Recorded Allergies (${n})`,
      noKnownAllergies: "No known drug allergies recorded.",
      weeklyGridTitle: "Weekly Clinic Availability Grid",
      publishEditShiftsBtn: "Publish / Edit Shifts",
      noShiftWindow: "No shift window",
      slotMinutesUnit: "m",
    },
    schedule: {
      heading: "Publish Multi-Clinic Shift Window",
      signInHint:
        "Sign in via the Care Portal as a Doctor, Clinic Coordinator, Hospital Director, or Compliance Admin to manage weekly provider shifts.",
      specialtyLabel: "Specialty",
      licenseLabel: "Medical License #",
      feeLabel: (currency) => `Consultation Fee (${currency} minor)`,
      practitionerLabel: "Doctor or Nurse",
      practitionerPlaceholder: "Filter practitioner by name or specialty...",
      practitionerEmpty: "No practitioners listed in this region",
      clinicLabel: "Clinic or Hospital",
      clinicPlaceholder: "Filter facility by name...",
      clinicEmpty: "No verified facilities in this region",
      dayOfWeekLabel: "Day of Week",
      visitFormatLabel: "Visit Format",
      startTimeLabel: "Start Time",
      endTimeLabel: "End Time",
      slotDurationLabel: "Slot Duration (min)",
      publishBtn: "Publish Clinic Schedule Window",
      activeRostersTitle: (n) => `Active Clinic Rosters (${n})`,
    },
    doctorTab: {
      heading: "Consultation Visit Notes & QR E-Prescription",
      patientLabel: "Patient",
      patientPlaceholder: "Filter patient by name or email...",
      patientEmpty: "Sign in to browse patients in this region",
      icd10Label: "Diagnosis Codes (Optional, e.g. J06.9)",
      subjectiveLabel: "Subjective",
      subjectivePlaceholder: "Chief complaint & symptom timeline",
      objectiveLabel: "Objective",
      objectivePlaceholder: "Exam findings & vitals",
      assessmentLabel: "Assessment",
      assessmentPlaceholder: "Primary clinical impression",
      planLabel: "Plan",
      planPlaceholder: "Therapy, labs & follow-up",
      medicationLabel: "Medication",
      dosageLabel: "Dosage",
      frequencyLabel: "Frequency",
      daysLabel: "Days",
      historyTitle: (n) => `Consultation History (${n})`,
      historyEmpty: (country) =>
        `Sign in as a Doctor or Patient in ${country} to view consultation visit notes.`,
      unspecifiedCode: "UNSPECIFIED",
      assessmentInlinePrefix: "Assessment:",
      planInlinePrefix: "Plan:",
      qrPrescriptionsTitle: (n) => `Scannable E-Prescriptions & QR Codes (${n})`,
    },
    pharmacyTab: {
      heading: "Pharmacy QR Verification & Safe Dispensing",
      qrInputLabel: "Prescription QR Code",
      qrInputPlaceholder:
        "Paste prescription code from the patient's digital QR card...",
      verifyBtn: "Verify Prescription",
      authenticityHint:
        "Every digital prescription is checked for authenticity and cannot be dispensed twice.",
      patientPrefix: "Patient:",
      rxPrefix: "Rx",
      daysShort: "d",
      batchNotePlaceholder: "Dispensing batch note (optional)",
      confirmDispensedBtn: "Confirm Dispensed",
      recentTitle: (n) => `Recent Prescriptions (${n})`,
    },
    labsTab: {
      labWorkflowTag: "Sample -> Report -> Sign-Off",
      clinicalWorkflowTag: "Physician Orders & Scans",
      signInHint:
        "Sign in via the header as a verified Lab Technician, Physician, or Clinic Coordinator to process ordered panels.",
      noActiveOrders: (country) =>
        `No active diagnostic lab orders in ${country} yet.`,
      markCompletedBtn: "Mark Completed",
      attachSectionTitle: "Attach Diagnostic PDF Report or Imaging Scan",
      dropzoneLabel: "Diagnostic Scan / Lab PDF Upload",
      dropzoneHint:
        "Drag & drop X-ray PNG/JPG/WebP, medical imaging, or lab report PDF",
      docFormatLabel: "Document Format",
      linkLabOrderLabel: "Link to Lab Order (Optional)",
      standaloneFileOption: "Standalone clinical file",
      uploadedSuccessPrefix: "Diagnostic report uploaded and verified:",
      diagnosticLabLabel: "Diagnostic Lab",
      diagnosticLabPlaceholder: "Filter lab by name or city...",
      diagnosticLabEmpty: "No diagnostic labs available in this region",
      diagnosticPanelLabel: "Diagnostic Panel",
      urgencyLabel: "Urgency",
      urgencyAria: "Lab order urgency",
      createOrderBtn: "Create Lab Order",
      uploadedFilesTitle: (n) => `Uploaded Clinical Scans & Lab PDFs (${n})`,
      previewBtn: "Preview",
      zoomScanAria: (name) => `Zoom scan ${name}`,
      clinicalMediaSubtitle: (status) => `Clinical Media · ${status}`,
      specFileSize: "File Size",
      specFormat: "Format",
      specStatus: "Status",
    },
    aside: {
      safetyTitle: "Patient Safety & Allergies",
      bloodTypeLabel: "Blood Type",
      pendingVerification: "Pending verification",
      recordedAllergies: "Recorded Allergies",
      noDrugAllergies: "No drug allergies recorded on patient chart.",
      conditionsPrefix: "Conditions:",
      activeRxPrefix: "Active Rx:",
      labMetricsTitle: "Diagnostic Desk Metrics",
      clinicalMetricsTitle: "Clinical Summary",
      orderedQueue: "Ordered Queue",
      inProcessing: "In Processing",
      completedPanels: "Completed Panels",
      uploadedScans: "Uploaded Scans",
      scheduledVisits: "Scheduled Visits",
      activeLabs: "Active Labs",
      ePrescriptions: "E-Prescriptions",
      manageShiftsBtn: "Manage Clinic Shifts",
    },
    enums: {
      patientAccount: "Patient account",
      appointmentStatus: {
        CONFIRMED: "CONFIRMED",
        CHECKED_IN: "CHECKED_IN",
        COMPLETED: "COMPLETED",
        CANCELLED: "CANCELLED",
        NO_SHOW: "NO_SHOW",
      },
      labStatus: {
        ORDERED: "ORDERED",
        SAMPLE_COLLECTED: "SAMPLE_COLLECTED",
        COMPLETED: "COMPLETED",
        CANCELLED: "CANCELLED",
      },
      rxStatus: {
        ISSUED: "ISSUED",
        DISPENSED: "DISPENSED",
        CANCELLED: "CANCELLED",
      },
      severity: {
        MILD: "MILD",
        MODERATE: "MODERATE",
        SEVERE: "SEVERE",
        LIFE_THREATENING: "LIFE_THREATENING",
      },
      uploadStatus: {
        PENDING: "PENDING",
        UPLOADED: "UPLOADED",
        FAILED: "FAILED",
      },
      verifiedStatus: {
        PENDING: "PENDING",
        VERIFIED: "VERIFIED",
        REJECTED: "REJECTED",
      },
    },
    messages: {
      conflictRefreshed:
        "Appointment already transitioned in another window. Queue refreshed.",
      apptUpdateFailed: (err) => `Appointment update failed: ${err}`,
      apptUpdated: (patient, status) => `${patient} updated to ${status}.`,
      signInToPublish:
        "Sign in on the Care Portal as a Doctor or Coordinator to publish shifts.",
      invalidShiftWindow: "Invalid shift window.",
      shiftPublishFailed: (err) => `Failed to publish shift: ${err}`,
      shiftPublished: (doc, fac) => `Published shift for ${doc} at ${fac}.`,
      visitNoteError: (err) => `Visit note error: ${err}`,
      visitNoteSaved: (patient) =>
        `Consultation visit note saved for ${patient}.`,
      rxError: (err) => `E-Rx error: ${err}`,
      rxIssued: (shortId) => `Issued signed QR e-prescription (${shortId}).`,
      qrRejected: (err) => `QR rejected: ${err}`,
      rxSignatureVerified: (patient) =>
        `Prescription signature verified for ${patient}.`,
      doubleDispenseBlocked:
        "Double-dispensing blocked: prescription has already been fulfilled.",
      dispenseFailed: (err) => `Dispense failed: ${err}`,
      rxDispensed: "Medication prescription marked as dispensed.",
      labOrderError: (err) => `Lab order error: ${err}`,
      labOrderQueued: (panel) => `Lab order queued for ${panel}.`,
      selectPatientForUpload:
        "Select a patient (or sign in as a patient) before uploading a medical file.",
      binaryUploadFailed: (err) => `Binary upload failed: ${err}`,
      uploadedDiagnosticFile: (file) =>
        `Uploaded & verified diagnostic file ${file}.`,
      labUpdateFailed: (err) => `Lab update failed: ${err}`,
      labCompleted: (panel) => `Lab order ${panel} completed.`,
      loadedPatientIntoComposer: (patient) =>
        `Loaded ${patient} into Consultation & E-Rx Composer.`,
    },
  },
  fr: {
    weekdaysShort: ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"],
    weekdaysFull: [
      "Dimanche",
      "Lundi",
      "Mardi",
      "Mercredi",
      "Jeudi",
      "Vendredi",
      "Samedi",
    ],
    header: {
      homeNursingTitle: "Soins Infirmiers à Domicile, Constantes & Tournées",
      nursingTitle: "Soins Infirmiers, Triage & Planning",
      doctorTitle: "Consultations Médecin, E-Rx & Créneaux",
      guestLab: "Espace Labo",
      guestNursing: "Espace Soins Infirmiers",
      guestClinical: "Espace Clinique",
      syncBtn: "Synchroniser Dossiers",
      guardLabTitle: "File Laboratoire & Imagerie Chiffrée",
      guardLabRoles: "Techniciens de laboratoire, médecins et coordinateurs vérifiés",
      guardClinicalTitle: "Espace Clinique & Consultations",
      guardClinicalRoles: "Médecins vérifiés",
      tabsAria: "Modules cliniques",
    },
    agenda: {
      title: "File Patients & Agenda Quotidien",
      subtitle:
        "Consultez les prochains rendez-vous, enregistrez les arrivées et ouvrez chaque dossier médical en 1 clic.",
      allDatesBtn: (count) => `Toutes les dates (${count})`,
      todayOnlyBtn: "Aujourd'hui",
      kpiConfirmed: "Confirmés",
      kpiCheckedIn: "Arrivés",
      kpiCompleted: "Terminés",
      kpiActiveShifts: "Plages actives",
      prev7Aria: "7 jours précédents",
      jumpDateAria: "Aller à la date",
      next7Aria: "7 jours suivants",
      filterAllStatuses: "Tous les statuts",
      filterCheckedIn: "En salle / Arrivé",
      filterWaiting: "En attente",
      filterCompleted: "Terminés",
      clientsCount: (n) => `${n} patient${n === 1 ? "" : "s"}`,
      shiftCount: (n) => `${n} plage`,
      openSlotLabel: "Libre",
      clientAppointmentsTitle: (n) => `Rendez-vous patients (${n})`,
      showAllDatesBtn: "Afficher toutes les dates à venir",
      signInHint:
        "Connectez-vous sur le Portail Soins en tant que Médecin ou Personnel Clinique vérifié pour gérer l'agenda.",
      emptyVisitsTitle: "Aucune consultation ne correspond à ce filtre.",
      emptyVisitsBody:
        "Changez la date ci-dessus ou publiez des créneaux hebdomadaires pour les patients.",
      visitNotePrefix: "Motif :",
      openChartBtn: "Ouvrir Dossier & E-Rx",
      joinVideoBtn: "Lancer Vidéo",
      checkInBtn: "Enregistrer Arrivée",
      noShowBtn: "Absent",
      cancelBtn: "Annuler",
      completeVisitBtn: "Clôturer la Visite",
      ehrSnapshotTitle: "Dossier Médical & Allergies Patient",
      bloodBadge: (b) => `Groupe : ${b}`,
      ehrLoading: "Chargement du dossier médical...",
      ehrEmpty: "Sélectionnez un patient.",
      dobPrefix: "Né(e) le",
      notSet: "Non renseigné",
      conditionsLabel: "Antécédents :",
      noneRecorded: "Aucun",
      activeMedsLabel: "Traitements en cours :",
      emergencyContactLabel: "Contact d'urgence :",
      recordedAllergiesTitle: (n) => `Allergies connues (${n})`,
      noKnownAllergies: "Aucune allergie médicamenteuse connue.",
      weeklyGridTitle: "Grille Hebdomadaire des Consultations",
      publishEditShiftsBtn: "Publier / Modifier Plages",
      noShiftWindow: "Aucune plage",
      slotMinutesUnit: "min",
    },
    schedule: {
      heading: "Publier des Plages Horaires Multi-Cliniques",
      signInHint:
        "Connectez-vous via le Portail Soins en tant que Médecin ou Coordinateur pour publier vos horaires.",
      specialtyLabel: "Spécialité",
      licenseLabel: "N° Ordre / Licence",
      feeLabel: (currency) => `Tarif Consultation (${currency} centimes)`,
      practitionerLabel: "Médecin ou Infirmier",
      practitionerPlaceholder: "Filtrer par nom ou spécialité...",
      practitionerEmpty: "Aucun praticien listé dans cette région",
      clinicLabel: "Clinique ou Hôpital",
      clinicPlaceholder: "Filtrer par nom d'établissement...",
      clinicEmpty: "Aucun établissement vérifié dans cette région",
      dayOfWeekLabel: "Jour de la semaine",
      visitFormatLabel: "Modalité de visite",
      startTimeLabel: "Heure début",
      endTimeLabel: "Heure fin",
      slotDurationLabel: "Durée créneau (min)",
      publishBtn: "Publier la Plage Horaire",
      activeRostersTitle: (n) => `Plannings actifs (${n})`,
    },
    doctorTab: {
      heading: "Compte-Rendu SOAP & Ordonnance Électronique QR",
      patientLabel: "Patient",
      patientPlaceholder: "Rechercher par nom ou e-mail...",
      patientEmpty: "Connectez-vous pour consulter la patientèle",
      icd10Label: "Codes CIM-10 (Optionnel, ex. J06.9)",
      subjectiveLabel: "Subjectif (Symptômes)",
      subjectivePlaceholder: "Motif principal et historique",
      objectiveLabel: "Objectif (Examen)",
      objectivePlaceholder: "Constantes et observations cliniques",
      assessmentLabel: "Évaluation / Diagnostic",
      assessmentPlaceholder: "Diagnostic clinique principal",
      planLabel: "Plan de soins",
      planPlaceholder: "Traitement, examens et suivi",
      medicationLabel: "Médicament",
      dosageLabel: "Dosage",
      frequencyLabel: "Posologie",
      daysLabel: "Jours",
      historyTitle: (n) => `Historique des Consultations (${n})`,
      historyEmpty: (country) =>
        `Connectez-vous en Médecin ou Patient (${country}) pour voir les comptes-rendus.`,
      unspecifiedCode: "NON SPÉCIFIÉ",
      assessmentInlinePrefix: "Évaluation :",
      planInlinePrefix: "Plan :",
      qrPrescriptionsTitle: (n) => `Ordonnances QR Scannables (${n})`,
    },
    pharmacyTab: {
      heading: "Vérification QR & Délivrance Sécurisée",
      qrInputLabel: "Jeton QR Ordonnance",
      qrInputPlaceholder:
        "Collez le code depuis la carte ordonnance QR du patient...",
      verifyBtn: "Vérifier l'Ordonnance",
      authenticityHint:
        "Chaque ordonnance numérique est authentifiée et protégée contre la double délivrance.",
      patientPrefix: "Patient :",
      rxPrefix: "Ord.",
      daysShort: "j",
      batchNotePlaceholder: "Note de lot / délivrance (optionnel)",
      confirmDispensedBtn: "Confirmer la Délivrance",
      recentTitle: (n) => `Ordonnances Récentes (${n})`,
    },
    labsTab: {
      labWorkflowTag: "Prélèvement -> Compte-rendu -> Validation",
      clinicalWorkflowTag: "Prescriptions Labo & Imagerie",
      signInHint:
        "Connectez-vous en Technicien Labo, Médecin ou Coordinateur pour traiter les bilans.",
      noActiveOrders: (country) =>
        `Aucune analyse de laboratoire en cours (${country}).`,
      markCompletedBtn: "Marquer Terminé",
      attachSectionTitle: "Joindre un Résultat PDF ou Cliché Imagerie",
      dropzoneLabel: "Dépôt Cliché Radio / Résultat PDF",
      dropzoneHint:
        "Glissez-déposez une radiographie PNG/JPG/WebP ou un compte-rendu PDF",
      docFormatLabel: "Format du Document",
      linkLabOrderLabel: "Lier à une demande d'analyse (Optionnel)",
      standaloneFileOption: "Document médical autonome",
      uploadedSuccessPrefix: "Rapport diagnostique déposé et vérifié :",
      diagnosticLabLabel: "Laboratoire d'Analyses",
      diagnosticLabPlaceholder: "Filtrer par nom ou ville...",
      diagnosticLabEmpty: "Aucun laboratoire disponible dans cette région",
      diagnosticPanelLabel: "Bilan / Examen demandé",
      urgencyLabel: "Degré d'urgence",
      urgencyAria: "Priorité de l'analyse",
      createOrderBtn: "Prescrire l'Analyse",
      uploadedFilesTitle: (n) => `Scans & Comptes-Rendus Déposés (${n})`,
      previewBtn: "Aperçu",
      zoomScanAria: (name) => `Agrandir ${name}`,
      clinicalMediaSubtitle: (status) => `Média Clinique · ${status}`,
      specFileSize: "Taille",
      specFormat: "Format",
      specStatus: "Statut",
    },
    aside: {
      safetyTitle: "Sécurité Patient & Allergies",
      bloodTypeLabel: "Groupe sanguin",
      pendingVerification: "En attente de confirmation",
      recordedAllergies: "Allergies Déclarées",
      noDrugAllergies: "Aucune allergie médicamenteuse enregistrée.",
      conditionsPrefix: "Pathologies :",
      activeRxPrefix: "Ordonnances actives :",
      labMetricsTitle: "Activité Laboratoire",
      clinicalMetricsTitle: "Résumé Clinique",
      orderedQueue: "En attente",
      inProcessing: "En cours d'analyse",
      completedPanels: "Bilans terminés",
      uploadedScans: "Fichiers déposés",
      scheduledVisits: "Visites planifiées",
      activeLabs: "Analyses actives",
      ePrescriptions: "Ordonnances QR",
      manageShiftsBtn: "Gérer les Plages Cliniques",
    },
    enums: {
      patientAccount: "Compte patient",
      appointmentStatus: {
        CONFIRMED: "Confirmé",
        CHECKED_IN: "Arrivé",
        COMPLETED: "Terminé",
        CANCELLED: "Annulé",
        NO_SHOW: "Absent",
      },
      labStatus: {
        ORDERED: "Commandé",
        SAMPLE_COLLECTED: "Prélèvement reçu",
        COMPLETED: "Terminé",
        CANCELLED: "Annulée",
      },
      rxStatus: {
        ISSUED: "Émise",
        DISPENSED: "Délivrée",
        CANCELLED: "Annulée",
      },
      severity: {
        MILD: "Légère",
        MODERATE: "Modérée",
        SEVERE: "Sévère",
        LIFE_THREATENING: "Vitale",
      },
      uploadStatus: {
        PENDING: "En attente",
        UPLOADED: "En ligne",
        FAILED: "Échec",
      },
      verifiedStatus: {
        PENDING: "En attente",
        VERIFIED: "Vérifié",
        REJECTED: "Refusé",
      },
    },
    messages: {
      conflictRefreshed:
        "Le rendez-vous a déjà changé de statut. Liste actualisée.",
      apptUpdateFailed: (err) => `Échec mise à jour RDV : ${err}`,
      apptUpdated: (patient, status) => `${patient} mis à jour : ${status}.`,
      signInToPublish:
        "Connectez-vous en Médecin ou Coordinateur pour publier des créneaux.",
      invalidShiftWindow: "Plage horaire invalide.",
      shiftPublishFailed: (err) => `Échec publication plage : ${err}`,
      shiftPublished: (doc, fac) => `Plage publiée pour ${doc} · ${fac}.`,
      visitNoteError: (err) => `Erreur note médicale : ${err}`,
      visitNoteSaved: (patient) =>
        `Compte-rendu enregistré pour ${patient}.`,
      rxError: (err) => `Erreur ordonnance QR : ${err}`,
      rxIssued: (shortId) => `Ordonnance QR signée émise (${shortId}).`,
      qrRejected: (err) => `QR refusé : ${err}`,
      rxSignatureVerified: (patient) =>
        `Signature vérifiée pour ${patient}.`,
      doubleDispenseBlocked:
        "Double délivrance bloquée : cette ordonnance a déjà été exécutée.",
      dispenseFailed: (err) => `Échec délivrance : ${err}`,
      rxDispensed: "Ordonnance marquée comme délivrée.",
      labOrderError: (err) => `Erreur demande labo : ${err}`,
      labOrderQueued: (panel) => `Analyse enregistrée : ${panel}.`,
      selectPatientForUpload:
        "Sélectionnez un patient avant d'importer un fichier médical.",
      binaryUploadFailed: (err) => `Échec de l'envoi : ${err}`,
      uploadedDiagnosticFile: (file) =>
        `Document diagnostique envoyé et vérifié : ${file}.`,
      labUpdateFailed: (err) => `Échec mise à jour analyse : ${err}`,
      labCompleted: (panel) => `Analyse ${panel} finalisée.`,
      loadedPatientIntoComposer: (patient) =>
        `Dossier de ${patient} ouvert dans Consultation & Ordonnance.`,
    },
  },
  ar: {
    weekdaysShort: ["أحد", "إثنين", "ثلاثاء", "أربعاء", "خميس", "جمعة", "سبت"],
    weekdaysFull: [
      "الأحد",
      "الإثنين",
      "الثلاثاء",
      "الأربعاء",
      "الخميس",
      "الجمعة",
      "السبت",
    ],
    header: {
      homeNursingTitle: "الرعاية التمريضية المنزلية، المؤشرات وجدول الزيارات",
      nursingTitle: "العناية التمريضية، الفرز وجدول المواعيد",
      doctorTitle: "استشارات الطبيب، الوصفات الإلكترونية وجدول العمل",
      guestLab: "مكتب المختبر",
      guestNursing: "مكتب التمريض",
      guestClinical: "المكتب السريري",
      syncBtn: "تحديث الملفات الطبية",
      guardLabTitle: "لائحة تحاليل المختبر والأشعة المشفرة",
      guardLabRoles: "تقنيو المختبر المعتمدون، الأطباء ومدراء المستشفيات",
      guardClinicalTitle: "مكتب الاستشارات والرعاية الطبية",
      guardClinicalRoles: "الأطباء المعتمدون",
      tabsAria: "أقسام مساحة العمل السريرية",
    },
    agenda: {
      title: "لائحة المرضى اليومية والتقويم",
      subtitle:
        "راجع حجوزات المرضى القادمة، سجّل وصولهم عند الحضور، وافتح الملف الطبي والوصفة بنقرة واحدة.",
      allDatesBtn: (count) => `جميع التواريخ (${count})`,
      todayOnlyBtn: "اليوم فقط",
      kpiConfirmed: "مؤكدة",
      kpiCheckedIn: "وصل للعيادة",
      kpiCompleted: "مكتملة",
      kpiActiveShifts: "فترات العمل",
      prev7Aria: "الـ 7 أيام السابقة",
      jumpDateAria: "الانتقال إلى تاريخ معين",
      next7Aria: "الـ 7 أيام القادمة",
      filterAllStatuses: "جميع الحالات",
      filterCheckedIn: "حاضر / مسجّل الوصول",
      filterWaiting: "في الانتظار",
      filterCompleted: "مكتملة",
      clientsCount: (n) => (n === 1 ? "مريض واحد" : `${n} مرضى`),
      shiftCount: (n) => (n === 1 ? "حصة واحدة" : `${n} حصص`),
      openSlotLabel: "متاح",
      clientAppointmentsTitle: (n) => `مواعيد المرضى (${n})`,
      showAllDatesBtn: "عرض كل التواريخ القادمة",
      signInHint:
        "سجل الدخول من بوابة الحساب كطبيب أو طاقم عيادة معتمد لإدارة جدول المواعيد المباشر.",
      emptyVisitsTitle: "لا توجد زيارات تطابق هذا الفلتر.",
      emptyVisitsBody:
        "اختر تاريخاً آخر من الأعلى أو أنشئ ساعات العمل الأسبوعية ليتمكن المرضى من الحجز.",
      visitNotePrefix: "سبب الزيارة:",
      openChartBtn: "فتح الملف والوصفة",
      joinVideoBtn: "بدء مكالمة الفيديو",
      checkInBtn: "تسجيل الحضور",
      noShowBtn: "لم يحضر",
      cancelBtn: "إلغاء",
      completeVisitBtn: "إنهاء الفحص",
      ehrSnapshotTitle: "ملخص الملف الطبي والحساسية",
      bloodBadge: (b) => `فصيلة الدم: ${b}`,
      ehrLoading: "جاري تحميل الملف الطبي للمريض...",
      ehrEmpty: "اختر مريضاً لعرض ملفه.",
      dobPrefix: "تاريخ الازدياد:",
      notSet: "غير محدد",
      conditionsLabel: "الأمراض المزمنة:",
      noneRecorded: "لا توجد",
      activeMedsLabel: "الأدوية المستعملة حالياً:",
      emergencyContactLabel: "هاتف الطوارئ:",
      recordedAllergiesTitle: (n) => `أنواع الحساسية المسجلة (${n})`,
      noKnownAllergies: "لا توجد حساسية دوائية مسجلة في الملف.",
      weeklyGridTitle: "جدول التوفر الأسبوعي بالعيادات",
      publishEditShiftsBtn: "نشر أو تعديل الأوقات",
      noShiftWindow: "لا توجد حصة",
      slotMinutesUnit: "د",
    },
    schedule: {
      heading: "نشر أوقات العمل الأسبوعية في العيادات",
      signInHint:
        "سجل الدخول عبر البوابة كطبيب أو منسق مصحة لإدارة ساعات الاستقبال والحجز.",
      specialtyLabel: "التخصص الطبي",
      licenseLabel: "رقم الترخيص المهني",
      feeLabel: (currency) => `سعر الاستشارة (بأجزاء ${currency})`,
      practitionerLabel: "الطبيب أو الممرض",
      practitionerPlaceholder: "ابحث بالاسم أو التخصص...",
      practitionerEmpty: "لا يوجد ممارسون في هذه المنطقة",
      clinicLabel: "العيادة أو المستشفى",
      clinicPlaceholder: "ابحث باسم المؤسسة...",
      clinicEmpty: "لا توجد مؤسسات معتمدة في هذه المنطقة",
      dayOfWeekLabel: "اليوم",
      visitFormatLabel: "نوع الاستشارة",
      startTimeLabel: "وقت البدء",
      endTimeLabel: "وقت الانتهاء",
      slotDurationLabel: "مدة الموعد (دقيقة)",
      publishBtn: "نشر نافذة المواعيد",
      activeRostersTitle: (n) => `ساعات العمل المنشورة (${n})`,
    },
    doctorTab: {
      heading: "ملاحظات الاستشارة الطبية والوصفة الرقمية QR",
      patientLabel: "المريض",
      patientPlaceholder: "ابحث باسم المريض أو بريده...",
      patientEmpty: "سجل الدخول لتصفح لائحة المرضى",
      icd10Label: "رموز التشخيص الطبي (اختياري، مثل J06.9)",
      subjectiveLabel: "شكوى المريض والأعراض",
      subjectivePlaceholder: "الأعراض الرئيسية وتوقيت بدايتها",
      objectiveLabel: "الفحص السريري والعلامات الحيوية",
      objectivePlaceholder: "نتائج الفحص والضغط والحرارة",
      assessmentLabel: "التشخيص الأولي",
      assessmentPlaceholder: "الخلاصة السريرية للحالة",
      planLabel: "خطة العلاج والمتابعة",
      planPlaceholder: "الأدوية، التحاليل المطلوبة والمراجعة",
      medicationLabel: "اسم الدواء",
      dosageLabel: "الجرعة",
      frequencyLabel: "عدد المرات يومياً",
      daysLabel: "المدة (أيام)",
      historyTitle: (n) => `سجل الاستشارات السابقة (${n})`,
      historyEmpty: (country) =>
        `سجل الدخول كطبيب أو مريض في ${country} لعرض ملخصات الزيارات.`,
      unspecifiedCode: "غير محدد",
      assessmentInlinePrefix: "التشخيص:",
      planInlinePrefix: "خطة العلاج:",
      qrPrescriptionsTitle: (n) => `الوصفات الطبية القابلة للمسح QR (${n})`,
    },
    pharmacyTab: {
      heading: "التحقق من وصفة QR وصرف الدواء بأمان",
      qrInputLabel: "رمز الوصفة الرقمية QR",
      qrInputPlaceholder: "ألصق رمز الوصفة من بطاقة المريض...",
      verifyBtn: "التحقق من الوصفة",
      authenticityHint:
        "يتم التحقق من صحة كل وصفة إلكترونية لمنع صرفها أكثر من مرة.",
      patientPrefix: "المريض:",
      rxPrefix: "وصفة",
      daysShort: "ي",
      batchNotePlaceholder: "ملاحظة الصرف أو رقم الدفعة (اختياري)",
      confirmDispensedBtn: "تأكيد صرف الدواء",
      recentTitle: (n) => `أحدث الوصفات الطبية (${n})`,
    },
    labsTab: {
      labWorkflowTag: "عينة -> تقرير -> اعتماد النتيجة",
      clinicalWorkflowTag: "طلبات التحاليل والأشعة",
      signInHint:
        "سجل الدخول من الأعلى كتقني مختبر، طبيب أو منسق عيادة لمعالجة التحاليل المطلوبة.",
      noActiveOrders: (country) =>
        `لا توجد طلبات تحاليل مخبرية نشطة في ${country} حالياً.`,
      markCompletedBtn: "تحديد كمكتمل",
      attachSectionTitle: "إرفاق نتيجة تحليل PDF أو صورة أشعة",
      dropzoneLabel: "رفع ملف التحاليل أو الأشعة",
      dropzoneHint: "اسحب أو اختر صورة أشعة PNG/JPG/WebP أو تقرير مختبر PDF",
      docFormatLabel: "صيغة الملف",
      linkLabOrderLabel: "ربط بطلب تحليل (اختياري)",
      standaloneFileOption: "ملف طبي مستقل",
      uploadedSuccessPrefix: "تم رفع تقرير الفحص وتأكيده:",
      diagnosticLabLabel: "مختبر التحاليل والأشعة",
      diagnosticLabPlaceholder: "ابحث عن المختبر بالاسم أو المدينة...",
      diagnosticLabEmpty: "لا توجد مختبرات متاحة في هذه المنطقة",
      diagnosticPanelLabel: "نوع التحليل أو الفحص المطلوب",
      urgencyLabel: "درجة الاستعجال",
      urgencyAria: "أولوية طلب التحليل",
      createOrderBtn: "إرسال طلب التحليل",
      uploadedFilesTitle: (n) => `الأشعة وتقارير المختبر المرفوعة (${n})`,
      previewBtn: "معاينة",
      zoomScanAria: (name) => `تكبير الصورة ${name}`,
      clinicalMediaSubtitle: (status) => `ملف طبي · ${status}`,
      specFileSize: "حجم الملف",
      specFormat: "الصيغة",
      specStatus: "الحالة",
    },
    aside: {
      safetyTitle: "سلامة المريض والحساسية",
      bloodTypeLabel: "فصيلة الدم",
      pendingVerification: "في انتظار التأكيد",
      recordedAllergies: "الحساسية المسجلة",
      noDrugAllergies: "لا توجد حساسية دوائية مسجلة.",
      conditionsPrefix: "الحالات المزمنة:",
      activeRxPrefix: "العلاجات الحالية:",
      labMetricsTitle: "إحصائيات مكتب المختبر",
      clinicalMetricsTitle: "الملخص السريري",
      orderedQueue: "طلبات جديدة",
      inProcessing: "قيد التحليل",
      completedPanels: "تحاليل مكتملة",
      uploadedScans: "الملفات المرفوعة",
      scheduledVisits: "المواعيد المجدولة",
      activeLabs: "تحاليل نشطة",
      ePrescriptions: "الوصفات الرقمية",
      manageShiftsBtn: "إدارة أوقات العمل بالعيادة",
    },
    enums: {
      patientAccount: "حساب مريض",
      appointmentStatus: {
        CONFIRMED: "مؤكد",
        CHECKED_IN: "وصل للعيادة",
        COMPLETED: "مكتمل",
        CANCELLED: "ملغى",
        NO_SHOW: "تغيّب",
      },
      labStatus: {
        ORDERED: "تم الطلب",
        SAMPLE_COLLECTED: "أُخذت العينة",
        COMPLETED: "مكتمل",
        CANCELLED: "ملغى",
      },
      rxStatus: {
        ISSUED: "صادرة",
        DISPENSED: "تم الصرف",
        CANCELLED: "ملغاة",
      },
      severity: {
        MILD: "خفيفة",
        MODERATE: "متوسطة",
        SEVERE: "شديدة",
        LIFE_THREATENING: "خطيرة جداً",
      },
      uploadStatus: {
        PENDING: "قيد الرفع",
        UPLOADED: "مرفوع",
        FAILED: "فشل",
      },
      verifiedStatus: {
        PENDING: "قيد المراجعة",
        VERIFIED: "معتمد",
        REJECTED: "مرفوض",
      },
    },
    messages: {
      conflictRefreshed: "تغيّرت حالة الموعد في نافذة أخرى. تم تحديث اللائحة.",
      apptUpdateFailed: (err) => `تعذر تحديث الموعد: ${err}`,
      apptUpdated: (patient, status) => `تم تحديث حالة ${patient} إلى ${status}.`,
      signInToPublish: "سجل الدخول كطبيب أو منسق لنشر ساعات العمل.",
      invalidShiftWindow: "نافذة الوقت غير صالحة.",
      shiftPublishFailed: (err) => `تعذر نشر ساعات العمل: ${err}`,
      shiftPublished: (doc, fac) => `تم نشر أوقات ${doc} في ${fac}.`,
      visitNoteError: (err) => `خطأ في حفظ الملاحظة: ${err}`,
      visitNoteSaved: (patient) => `تم حفظ ملخص الزيارة لـ ${patient}.`,
      rxError: (err) => `خطأ في إصدار الوصفة: ${err}`,
      rxIssued: (shortId) => `تم إصدار وصفة إلكترونية QR موقّعة (${shortId}).`,
      qrRejected: (err) => `رمز غير صالح: ${err}`,
      rxSignatureVerified: (patient) => `تم التحقق من صحة وصفة ${patient}.`,
      doubleDispenseBlocked: "تم المنع: هذه الوصفة صُرفت مسبقاً ولا يمكن تكرارها.",
      dispenseFailed: (err) => `تعذر تأكيد الصرف: ${err}`,
      rxDispensed: "تم تأكيد صرف الوصفة الدوائية بنجاح.",
      labOrderError: (err) => `خطأ في طلب التحليل: ${err}`,
      labOrderQueued: (panel) => `تم إرسال طلب التحليل: ${panel}.`,
      selectPatientForUpload: "اختر المريض أولاً قبل رفع الملف الطبي.",
      binaryUploadFailed: (err) => `فشل رفع الملف: ${err}`,
      uploadedDiagnosticFile: (file) => `تم رفع ملف الفحص وتأكيده: ${file}.`,
      labUpdateFailed: (err) => `تعذر تحديث التحليل: ${err}`,
      labCompleted: (panel) => `تم إنهاء التحليل: ${panel}.`,
      loadedPatientIntoComposer: (patient) =>
        `تم فتح ملف ${patient} في خانة الاستشارة والوصفة الطبية.`,
    },
  },
};
