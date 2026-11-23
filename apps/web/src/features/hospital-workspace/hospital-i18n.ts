import type { AppointmentStatus, LocaleCode } from "@medisync/contracts";

export interface HospitalCopy {
  header: {
    liveStream: string;
    onDemandSync: string;
    guestLabel: string;
    syncBtn: string;
    guardTitle: string;
    guardRoles: string;
  };
  readiness: {
    title: string;
    subtitle: string;
    assignedLabel: string;
    licensePrefix: string;
    setStatusPrefix: string;
    continuous247: string;
    activeState: string;
    offState: string;
    erIntakeBay: string;
    acceptingState: string;
    pausedState: string;
    noFacilities: string;
    erActiveToast: string;
    routineOnlyToast: string;
  };
  queue: {
    title: (count: number) => string;
    subtitle: string;
    showSelectedOnly: string;
    includeNetwork: string;
    allVisitsFilter: string;
    emptyPrefix: string;
    emptyLink: string;
    checkInBtn: string;
    noShowBtn: string;
    cancelBtn: string;
    completeVisitBtn: string;
  };
  ems: {
    title: (count: number) => string;
    subtitle: string;
    hideMapBtn: string;
    openMapBtn: string;
    urgencyLabel: string;
    noteLabel: string;
    defaultTransferNote: string;
    requestBtn: string;
    noActiveTransfers: (countryName: string) => string;
    intakeBaySuffix: string;
    confirmArrivalBtn: string;
    completeIntakeBtn: string;
  };
  sidebar: {
    liveQueueTitle: string;
    confirmedWaiting: string;
    checkedIn: string;
    activeTransfers: string;
    countryFacilities: (countryName: string) => string;
    syncBtn: string;
    doctorCalendarLink: string;
    diagnosticLabLink: string;
    governanceLink: string;
  };
  enums: {
    appointmentStatus: Record<AppointmentStatus, string>;
    verificationStatus: Record<string, string>;
    urgencyOption: Record<string, string>;
  };
  messages: {
    facilityReadinessFailed: (err: string) => string;
    facilityUpdated: (name: string, openStatus: string, erStatus: string) => string;
    conflictApptRefreshed: string;
    receptionUpdateFailed: (err: string) => string;
    patientMarked: (name: string, status: string) => string;
    transferFailed: (err: string) => string;
    transferBroadcast: (countryName: string, facilityName: string) => string;
    conflictDispatchSync: string;
    transferUpdateFailed: (err: string) => string;
    transferUpdated: (statusLabel: string) => string;
  };
}

export const HOSPITAL_COPY: Record<LocaleCode, HospitalCopy> = {
  en: {
    header: {
      liveStream: "Live EMS Stream",
      onDemandSync: "On-Demand Sync",
      guestLabel: "Reception Gate",
      syncBtn: "Sync Reception Desk",
      guardTitle: "Hospital & Clinic Reception Command",
      guardRoles: "Verified Hospital Administrators and Clinic Reception Staff",
    },
    readiness: {
      title: "Facility Operational Readiness",
      subtitle: "Live availability syncs directly to the map & patient intake.",
      assignedLabel: "Assigned Hospital / Clinic",
      licensePrefix: "License",
      setStatusPrefix: "Set",
      continuous247: "24/7 Continuous Operations",
      activeState: "ACTIVE",
      offState: "OFF",
      erIntakeBay: "Emergency / ER Intake Bay",
      acceptingState: "ACCEPTING",
      pausedState: "PAUSED",
      noFacilities: "No verified facilities loaded in viewport yet.",
      erActiveToast: "ER Active",
      routineOnlyToast: "Routine Only",
    },
    queue: {
      title: (count) => `Reception Check-In & Client Queue (${count})`,
      subtitle:
        "Check in arriving patients, finalize visits, or mark no-shows with concurrency lock protection.",
      showSelectedOnly: "Show Selected Facility Only",
      includeNetwork: "Include Network Facilities",
      allVisitsFilter: "All Visits",
      emptyPrefix:
        "No appointments match the current filter. Verified doctors publish schedule windows from",
      emptyLink: "Clinical Calendar & Shifts",
      checkInBtn: "Check In",
      noShowBtn: "No Show",
      cancelBtn: "Cancel",
      completeVisitBtn: "Complete Visit",
    },
    ems: {
      title: (count) => `Incoming EMS & Transfer Queue (${count})`,
      subtitle:
        "Track approaching medical transport or request urgent ambulance dispatch.",
      hideMapBtn: "Hide Facility Map",
      openMapBtn: "Open Live Map",
      urgencyLabel: "Transfer Urgency",
      noteLabel: "Intake / Clinical Handoff Note",
      defaultTransferNote:
        "Ambulance transfer requested from hospital reception intake.",
      requestBtn: "Request EMS Transfer",
      noActiveTransfers: (countryName) =>
        `No active ambulance transfers queued for ${countryName} right now.`,
      intakeBaySuffix: "ER Intake Bay",
      confirmArrivalBtn: "Confirm Arrival",
      completeIntakeBtn: "Complete Intake",
    },
    sidebar: {
      liveQueueTitle: "Intake Desk Live Queue",
      confirmedWaiting: "Confirmed Waiting",
      checkedIn: "Checked In",
      activeTransfers: "Active Transfers",
      countryFacilities: (countryName) => `${countryName} Facilities`,
      syncBtn: "Sync Reception Desk",
      doctorCalendarLink: "Doctor Calendar & Shifts",
      diagnosticLabLink: "Diagnostic Lab Queue",
      governanceLink: "Governance & Verification Desk",
    },
    enums: {
      appointmentStatus: {
        CONFIRMED: "CONFIRMED",
        CHECKED_IN: "CHECKED_IN",
        COMPLETED: "COMPLETED",
        CANCELLED: "CANCELLED",
        NO_SHOW: "NO_SHOW",
      },
      verificationStatus: {
        PENDING: "PENDING",
        VERIFIED: "VERIFIED",
        REJECTED: "REJECTED",
      },
      urgencyOption: {
        EMERGENCY: "EMERGENCY",
        URGENT: "URGENT",
        ROUTINE: "ROUTINE",
      },
    },
    messages: {
      facilityReadinessFailed: (err) =>
        `Failed to update facility readiness: ${err}`,
      facilityUpdated: (name, openStatus, erStatus) =>
        `${name} updated: ${openStatus} · ${erStatus}.`,
      conflictApptRefreshed:
        "Appointment already transitioned on another station. Queue refreshed.",
      receptionUpdateFailed: (err) => `Reception update failed: ${err}`,
      patientMarked: (name, status) => `${name} marked ${status}.`,
      transferFailed: (err) => `Transfer request failed: ${err}`,
      transferBroadcast: (countryName, facilityName) =>
        `Emergency transport broadcast to verified ${countryName} drivers for ${facilityName}.`,
      conflictDispatchSync:
        "Transfer state changed concurrently on another console. Syncing latest...",
      transferUpdateFailed: (err) => `Transfer update failed: ${err}`,
      transferUpdated: (statusLabel) => `Transfer status updated to ${statusLabel}.`,
    },
  },
  fr: {
    header: {
      liveStream: "Flux SAMU en direct",
      onDemandSync: "Synchro à la demande",
      guestLabel: "Portail Accueil",
      syncBtn: "Synchroniser l'Accueil",
      guardTitle: "Accueil & Régulation Hôpital / Clinique",
      guardRoles: "Coordinateurs hospitaliers et personnel d'accueil vérifiés",
    },
    readiness: {
      title: "Disponibilité Opérationnelle du Site",
      subtitle:
        "L'état en direct est synchronisé sur la carte et les admissions.",
      assignedLabel: "Hôpital / Clinique assigné",
      licensePrefix: "Agrément",
      setStatusPrefix: "Passer à",
      continuous247: "Ouverture Continue 24h/24",
      activeState: "ACTIF",
      offState: "ARRÊT",
      erIntakeBay: "Accueil Urgences / SAUV",
      acceptingState: "OUVERT",
      pausedState: "SUSPENDU",
      noFacilities: "Aucun établissement vérifié chargé pour le moment.",
      erActiveToast: "Urgences actives",
      routineOnlyToast: "Soins programmés uniquement",
    },
    queue: {
      title: (count) => `File d'Accueil & Enregistrement (${count})`,
      subtitle:
        "Enregistrez les patients à l'arrivée, clôturez les visites ou signalez les absences.",
      showSelectedOnly: "Établissement sélectionné uniquement",
      includeNetwork: "Inclure tout le réseau",
      allVisitsFilter: "Toutes",
      emptyPrefix:
        "Aucun rendez-vous ne correspond au filtre. Les médecins publient leurs plages depuis",
      emptyLink: "Agenda & Plages Cliniques",
      checkInBtn: "Enregistrer Arrivée",
      noShowBtn: "Absent",
      cancelBtn: "Annuler",
      completeVisitBtn: "Terminer Visite",
    },
    ems: {
      title: (count) => `Transferts Ambulances & Urgences (${count})`,
      subtitle:
        "Suivez les ambulances en approche ou déclenchez un transfert médical urgent.",
      hideMapBtn: "Masquer la carte",
      openMapBtn: "Ouvrir la carte en direct",
      urgencyLabel: "Degré d'urgence",
      noteLabel: "Note de transmission / Accueil",
      defaultTransferNote:
        "Transfert ambulance demandé depuis le comptoir d'accueil.",
      requestBtn: "Demander une Ambulance",
      noActiveTransfers: (countryName) =>
        `Aucun transfert ambulance en cours pour ${countryName}.`,
      intakeBaySuffix: "Sas Accueil Urgences",
      confirmArrivalBtn: "Confirmer Arrivée",
      completeIntakeBtn: "Clôturer Admission",
    },
    sidebar: {
      liveQueueTitle: "File en Direct de l'Accueil",
      confirmedWaiting: "Confirmés en attente",
      checkedIn: "En salle / Arrivés",
      activeTransfers: "Transferts en cours",
      countryFacilities: (countryName) => `Centres (${countryName})`,
      syncBtn: "Synchroniser l'Accueil",
      doctorCalendarLink: "Agenda & Créneaux Médecins",
      diagnosticLabLink: "File Laboratoire d'Analyses",
      governanceLink: "Administration & Vérifications",
    },
    enums: {
      appointmentStatus: {
        CONFIRMED: "Confirmé",
        CHECKED_IN: "Arrivé",
        COMPLETED: "Terminé",
        CANCELLED: "Annulé",
        NO_SHOW: "Absent",
      },
      verificationStatus: {
        PENDING: "En attente",
        VERIFIED: "Vérifié",
        REJECTED: "Refusé",
      },
      urgencyOption: {
        EMERGENCY: "Urgence Immédiate",
        URGENT: "Urgent",
        ROUTINE: "Transfert Normal",
      },
    },
    messages: {
      facilityReadinessFailed: (err) =>
        `Échec mise à jour du statut d'ouverture : ${err}`,
      facilityUpdated: (name, openStatus, erStatus) =>
        `${name} mis à jour : ${openStatus} · ${erStatus}.`,
      conflictApptRefreshed:
        "Rendez-vous déjà mis à jour sur un autre poste. File actualisée.",
      receptionUpdateFailed: (err) => `Échec accueil : ${err}`,
      patientMarked: (name, status) => `${name} marqué : ${status}.`,
      transferFailed: (err) => `Échec demande de transfert : ${err}`,
      transferBroadcast: (countryName, facilityName) =>
        `Alerte transport envoyée aux ambulanciers (${countryName}) pour ${facilityName}.`,
      conflictDispatchSync:
        "Statut du transfert modifié ailleurs. Synchronisation...",
      transferUpdateFailed: (err) => `Échec mise à jour transfert : ${err}`,
      transferUpdated: (statusLabel) => `Transfert mis à jour : ${statusLabel}.`,
    },
  },
  ar: {
    header: {
      liveStream: "بث الإسعاف المباشر",
      onDemandSync: "مزامنة عند الطلب",
      guestLabel: "بوابة الاستقبال",
      syncBtn: "تحديث مكتب الاستقبال",
      guardTitle: "إدارة استقبال المستشفى والعيادة",
      guardRoles: "مدراء المستشفيات وطاقم الاستقبال الطبي المعتمدون",
    },
    readiness: {
      title: "جاهزية المؤسسة الصحية",
      subtitle: "تظهر حالة الفتح والطوارئ مباشرة على الخريطة عند المرضى.",
      assignedLabel: "المستشفى أو العيادة المختارة",
      licensePrefix: "الترخيص",
      setStatusPrefix: "تعيين الحالة:",
      continuous247: "العمل المتواصل 24/7",
      activeState: "مفعّل",
      offState: "متوقف",
      erIntakeBay: "استقبال الحالات المستعجلة والإنعاش",
      acceptingState: "يستقبل",
      pausedState: "موقوف مؤقتاً",
      noFacilities: "لا توجد مؤسسات معتمدة محمّلة في النطاق الحالي بعد.",
      erActiveToast: "الطوارئ مفعّلة",
      routineOnlyToast: "المواعيد العادية فقط",
    },
    queue: {
      title: (count) => `لائحة الاستقبال وتسجيل وصول المرضى (${count})`,
      subtitle:
        "سجّل وصول المرضى عند الباب، أنهِ الزيارات، أو وثّق الغياب بحماية كاملة.",
      showSelectedOnly: "عرض المؤسسة المختارة فقط",
      includeNetwork: "إظهار جميع مؤسسات الشبكة",
      allVisitsFilter: "جميع الزيارات",
      emptyPrefix:
        "لا توجد مواعيد مطابقة لهذا الفلتر. يقوم الأطباء بنشر أوقاتهم عبر",
      emptyLink: "جدول الطبيب وساعات العمل",
      checkInBtn: "تسجيل الحضور",
      noShowBtn: "لم يحضر",
      cancelBtn: "إلغاء",
      completeVisitBtn: "إنهاء الفحص",
    },
    ems: {
      title: (count) => `طلبات الإسعاف والنقل الطبي القادمة (${count})`,
      subtitle:
        "تتبع سيارات الإسعاف القادمة أو أرسل طلب نقل طبي مستعجل.",
      hideMapBtn: "إخفاء خريطة المؤسسة",
      openMapBtn: "فتح الخريطة المباشرة",
      urgencyLabel: "درجة الاستعجال",
      noteLabel: "ملاحظة التسليم السريري",
      defaultTransferNote: "طلب نقل إسعافي من مكتب استقبال المستشفى.",
      requestBtn: "طلب نقل إسعافي",
      noActiveTransfers: (countryName) =>
        `لا توجد عمليات نقل إسعافي نشطة في ${countryName} حالياً.`,
      intakeBaySuffix: "بوابة استقبال الطوارئ",
      confirmArrivalBtn: "تأكيد الوصول",
      completeIntakeBtn: "إتمام الاستقبال",
    },
    sidebar: {
      liveQueueTitle: "موجز مكتب الاستقبال المباشر",
      confirmedWaiting: "مؤكدة في الانتظار",
      checkedIn: "حاضر بالاستقبال",
      activeTransfers: "نقل طبي نشط",
      countryFacilities: (countryName) => `مؤسسات ${countryName}`,
      syncBtn: "تحديث مكتب الاستقبال",
      doctorCalendarLink: "جدول الطبيب وساعات العمل",
      diagnosticLabLink: "لائحة تحاليل المختبر",
      governanceLink: "الإدارة والمصادقة على الحسابات",
    },
    enums: {
      appointmentStatus: {
        CONFIRMED: "مؤكد",
        CHECKED_IN: "وصل للعيادة",
        COMPLETED: "مكتمل",
        CANCELLED: "ملغى",
        NO_SHOW: "تغيّب",
      },
      verificationStatus: {
        PENDING: "قيد المراجعة",
        VERIFIED: "معتمدة",
        REJECTED: "مرفوضة",
      },
      urgencyOption: {
        EMERGENCY: "طوارئ مستعجلة",
        URGENT: "حالة مستعجلة",
        ROUTINE: "نقل عادي",
      },
    },
    messages: {
      facilityReadinessFailed: (err) => `تعذر تحديث جاهزية المؤسسة: ${err}`,
      facilityUpdated: (name, openStatus, erStatus) =>
        `تم تحديث ${name}: ${openStatus} · ${erStatus}.`,
      conflictApptRefreshed: "تغيّرت حالة الموعد في شاشة أخرى. تم التحديث.",
      receptionUpdateFailed: (err) => `تعذر التحديث: ${err}`,
      patientMarked: (name, status) => `تم تحديث حالة ${name} إلى ${status}.`,
      transferFailed: (err) => `تعذر طلب الإسعاف: ${err}`,
      transferBroadcast: (countryName, facilityName) =>
        `تم إرسال طلب نقل إسعافي لسائقي ${countryName} المعتمدين نحو ${facilityName}.`,
      conflictDispatchSync: "تغيّرت حالة النقل في جهاز آخر. جاري المزامنة...",
      transferUpdateFailed: (err) => `تعذر تحديث حالة النقل: ${err}`,
      transferUpdated: (statusLabel) => `تم تحديث حالة النقل إلى ${statusLabel}.`,
    },
  },
};
