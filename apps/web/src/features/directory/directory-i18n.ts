import type { LocaleCode } from "@medisync/contracts";

export interface DirectoryUiCopy {
  guestLabel: string;
  surfaceTitle: string;
  syncErrorToast: string;
  searchPlaceholder: string;
  searchAria: string;
  clearSearchAria: string;
  toggleFiltersAria: string;
  filtersLabel: string;
  filtersDialogAria: string;
  filtersTitle: string;
  closeFiltersAria: string;
  careRegionLabel: string;
  cityLabel: string;
  allCitiesOption: string;
  openNowOnlyLabel: string;
  resetFilters: string;
  specialtyAria: string;
  allSpecialtiesOption: string;
  tabsAria: string;
  tabAll: string;
  tabDoctors: string;
  tabNurses: string;
  tabDrivers: string;
  tabFacilities: string;
  doctorsHeading: string;
  doctorsSubtitle: string;
  inspectPrefix: string;
  inspectPhotoSuffix: string;
  specialtyLabel: string;
  practicingCenterLabel: string;
  regionalPractice: string;
  careModesLabel: string;
  careModesClinicVideo: string;
  careModesShort: string;
  consultationFeeLabel: string;
  bookDoctorAction: string;
  medicalClinicSuffix: string;
  profileBtn: string;
  bookVisitBtn: string;
  nursesHeading: string;
  nursesSubtitle: string;
  homeVisitDispatch: string;
  homeVisitInfirmierBadge: string;
  careTrackLabel: string;
  visitModeLabel: string;
  homeVisitDomicile: string;
  dispatchBaseLabel: string;
  hospitalNetwork: string;
  homeVisitFeeLabel: string;
  requestNurseAction: string;
  homeVisitBadge: string;
  dispatchFromPrefix: string;
  perHomeVisit: string;
  requestHomeVisitBtn: string;
  driversHeading: string;
  driversSubtitle: string;
  standbyStatus: string;
  unitTypeLabel: string;
  vehicleLabel: string;
  zoneLabel: string;
  homeBaseLabel: string;
  regionalDispatch: string;
  trackOnLiveMapAction: string;
  emsAmbulance: string;
  medicalShuttle: string;
  unitInfoBtn: string;
  trackOnMapBtn: string;
  facilitiesHeading: string;
  facilitiesSubtitle: string;
  browsePharmacyCta: string;
  labQueueCta: string;
  viewOnMapCta: string;
  facilityTypeLabel: string;
  licenseLabel: string;
  addressLabel: string;
  statusLabel: string;
  teamAndInfoBtn: string;
  emptyTitlePrefix: string;
  emptyHint: string;
  modalDialogAria: string;
  copiedToast: string;
  copyUnavailableToast: string;
  portraitSuffix: string;
  closeModalAria: string;
  copyLinkAria: string;
  ministryVerified: string;
  practicingLocation: string;
  todayOpenWindows: string;
  loadingSlots: string;
  noSlotsRemainingToday: string;
  moreLabel: string;
  inPersonOrTelehealth: string;
  visitWorkplaceBtn: string;
  videoCallBtn: string;
  coverageZoneLabel: string;
  dispatchBaseFacilityLabel: string;
  fastBookUnitBtn: string;
  openPharmacyCatalogBtn: string;
  viewLabServicesBtn: string;
  locateOnMapBtn: string;
  staffUnitsHeading: string;
  nurseHomeVisitTag: string;
  verifiedPractitionerBadge: string;
  homeNursingBadge: string;
  clinicalNetworkSuffix: string;
  careDeliveryModesHeading: string;
  clinicVisitWord: string;
  videoWord: string;
  verifiedWorkplaceHeading: string;
  regionalClinicFallback: string;
  openOnMapCta: string;
  liveScheduleSync: string;
  emptySlotsCalendarHint: string;
  zoomPortraitAria: string;
}

export const DIRECTORY_COPY: Record<LocaleCode, DirectoryUiCopy> = {
  en: {
    guestLabel: "Public Directory",
    surfaceTitle: "Medical Care Directory",
    syncErrorToast:
      "Unable to refresh live directory records right now. Showing last synced profiles.",
    searchPlaceholder: "Search doctors, nurses, drivers, clinics...",
    searchAria: "Search profiles directory",
    clearSearchAria: "Clear search",
    toggleFiltersAria: "Toggle directory filters",
    filtersLabel: "Filters",
    filtersDialogAria: "Directory Filters",
    filtersTitle: "Directory Filters",
    closeFiltersAria: "Close filters",
    careRegionLabel: "Care Region",
    cityLabel: "City / Metro",
    allCitiesOption: "All Cities",
    openNowOnlyLabel: "Available / Open Now Only",
    resetFilters: "Reset Filters",
    specialtyAria: "Doctor specialty",
    allSpecialtiesOption: "All Specialties",
    tabsAria: "Profile directory categories",
    tabAll: "All",
    tabDoctors: "Doctors",
    tabNurses: "Home Nurses",
    tabDrivers: "Drivers & Fleet",
    tabFacilities: "Facilities",
    doctorsHeading: "Doctors & Specialists",
    doctorsSubtitle: "Clinic & Video Consultations",
    inspectPrefix: "Inspect",
    inspectPhotoSuffix: "photo",
    specialtyLabel: "Specialty",
    practicingCenterLabel: "Practicing Center",
    regionalPractice: "Regional Practice",
    careModesLabel: "Care Modes",
    careModesClinicVideo: "Clinic Visit · Video",
    careModesShort: "Clinic · Video",
    consultationFeeLabel: "Consultation Fee",
    bookDoctorAction: "Book Doctor Appointment",
    medicalClinicSuffix: "Medical Clinic",
    profileBtn: "Profile",
    bookVisitBtn: "Book Visit",
    nursesHeading: "Nurses & Infirmiers",
    nursesSubtitle: "Mobile Home Visits & Post-Op Care",
    homeVisitDispatch: "Home Visit Dispatch",
    homeVisitInfirmierBadge: "Home Visit Infirmier",
    careTrackLabel: "Care Track",
    visitModeLabel: "Visit Mode",
    homeVisitDomicile: "Home Visit (Domicile)",
    dispatchBaseLabel: "Dispatch Base",
    hospitalNetwork: "Hospital Network",
    homeVisitFeeLabel: "Home Visit Fee",
    requestNurseAction: "Request Home Nurse Visit",
    homeVisitBadge: "Home Visit",
    dispatchFromPrefix: "Dispatch from",
    perHomeVisit: "/ home visit",
    requestHomeVisitBtn: "Request Home Visit",
    driversHeading: "Medical Transport & Drivers",
    driversSubtitle: "Live GPS Dispatch Fleet",
    standbyStatus: "Standby",
    unitTypeLabel: "Unit Type",
    vehicleLabel: "Vehicle",
    zoneLabel: "Zone",
    homeBaseLabel: "Home Base",
    regionalDispatch: "Regional Dispatch",
    trackOnLiveMapAction: "Track Unit on Live Map",
    emsAmbulance: "EMS Ambulance",
    medicalShuttle: "Medical Shuttle",
    unitInfoBtn: "Unit Info",
    trackOnMapBtn: "Track on Map",
    facilitiesHeading: "Hospitals, Clinics, Pharmacies & Labs",
    facilitiesSubtitle: "Ministry Verified Network",
    browsePharmacyCta: "Browse Pharmacy",
    labQueueCta: "Lab Queue",
    viewOnMapCta: "View on Map",
    facilityTypeLabel: "Facility Type",
    licenseLabel: "License",
    addressLabel: "Address",
    statusLabel: "Status",
    teamAndInfoBtn: "Team & Info",
    emptyTitlePrefix: "No matching profiles found in",
    emptyHint: "Try clearing the search query or adjusting filters above.",
    modalDialogAria: "Healthcare Profile Details",
    copiedToast: "Profile permalink copied to clipboard.",
    copyUnavailableToast: "Copy unavailable in this browser context.",
    portraitSuffix: "Portrait",
    closeModalAria: "Close dossier",
    copyLinkAria: "Copy link",
    ministryVerified: "Ministry Verified",
    practicingLocation: "Practicing Location",
    todayOpenWindows: "Today's Open Windows",
    loadingSlots: "Checking open slots...",
    noSlotsRemainingToday:
      "No remaining slots today — check tomorrow in Scheduler.",
    moreLabel: "more",
    inPersonOrTelehealth: "In-person workplace or live video telehealth",
    visitWorkplaceBtn: "Visit Workplace →",
    videoCallBtn: "Video Call →",
    coverageZoneLabel: "Coverage Zone",
    dispatchBaseFacilityLabel: "Dispatch Base Facility",
    fastBookUnitBtn: "1-Tap Fast Book Unit →",
    openPharmacyCatalogBtn: "Open Pharmacy Catalog →",
    viewLabServicesBtn: "View Lab Services →",
    locateOnMapBtn: "Locate & Book on Map →",
    staffUnitsHeading: "Medical Staff & Units at This Location",
    nurseHomeVisitTag: "Home Visit",
    verifiedPractitionerBadge: "Verified Practitioner",
    homeNursingBadge: "Home Nursing",
    clinicalNetworkSuffix: "Clinical Network",
    careDeliveryModesHeading: "Care Delivery Modes",
    clinicVisitWord: "Clinic Visit",
    videoWord: "Video",
    verifiedWorkplaceHeading: "Verified Workplace",
    regionalClinicFallback: "Regional Clinic",
    openOnMapCta: "Open on Map",
    liveScheduleSync: "Live Schedule Sync",
    emptySlotsCalendarHint:
      "View the interactive calendar on Booking to pick upcoming available hours.",
    zoomPortraitAria: "Zoom portrait of",
  },
  fr: {
    guestLabel: "Annuaire Public",
    surfaceTitle: "Annuaire des Soins Médicaux",
    syncErrorToast:
      "Impossible d'actualiser l'annuaire pour l'instant. Affichage des profils en cache.",
    searchPlaceholder: "Médecins, infirmiers, ambulanciers, cliniques...",
    searchAria: "Rechercher dans l'annuaire médical",
    clearSearchAria: "Effacer la recherche",
    toggleFiltersAria: "Afficher les filtres",
    filtersLabel: "Filtres",
    filtersDialogAria: "Filtres de l'annuaire",
    filtersTitle: "Filtres de recherche",
    closeFiltersAria: "Fermer les filtres",
    careRegionLabel: "Région de soins",
    cityLabel: "Ville",
    allCitiesOption: "Toutes les villes",
    openNowOnlyLabel: "Disponibles / Ouverts uniquement",
    resetFilters: "Réinitialiser les filtres",
    specialtyAria: "Spécialité du médecin",
    allSpecialtiesOption: "Toutes spécialités",
    tabsAria: "Catégories de l'annuaire",
    tabAll: "Tout",
    tabDoctors: "Médecins",
    tabNurses: "Infirmiers",
    tabDrivers: "Ambulanciers",
    tabFacilities: "Établissements",
    doctorsHeading: "Médecins & Spécialistes",
    doctorsSubtitle: "Consultations au cabinet et vidéo",
    inspectPrefix: "Agrandir",
    inspectPhotoSuffix: "photo",
    specialtyLabel: "Spécialité",
    practicingCenterLabel: "Lieu d'exercice",
    regionalPractice: "Cabinet régional",
    careModesLabel: "Formats",
    careModesClinicVideo: "Cabinet · Vidéo",
    careModesShort: "Cabinet · Vidéo",
    consultationFeeLabel: "Tarif",
    bookDoctorAction: "Prendre rendez-vous",
    medicalClinicSuffix: "Clinique Médicale",
    profileBtn: "Profil",
    bookVisitBtn: "Réserver",
    nursesHeading: "Infirmiers à Domicile",
    nursesSubtitle: "Soins mobiles et suivi post-opératoire",
    homeVisitDispatch: "Visite à Domicile",
    homeVisitInfirmierBadge: "Infirmier à Domicile",
    careTrackLabel: "Filière",
    visitModeLabel: "Mode",
    homeVisitDomicile: "Visite à domicile",
    dispatchBaseLabel: "Centre d'attache",
    hospitalNetwork: "Réseau hospitalier",
    homeVisitFeeLabel: "Tarif visite",
    requestNurseAction: "Demander un infirmier",
    homeVisitBadge: "À domicile",
    dispatchFromPrefix: "Départ de",
    perHomeVisit: "/ visite à domicile",
    requestHomeVisitBtn: "Demander à domicile",
    driversHeading: "Transport Médical & Ambulances",
    driversSubtitle: "Flotte suivie par GPS",
    standbyStatus: "En veille",
    unitTypeLabel: "Catégorie",
    vehicleLabel: "Véhicule",
    zoneLabel: "Zone",
    homeBaseLabel: "Base d'attache",
    regionalDispatch: "Régulation régionale",
    trackOnLiveMapAction: "Suivre sur la carte",
    emsAmbulance: "Ambulance SMUR",
    medicalShuttle: "Navette Médicale",
    unitInfoBtn: "Infos Unité",
    trackOnMapBtn: "Sur la carte",
    facilitiesHeading: "Hôpitaux, Cliniques, Pharmacies & Labos",
    facilitiesSubtitle: "Réseau agréé",
    browsePharmacyCta: "Voir pharmacie",
    labQueueCta: "File labo",
    viewOnMapCta: "Voir carte",
    facilityTypeLabel: "Type",
    licenseLabel: "Agrément",
    addressLabel: "Adresse",
    statusLabel: "Statut",
    teamAndInfoBtn: "Équipe & Infos",
    emptyTitlePrefix: "Aucun profil trouvé en",
    emptyHint: "Essayez d'effacer la recherche ou d'ajuster les filtres.",
    modalDialogAria: "Détails du Profil Médical",
    copiedToast: "Lien du profil copié.",
    copyUnavailableToast: "Copie indisponible dans ce navigateur.",
    portraitSuffix: "Portrait",
    closeModalAria: "Fermer la fiche",
    copyLinkAria: "Copier le lien",
    ministryVerified: "Vérifié par le Ministère",
    practicingLocation: "Lieu d'exercice",
    todayOpenWindows: "Créneaux ouverts aujourd'hui",
    loadingSlots: "Chargement des créneaux...",
    noSlotsRemainingToday:
      "Plus de créneau aujourd'hui — consultez demain dans le calendrier.",
    moreLabel: "autres",
    inPersonOrTelehealth: "Au cabinet du médecin ou en téléconsultation vidéo",
    visitWorkplaceBtn: "Au Cabinet →",
    videoCallBtn: "Appel Vidéo →",
    coverageZoneLabel: "Zone de couverture",
    dispatchBaseFacilityLabel: "Base d'attache",
    fastBookUnitBtn: "Appel Rapide Unité →",
    openPharmacyCatalogBtn: "Ouvrir la pharmacie →",
    viewLabServicesBtn: "Voir les analyses →",
    locateOnMapBtn: "Localiser sur la carte →",
    staffUnitsHeading: "Personnel médical & unités sur place",
    nurseHomeVisitTag: "À domicile",
    verifiedPractitionerBadge: "Praticien Vérifié",
    homeNursingBadge: "Soins à Domicile",
    clinicalNetworkSuffix: "Réseau Clinique",
    careDeliveryModesHeading: "Modes de Consultation",
    clinicVisitWord: "Cabinet",
    videoWord: "Vidéo",
    verifiedWorkplaceHeading: "Lieu d'Exercice Vérifié",
    regionalClinicFallback: "Clinique Régionale",
    openOnMapCta: "Ouvrir sur la carte",
    liveScheduleSync: "Horaires en direct",
    emptySlotsCalendarHint:
      "Consultez le calendrier interactif sur Rendez-vous pour choisir les prochains créneaux.",
    zoomPortraitAria: "Agrandir le portrait de",
  },
  ar: {
    guestLabel: "الدليل الطبي العام",
    surfaceTitle: "دليل الأطباء والمؤسسات الصحية",
    syncErrorToast:
      "تعذر تحديث بيانات الدليل الآن. يتم عرض آخر الملفات المحفوظة.",
    searchPlaceholder: "ابحث عن طبيب، تخصص (قلب، أطفال...)، ممرض، عيادة...",
    searchAria: "البحث في الدليل الطبي",
    clearSearchAria: "مسح البحث",
    toggleFiltersAria: "إظهار فلاتر الدليل",
    filtersLabel: "تصفية",
    filtersDialogAria: "فلاتر الدليل",
    filtersTitle: "خيارات التصفية",
    closeFiltersAria: "إغلاق الفلاتر",
    careRegionLabel: "البلد / الجهة",
    cityLabel: "المدينة",
    allCitiesOption: "كل المدن",
    openNowOnlyLabel: "المتاحون والمفتوحون الآن فقط",
    resetFilters: "إعادة ضبط الفلاتر",
    specialtyAria: "تخصص الطبيب",
    allSpecialtiesOption: "كل التخصصات",
    tabsAria: "أقسام الدليل الطبي",
    tabAll: "الكل",
    tabDoctors: "الأطباء",
    tabNurses: "الممرضون",
    tabDrivers: "سيارات الإسعاف",
    tabFacilities: "المصحات والصيدليات",
    doctorsHeading: "الأطباء والأخصائيون",
    doctorsSubtitle: "استشارات في العيادة وعبر الفيديو",
    inspectPrefix: "معاينة صورة",
    inspectPhotoSuffix: "",
    specialtyLabel: "التخصص",
    practicingCenterLabel: "مكان العمل",
    regionalPractice: "عيادة إقليمية",
    careModesLabel: "طرق الاستشارة",
    careModesClinicVideo: "زيارة فالعيادة · فيديو",
    careModesShort: "العيادة · فيديو",
    consultationFeeLabel: "ثمن الكشف",
    bookDoctorAction: "حجز موعد طبيب",
    medicalClinicSuffix: "عيادة طبية",
    profileBtn: "الملف",
    bookVisitBtn: "حجز موعد",
    nursesHeading: "الممرضون والرعاية المنزلية",
    nursesSubtitle: "زيارات منزلية ورعاية ما بعد العمليات",
    homeVisitDispatch: "زيارة للبيت",
    homeVisitInfirmierBadge: "ممرض منزلي",
    careTrackLabel: "المجال",
    visitModeLabel: "طريقة الرعاية",
    homeVisitDomicile: "زيارة منزلية للدار",
    dispatchBaseLabel: "مركز الانطلاق",
    hospitalNetwork: "شبكة المستشفيات",
    homeVisitFeeLabel: "تعريفة الزيارة",
    requestNurseAction: "طلب ممرض للدار",
    homeVisitBadge: "للدار",
    dispatchFromPrefix: "ينطلق من",
    perHomeVisit: "/ زيارة منزلية",
    requestHomeVisitBtn: "طلب للدار",
    driversHeading: "سيارات الإسعاف والنقل الطبي",
    driversSubtitle: "أسطول متتبع عبر GPS",
    standbyStatus: "في وضع الاستعداد",
    unitTypeLabel: "نوع المركبة",
    vehicleLabel: "السيارة",
    zoneLabel: "منطقة الخدمة",
    homeBaseLabel: "المركز",
    regionalDispatch: "المركز الإقليمي",
    trackOnLiveMapAction: "تتبع على الخريطة المباشرة",
    emsAmbulance: "سيارة إسعاف",
    medicalShuttle: "حافلة طبية",
    unitInfoBtn: "معلومات المركبة",
    trackOnMapBtn: "على الخريطة",
    facilitiesHeading: "المستشفيات، العيادات، الصيدليات والمختبرات",
    facilitiesSubtitle: "شبكة معتمدة من الوزارة",
    browsePharmacyCta: "تصفح الصيدلية",
    labQueueCta: "لائحة المختبر",
    viewOnMapCta: "عرض على الخريطة",
    facilityTypeLabel: "النوع",
    licenseLabel: "رقم الترخيص",
    addressLabel: "العنوان",
    statusLabel: "الحالة",
    teamAndInfoBtn: "الفريق والمعلومات",
    emptyTitlePrefix: "لا توجد ملفات مطابقة في",
    emptyHint: "حاول مسح البحث أو تعديل الفلاتر أعلاه.",
    modalDialogAria: "تفاصيل الملف الصحي",
    copiedToast: "تم نسخ رابط الملف بنجاح.",
    copyUnavailableToast: "النسخ غير متاح في هذا المتصفح.",
    portraitSuffix: "صورة شخصية",
    closeModalAria: "إغلاق الملف",
    copyLinkAria: "نسخ الرابط",
    ministryVerified: "معتمد رسمياً",
    practicingLocation: "مكان العمل",
    todayOpenWindows: "الأوقات المتاحة اليوم",
    loadingSlots: "جاري فحص المواعيد المفتوحة...",
    noSlotsRemainingToday:
      "انتهت مواعيد اليوم — تحقق من الغد في جدول المواعيد.",
    moreLabel: "أخرى",
    inPersonOrTelehealth: "في مقر عمل الطبيب أو مكالمة فيديو مباشرة",
    visitWorkplaceBtn: "زيارة فالعيادة ←",
    videoCallBtn: "مكالمة فيديو ←",
    coverageZoneLabel: "نطاق التغطية",
    dispatchBaseFacilityLabel: "مركز الانطلاق",
    fastBookUnitBtn: "طلب سريع للإسعاف ←",
    openPharmacyCatalogBtn: "فتح الصيدلية ←",
    viewLabServicesBtn: "خدمات المختبر ←",
    locateOnMapBtn: "تحديد الموقع على الخريطة ←",
    staffUnitsHeading: "الطاقم الطبي والوحدات في هذا المركز",
    nurseHomeVisitTag: "للدار",
    verifiedPractitionerBadge: "ممارس معتمد",
    homeNursingBadge: "تمريض منزلي",
    clinicalNetworkSuffix: "الشبكة الطبية",
    careDeliveryModesHeading: "طرق الاستشارة",
    clinicVisitWord: "زيارة فالعيادة",
    videoWord: "فيديو",
    verifiedWorkplaceHeading: "مكان العمل المعتمد",
    regionalClinicFallback: "عيادة إقليمية",
    openOnMapCta: "عرض على الخريطة",
    liveScheduleSync: "مزامنة مباشرة",
    emptySlotsCalendarHint:
      "اعرض التقويم التفاعلي في صفحة الحجز لاختيار الساعات المتاحة القادمة.",
    zoomPortraitAria: "تكبير صورة",
  },
};
