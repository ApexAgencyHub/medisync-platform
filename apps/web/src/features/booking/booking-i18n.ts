import type { AppointmentStatus, LocaleCode } from "@medisync/contracts";

export interface BookingUiCopy {
  guestLabel: string;
  refreshLabel: string;
  refreshAria: string;
  surfaceTitle: string;
  apiOfflineText: string;
  retryConnection: string;
  sessionExpiredToast: string;
  pendingApprovalError: string;
  roleRestrictionError: string;
  bookingOfflineError: string;
  conflictError: string;
  bookingExpiredError: string;
  bookingFailedPrefix: string;
  confirmedPrefix: string;
  confirmedWith: string;
  confirmedAt: string;
  statusUpdateFailedPrefix: string;
  statusUpdatedPrefix: string;
  availableHeading: string;
  filteredShowAll: string;
  providerSingular: string;
  providerPlural: string;
  noSlotsMatchedPrefix: string;
  noSlotsMatchedHint: string;
  clearFilters: string;
  searchAria: string;
  searchPlaceholder: string;
  clearSearchAria: string;
  optionsLabel: string;
  toggleOptionsAria: string;
  optionsDialogAria: string;
  optionsTitle: string;
  closeOptionsAria: string;
  careRegionLabel: string;
  filterRegionAria: string;
  insuranceLabel: string;
  filterInsuranceAria: string;
  allInsurancesOption: string;
  showTakenSlotsLabel: string;
  resetLabel: string;
  practitionerTypeAria: string;
  allPractitionersOption: string;
  doctorsSpecialistsOption: string;
  nursesOption: string;
  specialtyAria: string;
  allSpecialtiesOption: string;
  viewsAria: string;
  openSlotsTab: string;
  myVisitsTab: string;
  allVisitFormats: string;
  visitWorkplace: string;
  videoCall: string;
  homeNurse: string;
  preferredDateAria: string;
  cardNursePortrait: string;
  cardDoctorPortrait: string;
  cardCareHub: string;
  cardClinicInterior: string;
  cardSpecialtyLabel: string;
  cardFacilityLabel: string;
  cardAddressLabel: string;
  cardVisitFeeLabel: string;
  cardInspectPhotosAria: string;
  cardVerifiedAria: string;
  cardDispatchedFrom: string;
  cardCoverageLabel: string;
  cardLicenseLabel: string;
  cardOpenSlotSingular: string;
  cardOpenSlotPlural: string;
  cardNoOpenWindows: string;
  cardChooseTime: string;
  modalScheduleAriaPrefix: string;
  modalCloseAria: string;
  modalLicensePrefix: string;
  modalHowToSeeDoctor: string;
  modalVideoSub: string;
  modalSelectDatePrefix: string;
  modalChangeDateAria: string;
  modalAvailableWindows: string;
  modalOpenCountSuffix: string;
  modalNoHoursFor: string;
  modalOnWord: string;
  modalJumpNextDay: string;
  modalMorningHours: string;
  modalAfternoonHours: string;
  modalSelectedWindow: string;
  modalContactDetails: string;
  modalRequired: string;
  modalAlreadyRegistered: string;
  modalFullNameLabel: string;
  modalFullNamePlaceholder: string;
  modalPhoneLabel: string;
  modalConsentPrefix: string;
  modalCndpNotice: string;
  modalPrivacyNotice: string;
  modalConsentSuffix: string;
  modalErrShortName: string;
  modalErrInvalidPhone: string;
  modalErrConsentRequired: string;
  modalHomeInstructionsLabel: string;
  modalConsultationNoteLabel: string;
  modalOptional: string;
  modalLocating: string;
  modalAutoGpsPin: string;
  modalHomePlaceholder: string;
  modalClinicPlaceholder: string;
  modalBookingAsPrefix: string;
  modalNurseFooterHint: string;
  modalVideoFooterHint: string;
  modalClinicFooterHint: string;
  modalCancel: string;
  modalConfirming: string;
  modalConfirmVisit: string;
  appointmentsHeading: string;
  appointmentsSub: string;
  filterAll: string;
  filterUpcoming: string;
  filterCompleted: string;
  filterCancelled: string;
  portalSignInCta: string;
  noAppointmentsPrefix: string;
  noAppointmentsSuffix: string;
  browseOpenSlotsCta: string;
  openMyCareCta: string;
  noMatchingStatus: string;
  addToCalendar: string;
  viewMap: string;
  joinVideoCall: string;
  cancelVisit: string;
  checkIn: string;
  completeVisit: string;
  dismissPass: string;
  todayWord: string;
  tomorrowWord: string;
}

export const BOOKING_COPY: Record<LocaleCode, BookingUiCopy> = {
  en: {
    guestLabel: "Guest Instant Book",
    refreshLabel: "Refresh",
    refreshAria: "Refresh open slots",
    surfaceTitle: "Doctor Appointments & Clinic Hours",
    apiOfflineText:
      "Unable to reach the live clinic scheduling API. Check that the backend service is running, then retry.",
    retryConnection: "Retry connection",
    sessionExpiredToast:
      "Your sign-in session expired. Please sign in again via Portal.",
    pendingApprovalError:
      "Account verification pending approval. Your account cannot create clinical bookings until approved by Administration.",
    roleRestrictionError:
      "Only patients, caregivers, or verified clinic reception staff can reserve appointment slots. Sign in on the Patient track to book.",
    bookingOfflineError:
      "Unable to confirm booking because the backend scheduling API is offline. Please verify the API is running and retry.",
    conflictError:
      "That time window was just reserved by another patient. Please choose another slot.",
    bookingExpiredError:
      "Your previous booking session expired. Please submit again to refresh.",
    bookingFailedPrefix: "Booking failed:",
    confirmedPrefix: "Confirmed",
    confirmedWith: "booking with",
    confirmedAt: "at",
    statusUpdateFailedPrefix: "Status update failed:",
    statusUpdatedPrefix: "Appointment updated to",
    availableHeading: "Available Practitioners & Time Windows",
    filteredShowAll: "Filtered · Show All",
    providerSingular: "provider",
    providerPlural: "providers",
    noSlotsMatchedPrefix: "No open schedules matched your filters on",
    noSlotsMatchedHint:
      "Try another day in the weekday strip above or switch visit format.",
    clearFilters: "Clear Filters",
    searchAria: "Search practitioner, specialty, or clinic",
    searchPlaceholder: "Search doctor, nurse, specialty, or clinic...",
    clearSearchAria: "Clear booking search",
    optionsLabel: "Options",
    toggleOptionsAria: "Toggle booking filters",
    optionsDialogAria: "Booking Filters",
    optionsTitle: "Booking Options",
    closeOptionsAria: "Close booking filters",
    careRegionLabel: "Care Region",
    filterRegionAria: "Filter by region",
    insuranceLabel: "Health Insurance / Mutuelle",
    filterInsuranceAria: "Filter by health insurance",
    allInsurancesOption: "All Insurances Accepted",
    showTakenSlotsLabel: "Show taken time slots",
    resetLabel: "Reset",
    practitionerTypeAria: "Practitioner type",
    allPractitionersOption: "All Practitioners",
    doctorsSpecialistsOption: "Doctors & Specialists",
    nursesOption: "Nurses (Infirmiers)",
    specialtyAria: "Doctor specialty",
    allSpecialtiesOption: "All Specialties",
    viewsAria: "Booking Workspace Views",
    openSlotsTab: "Open Slots",
    myVisitsTab: "My Visits",
    allVisitFormats: "All Visit Formats",
    visitWorkplace: "Visit Workplace",
    videoCall: "Video Call",
    homeNurse: "Home Nurse",
    preferredDateAria: "Preferred appointment date",
    cardNursePortrait: "Infirmier Portrait",
    cardDoctorPortrait: "Doctor Portrait",
    cardCareHub: "Care Hub",
    cardClinicInterior: "Clinic Interior",
    cardSpecialtyLabel: "Specialty",
    cardFacilityLabel: "Facility",
    cardAddressLabel: "Address",
    cardVisitFeeLabel: "Visit Fee",
    cardInspectPhotosAria: "Inspect photos for",
    cardVerifiedAria: "Verified practitioner",
    cardDispatchedFrom: "Dispatched from",
    cardCoverageLabel: "Coverage:",
    cardLicenseLabel: "License",
    cardOpenSlotSingular: "open slot",
    cardOpenSlotPlural: "open slots",
    cardNoOpenWindows: "No open windows on",
    cardChooseTime: "Choose Time",
    modalScheduleAriaPrefix: "Schedule for",
    modalCloseAria: "Close schedule dialog",
    modalLicensePrefix: "Lic.",
    modalHowToSeeDoctor: "How would you like to see the doctor?",
    modalVideoSub: "Talk face-to-face online from home",
    modalSelectDatePrefix: "Select Date",
    modalChangeDateAria: "Change appointment date",
    modalAvailableWindows: "Available Time Windows",
    modalOpenCountSuffix: "open",
    modalNoHoursFor: "No clinic hours scheduled for",
    modalOnWord: "on",
    modalJumpNextDay: "Jump to Next Open Day",
    modalMorningHours: "Morning Hours",
    modalAfternoonHours: "Afternoon & Evening",
    modalSelectedWindow: "Selected Window:",
    modalContactDetails: "Patient Contact Details",
    modalRequired: "(Required)",
    modalAlreadyRegistered: "Already registered? Sign in",
    modalFullNameLabel: "Full Name *",
    modalFullNamePlaceholder: "e.g. Salma El Fassi",
    modalPhoneLabel: "Phone Number *",
    modalConsentPrefix: "I consent under personal data protection (",
    modalCndpNotice: "CNDP Law 09-08",
    modalPrivacyNotice: "medical privacy notice",
    modalConsentSuffix:
      ") to share my contact details solely with my practitioner to coordinate this visit.",
    modalErrShortName:
      "Please enter your full name (at least 2 characters) before confirming.",
    modalErrInvalidPhone:
      "Please enter a valid contact phone number (for example +212 612 345 678) so the practitioner can reach you.",
    modalErrConsentRequired:
      "Please confirm consent under personal data protection (CNDP Law 09-08) before reserving.",
    modalHomeInstructionsLabel: "Home Address & Nursing Instructions",
    modalConsultationNoteLabel: "Consultation Note",
    modalOptional: "(optional)",
    modalLocating: "Locating...",
    modalAutoGpsPin: "Auto GPS Pin",
    modalHomePlaceholder: "Street address, floor, or home care instructions",
    modalClinicPlaceholder: "Symptoms, vitals, or follow-up purpose",
    modalBookingAsPrefix: "Booking as",
    modalNurseFooterHint: "Nurse travels to your address · Free cancellation",
    modalVideoFooterHint: "Doctor video call from home · Free cancellation",
    modalClinicFooterHint: "Visit doctor at clinic workplace · Free cancellation",
    modalCancel: "Cancel",
    modalConfirming: "Confirming...",
    modalConfirmVisit: "Confirm Visit",
    appointmentsHeading: "Your Appointments",
    appointmentsSub:
      "Active reservations, calendar exports, and visit status in",
    filterAll: "All",
    filterUpcoming: "Upcoming",
    filterCompleted: "Completed",
    filterCancelled: "Cancelled",
    portalSignInCta: "Care Portal Sign-In",
    noAppointmentsPrefix: "No scheduled appointments yet in",
    noAppointmentsSuffix:
      "Pick an open practitioner time window to reserve a visit.",
    browseOpenSlotsCta: "Browse Open Slots",
    openMyCareCta: "Open My Care",
    noMatchingStatus: "No appointments match this status filter.",
    addToCalendar: "Add to Calendar",
    viewMap: "View Map",
    joinVideoCall: "Join Video Call",
    cancelVisit: "Cancel Visit",
    checkIn: "Check In",
    completeVisit: "Complete Visit",
    dismissPass: "Dismiss",
    todayWord: "Today",
    tomorrowWord: "Tomorrow",
  },
  fr: {
    guestLabel: "Réservation Express",
    refreshLabel: "Actualiser",
    refreshAria: "Actualiser les créneaux",
    surfaceTitle: "Rendez-vous Médicaux & Horaires",
    apiOfflineText:
      "Impossible de joindre le service de planification. Vérifiez que l'API est active puis réessayez.",
    retryConnection: "Réessayer",
    sessionExpiredToast:
      "Votre session a expiré. Veuillez vous reconnecter sur le Portail.",
    pendingApprovalError:
      "Compte en attente de validation. Les réservations cliniques sont bloquées jusqu'à l'accord de l'administration.",
    roleRestrictionError:
      "Seuls les patients, aidants ou secrétaires vérifiés peuvent réserver un créneau.",
    bookingOfflineError:
      "Impossible de confirmer car l'API de rendez-vous est hors ligne.",
    conflictError:
      "Ce créneau vient d'être réservé par un autre patient. Choisissez un autre horaire.",
    bookingExpiredError:
      "Votre session de réservation a expiré. Veuillez renvoyer pour actualiser.",
    bookingFailedPrefix: "Échec de réservation :",
    confirmedPrefix: "Confirmé :",
    confirmedWith: "avec",
    confirmedAt: "à",
    statusUpdateFailedPrefix: "Échec de mise à jour :",
    statusUpdatedPrefix: "Rendez-vous mis à jour :",
    availableHeading: "Praticiens Disponibles & Créneaux Horaires",
    filteredShowAll: "Filtré · Tout afficher",
    providerSingular: "praticien",
    providerPlural: "praticiens",
    noSlotsMatchedPrefix: "Aucun créneau ouvert ne correspond à vos filtres le",
    noSlotsMatchedHint:
      "Essayez un autre jour dans le ruban ci-dessus ou changez le format.",
    clearFilters: "Réinitialiser",
    searchAria: "Rechercher praticien, spécialité ou clinique",
    searchPlaceholder: "Médecin, infirmier, spécialité ou clinique...",
    clearSearchAria: "Effacer la recherche",
    optionsLabel: "Options",
    toggleOptionsAria: "Afficher les options de filtrage",
    optionsDialogAria: "Filtres de rendez-vous",
    optionsTitle: "Options de recherche",
    closeOptionsAria: "Fermer les options",
    careRegionLabel: "Région de soins",
    filterRegionAria: "Filtrer par pays",
    insuranceLabel: "Assurance / Mutuelle",
    filterInsuranceAria: "Filtrer par mutuelle",
    allInsurancesOption: "Toutes mutuelles acceptées",
    showTakenSlotsLabel: "Afficher créneaux déjà pris",
    resetLabel: "Réinitialiser",
    practitionerTypeAria: "Type de praticien",
    allPractitionersOption: "Tous les praticiens",
    doctorsSpecialistsOption: "Médecins & Spécialistes",
    nursesOption: "Infirmiers à domicile",
    specialtyAria: "Spécialité du médecin",
    allSpecialtiesOption: "Toutes spécialités",
    viewsAria: "Vues des rendez-vous",
    openSlotsTab: "Créneaux",
    myVisitsTab: "Mes Visites",
    allVisitFormats: "Tous formats",
    visitWorkplace: "Au Cabinet",
    videoCall: "Appel Vidéo",
    homeNurse: "Infirmier Maison",
    preferredDateAria: "Date souhaitée",
    cardNursePortrait: "Portrait Infirmier",
    cardDoctorPortrait: "Portrait Médecin",
    cardCareHub: "Centre de Soins",
    cardClinicInterior: "Intérieur Clinique",
    cardSpecialtyLabel: "Spécialité",
    cardFacilityLabel: "Établissement",
    cardAddressLabel: "Adresse",
    cardVisitFeeLabel: "Tarif",
    cardInspectPhotosAria: "Voir les photos de",
    cardVerifiedAria: "Praticien vérifié",
    cardDispatchedFrom: "Départ depuis",
    cardCoverageLabel: "Mutuelles :",
    cardLicenseLabel: "Licence",
    cardOpenSlotSingular: "créneau libre",
    cardOpenSlotPlural: "créneaux libres",
    cardNoOpenWindows: "Aucun créneau le",
    cardChooseTime: "Choisir l'heure",
    modalScheduleAriaPrefix: "Horaires de",
    modalCloseAria: "Fermer la fenêtre",
    modalLicensePrefix: "Lic.",
    modalHowToSeeDoctor: "Comment souhaitez-vous consulter le médecin ?",
    modalVideoSub: "Consultation vidéo en direct depuis chez vous",
    modalSelectDatePrefix: "Choisir la date",
    modalChangeDateAria: "Changer la date",
    modalAvailableWindows: "Horaires disponibles",
    modalOpenCountSuffix: "libres",
    modalNoHoursFor: "Aucun horaire prévu pour",
    modalOnWord: "le",
    modalJumpNextDay: "Aller au prochain jour ouvert",
    modalMorningHours: "Matin",
    modalAfternoonHours: "Après-midi & Soir",
    modalSelectedWindow: "Créneau choisi :",
    modalContactDetails: "Coordonnées du patient",
    modalRequired: "(Obligatoire)",
    modalAlreadyRegistered: "Déjà inscrit ? Se connecter",
    modalFullNameLabel: "Nom complet *",
    modalFullNamePlaceholder: "ex : Salma El Fassi",
    modalPhoneLabel: "Téléphone *",
    modalConsentPrefix:
      "J'accepte conformément à la protection des données (",
    modalCndpNotice: "Loi CNDP 09-08",
    modalPrivacyNotice: "confidentialité médicale",
    modalConsentSuffix:
      ") de partager mes coordonnées uniquement avec le praticien pour organiser ce rendez-vous.",
    modalErrShortName:
      "Veuillez saisir votre nom complet (au moins 2 caractères).",
    modalErrInvalidPhone:
      "Veuillez saisir un numéro valide (ex : +212 612 345 678).",
    modalErrConsentRequired:
      "Veuillez confirmer le consentement CNDP Loi 09-08 avant de réserver.",
    modalHomeInstructionsLabel: "Adresse à domicile & consignes",
    modalConsultationNoteLabel: "Motif de consultation",
    modalOptional: "(facultatif)",
    modalLocating: "Localisation...",
    modalAutoGpsPin: "Position GPS",
    modalHomePlaceholder: "Adresse complète, étage ou instructions d'accès",
    modalClinicPlaceholder: "Symptômes, suivi ou précisions utiles",
    modalBookingAsPrefix: "Réservation au nom de",
    modalNurseFooterHint: "Infirmier se déplace chez vous · Annulation gratuite",
    modalVideoFooterHint: "Appel vidéo depuis chez vous · Annulation gratuite",
    modalClinicFooterHint: "Au cabinet du médecin · Annulation gratuite",
    modalCancel: "Annuler",
    modalConfirming: "Confirmation...",
    modalConfirmVisit: "Confirmer le RDV",
    appointmentsHeading: "Vos Rendez-vous",
    appointmentsSub:
      "Réservations actives, exports calendrier et suivi des visites en",
    filterAll: "Tous",
    filterUpcoming: "À venir",
    filterCompleted: "Terminés",
    filterCancelled: "Annulés",
    portalSignInCta: "Connexion Portail",
    noAppointmentsPrefix: "Aucun rendez-vous programmé pour le moment en",
    noAppointmentsSuffix:
      "Choisissez un créneau ouvert ci-contre pour réserver votre visite.",
    browseOpenSlotsCta: "Voir les créneaux",
    openMyCareCta: "Ouvrir Mon Espace",
    noMatchingStatus: "Aucun rendez-vous ne correspond à ce filtre.",
    addToCalendar: "Ajouter au calendrier",
    viewMap: "Voir sur la carte",
    joinVideoCall: "Rejoindre l'appel vidéo",
    cancelVisit: "Annuler la visite",
    checkIn: "Enregistrer l'arrivée",
    completeVisit: "Terminer la visite",
    dismissPass: "Masquer",
    todayWord: "Aujourd'hui",
    tomorrowWord: "Demain",
  },
  ar: {
    guestLabel: "حجز فوري للزوار",
    refreshLabel: "تحديث",
    refreshAria: "تحديث المواعيد المفتوحة",
    surfaceTitle: "حجز مواعيد الأطباء وأوقات العيادات",
    apiOfflineText:
      "تعذر الاتصال بخادم المواعيد الآن. تأكد من تشغيل الخدمة ثم أعد المحاولة.",
    retryConnection: "إعادة المحاولة",
    sessionExpiredToast:
      "انتهت صلاحية الجلسة. يرجى تسجيل الدخول مجدداً عبر البوابة.",
    pendingApprovalError:
      "حسابك في انتظار موافقة الإدارة ولا يمكنه إنشاء حجوزات قبل التفعيل.",
    roleRestrictionError:
      "فقط المرضى ومرافقو العائلة أو موظفو الاستقبال المعتمدون يمكنهم حجز المواعيد.",
    bookingOfflineError:
      "تعذر تأكيد الحجز لأن خدمة المواعيد غير متصلة حالياً.",
    conflictError:
      "تم حجز هذا التوقيت للتو من طرف مريض آخر. اختر توقيتاً آخر.",
    bookingExpiredError:
      "انتهت جلسة الحجز السابقة. أعد الإرسال للتأكيد.",
    bookingFailedPrefix: "فشل الحجز:",
    confirmedPrefix: "تم تأكيد",
    confirmedWith: "مع",
    confirmedAt: "في",
    statusUpdateFailedPrefix: "تعذر تحديث الحالة:",
    statusUpdatedPrefix: "تم تحديث حالة الموعد إلى",
    availableHeading: "الأطباء والمواعيد المتاحة الآن",
    filteredShowAll: "مفلتر · إظهار الكل",
    providerSingular: "ممارس",
    providerPlural: "ممارسين",
    noSlotsMatchedPrefix: "لا توجد أوقات مفتوحة مطابقة لاختيارك يوم",
    noSlotsMatchedHint:
      "جرّب يوماً آخر من الشريط أعلاه أو بدّل طريقة الاستشارة.",
    clearFilters: "مسح الفلاتر",
    searchAria: "ابحث عن طبيب أو تخصص أو عيادة",
    searchPlaceholder: "اكتب اسم الطبيب، التخصص (قلب، أطفال...) أو العيادة...",
    clearSearchAria: "مسح البحث",
    optionsLabel: "خيارات",
    toggleOptionsAria: "إظهار خيارات البحث",
    optionsDialogAria: "خيارات البحث عن المواعيد",
    optionsTitle: "خيارات إضافية",
    closeOptionsAria: "إغلاق الخيارات",
    careRegionLabel: "البلد والمنطقة",
    filterRegionAria: "تصفية حسب البلد",
    insuranceLabel: "التأمين الصحي / التعاضدية",
    filterInsuranceAria: "تصفية حسب التأمين",
    allInsurancesOption: "جميع أنواع التأمين المقبولة",
    showTakenSlotsLabel: "إظهار المواعيد المحجوزة",
    resetLabel: "إعادة ضبط",
    practitionerTypeAria: "فئة الإطار الطبي",
    allPractitionersOption: "كل الأطر الطبية",
    doctorsSpecialistsOption: "الأطباء والأخصائيون",
    nursesOption: "الممرضون (رعاية منزلية)",
    specialtyAria: "تخصص الطبيب",
    allSpecialtiesOption: "كل التخصصات",
    viewsAria: "عرض المواعيد",
    openSlotsTab: "الأوقات المتاحة",
    myVisitsTab: "مواعيدي",
    allVisitFormats: "كل الطرق",
    visitWorkplace: "زيارة فالعيادة",
    videoCall: "مكالمة فيديو",
    homeNurse: "ممرض للدار",
    preferredDateAria: "تاريخ الموعد المفضل",
    cardNursePortrait: "صورة الممرض",
    cardDoctorPortrait: "صورة الطبيب",
    cardCareHub: "مركز الرعاية",
    cardClinicInterior: "داخل العيادة",
    cardSpecialtyLabel: "التخصص",
    cardFacilityLabel: "مكان العمل",
    cardAddressLabel: "العنوان",
    cardVisitFeeLabel: "ثمن الاستشارة",
    cardInspectPhotosAria: "تكبير صور",
    cardVerifiedAria: "طبيب معتمد",
    cardDispatchedFrom: "ينطلق من",
    cardCoverageLabel: "التغطية:",
    cardLicenseLabel: "الترخيص",
    cardOpenSlotSingular: "وقت متاح",
    cardOpenSlotPlural: "أوقات متاحة",
    cardNoOpenWindows: "لا توجد أوقات مفتوحة يوم",
    cardChooseTime: "اختر التوقيت",
    modalScheduleAriaPrefix: "مواعيد",
    modalCloseAria: "إغلاق نافذة الحجز",
    modalLicensePrefix: "رخصة",
    modalHowToSeeDoctor: "كيف بغيتي تدوز عند الطبيب؟",
    modalVideoSub: "مكالمة فيديو مباشرة وأنت فالدار",
    modalSelectDatePrefix: "اختار اليوم",
    modalChangeDateAria: "تغيير تاريخ الموعد",
    modalAvailableWindows: "الأوقات المفتوحة",
    modalOpenCountSuffix: "متاح",
    modalNoHoursFor: "ما كايناش ساعات عمل مبرمجة عند",
    modalOnWord: "يوم",
    modalJumpNextDay: "انتقل لأقرب يوم مفتوح",
    modalMorningHours: "الفترة الصباحية",
    modalAfternoonHours: "المساء وبعد الظهر",
    modalSelectedWindow: "الوقت المختار:",
    modalContactDetails: "معلومات التواصل للمريض",
    modalRequired: "(إجباري)",
    modalAlreadyRegistered: "عندك حساب؟ سجل الدخول",
    modalFullNameLabel: "الاسم الكامل *",
    modalFullNamePlaceholder: "مثال: سلمى الفاسي",
    modalPhoneLabel: "رقم الهاتف *",
    modalConsentPrefix: "أوافق طبقاً لقانون حماية المعطيات الشخصية (",
    modalCndpNotice: "قانون CNDP 09-08",
    modalPrivacyNotice: "ميثاق الخصوصية الطبية",
    modalConsentSuffix:
      ") على مشاركة معلومات التواصل ديالي مع الطبيب فقط لتأكيد الموعد.",
    modalErrShortName:
      "يرجى إدخال الاسم الكامل (حرفان على الأقل) قبل التأكيد.",
    modalErrInvalidPhone:
      "يرجى إدخال رقم هاتف صحيح (مثال: +212 612 345 678) ليتواصل معك الطبيب.",
    modalErrConsentRequired:
      "يرجى تأكيد الموافقة على حماية المعطيات (CNDP 09-08) قبل الحجز.",
    modalHomeInstructionsLabel: "عنوان البيت وتعليمات الممرض",
    modalConsultationNoteLabel: "سبب الاستشارة أو الأعراض",
    modalOptional: "(اختياري)",
    modalLocating: "جاري تحديد الموقع...",
    modalAutoGpsPin: "تحديد موقعي GPS",
    modalHomePlaceholder: "الحي، رقم الشقة، أو تعليمات الوصول للبيت",
    modalClinicPlaceholder: "الأعراض الحالية أو سبب المتابعة",
    modalBookingAsPrefix: "الحجز باسم",
    modalNurseFooterHint: "الممرض كيجي لعنوان بيتك · إلغاء مجاني",
    modalVideoFooterHint: "مكالمة فيديو مع الطبيب من البيت · إلغاء مجاني",
    modalClinicFooterHint: "زيارة الطبيب في مكان عمله · إلغاء مجاني",
    modalCancel: "إلغاء",
    modalConfirming: "جاري التأكيد...",
    modalConfirmVisit: "تأكيد الموعد",
    appointmentsHeading: "مواعيدك المحجوزة",
    appointmentsSub: "الحجوزات الحالية، إضافة للتقويم وحالة الزيارة في",
    filterAll: "الكل",
    filterUpcoming: "القادمة",
    filterCompleted: "المكتملة",
    filterCancelled: "الملغاة",
    portalSignInCta: "تسجيل الدخول",
    noAppointmentsPrefix: "مازال ما عندك حتى موعد محجوز في",
    noAppointmentsSuffix:
      "اختار وقت مفتوح عند أي طبيب باش تحجز الموعد ديالك بسهولة.",
    browseOpenSlotsCta: "عرض المواعيد المتاحة",
    openMyCareCta: "افتح فضاء صحتي",
    noMatchingStatus: "لا توجد مواعيد مطابقة لهذا الفلتر.",
    addToCalendar: "أضف للتقويم",
    viewMap: "عرض على الخريطة",
    joinVideoCall: "دخول لمكالمة الفيديو",
    cancelVisit: "إلغاء الموعد",
    checkIn: "تسجيل الحضور",
    completeVisit: "إتمام الاستشارة",
    dismissPass: "إخفاء",
    todayWord: "اليوم",
    tomorrowWord: "غداً",
  },
};

export const WEEKDAY_NAMES_BY_LOCALE: Record<LocaleCode, readonly string[]> = {
  en: [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ],
  fr: ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"],
  ar: ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"],
};

export const SHORT_WEEKDAY_BY_LOCALE: Record<LocaleCode, readonly string[]> = {
  en: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
  fr: ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"],
  ar: ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"],
};

export const SHORT_MONTH_BY_LOCALE: Record<LocaleCode, readonly string[]> = {
  en: [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ],
  fr: [
    "Jan",
    "Fév",
    "Mar",
    "Avr",
    "Mai",
    "Juin",
    "Juil",
    "Aoû",
    "Sep",
    "Oct",
    "Nov",
    "Déc",
  ],
  ar: [
    "يناير",
    "فبراير",
    "مارس",
    "أبريل",
    "ماي",
    "يونيو",
    "يوليوز",
    "غشت",
    "شتنبر",
    "أكتوبر",
    "نونبر",
    "دجنبر",
  ],
};

export function getLocalizedAppointmentStatusLabel(
  status: AppointmentStatus,
  locale: LocaleCode = "en",
): string {
  if (locale === "ar") {
    const arMap: Record<AppointmentStatus, string> = {
      CONFIRMED: "مؤكد",
      CHECKED_IN: "حاضر فالعيادة",
      COMPLETED: "مكتمل",
      CANCELLED: "ملغى",
      NO_SHOW: "لم يحضر",
    };
    return arMap[status];
  }
  if (locale === "fr") {
    const frMap: Record<AppointmentStatus, string> = {
      CONFIRMED: "Confirmé",
      CHECKED_IN: "Enregistré",
      COMPLETED: "Terminé",
      CANCELLED: "Annulé",
      NO_SHOW: "Absent",
    };
    return frMap[status];
  }
  const enMap: Record<AppointmentStatus, string> = {
    CONFIRMED: "Confirmed",
    CHECKED_IN: "Checked In",
    COMPLETED: "Completed",
    CANCELLED: "Cancelled",
    NO_SHOW: "Missed Visit",
  };
  return enMap[status];
}
