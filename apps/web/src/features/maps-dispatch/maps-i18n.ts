import type { LocaleCode } from "@medisync/contracts";

export interface MapsUiCopy {
  fastBookPill: string;
  liveRideTrackerAria: string;
  liveRideTrackerPrefix: string;
  kmAwaySuffix: string;
  broadcastingPickup: string;
  destinationLabel: string;
  nearestHospitalFallback: string;
  cancelRequestBtn: string;
  cancellingBtn: string;
  newFastBookBtn: string;
  closeFastBookAria: string;
  autoPickupAria: string;
  pickupGpsDetected: string;
  pickupPinSet: string;
  pickupAutoArea: string;
  redetectPickupAria: string;
  redetectPickupTitle: string;
  fastBookDestAria: string;
  destFromMap: string;
  destAutoClosest: string;
  nearestOpenClinicHospital: string;
  tapMapIconHint: string;
  autoClosestBtn: string;
  fastBookNearestDriverBtn: string;
  unitLabel: string;
  openPharmacyStorefront: string;
  viewDiagnosticLab: string;
  bookAppointment: string;
  detailsSuffix: string;
  medicalShuttle: string;
  ambulanceUnit: string;
  verifiedBadge: string;
  closeDetailsAria: string;
  driverPortraitSuffix: string;
  driverWord: string;
  statusLabel: string;
  vehicleLabel: string;
  serviceZoneLabel: string;
  baseFacilityLabel: string;
  dispatchContactLabel: string;
  locationDistanceLabel: string;
  lastGpsSyncLabel: string;
  viewBaseHubBtn: string;
  openDispatchPortalBtn: string;
  badge247: string;
  badgeEmergencyCare: string;
  badgeTelehealth: string;
  badgeHomeVisits: string;
  addressCoordsLabel: string;
  phoneEmergencyLabel: string;
  emergencyHotlinePrefix: string;
  licenseAccreditationLabel: string;
  specialtiesServicesLabel: string;
  acceptedInsuranceLabel: string;
  languagesLabel: string;
  stationedStaffHeading: string;
  fastBookEmsHereBtn: string;
  clinicianPortraitSuffix: string;
  clinicianWord: string;
  medicalPracticeFallback: string;
  practiceFallback: string;
  practiceFacilityLabel: string;
  consultationFeeLabel: string;
  consultationModesLabel: string;
  clinicVisitWord: string;
  videoVisitWord: string;
  homeVisitWord: string;
  emailLabel: string;
  viewClinicBtn: string;
  clientsWord: string;
  clientWord: string;
  dropoffsWord: string;
  dropoffWord: string;
  verifiedDoctorsWord: string;
  zoomInAria: string;
  zoomOutAria: string;
  centerMapAria: string;
  exitFullscreenAria: string;
  expandFullscreenAria: string;
  selectedPickupPinAria: string;
  clientPickupWord: string;
  yourPickupWord: string;
  medicalUnitWord: string;
  assignedToTripSuffix: string;
  yourAssignedDriverAria: string;
  selectDriverAria: string;
  yourDriverWord: string;
  selectDoctorAria: string;
  interactiveStreetMapAria: string;
  sectorOptions: {
    DRIVER: string;
    DOCTOR: string;
    HOSPITAL: string;
    CLINIC: string;
    PHARMACY: string;
    DIAGNOSTIC_LAB: string;
  };
  driverLayerOptions: {
    ALL: string;
    CLIENTS: string;
    DESTINATIONS: string;
  };
  driverWorkspaceTitle: string;
  driverGateEyebrow: string;
  driverGateHeading: string;
  driverGateDesc: string;
  driverGateRegisterCta: string;
  driverGatePublicMapCta: string;
  driverPendingPrompt: string;
  collapseDispatchAria: string;
  expandDispatchAria: string;
  searchPlaceholder: string;
  searchAria: string;
  clearSearchAria: string;
  toggleFiltersAria: string;
  filtersBtn: string;
  matchingListAria: string;
  noSearchMatchesPrefix: string;
  mapFiltersDialogAria: string;
  searchAndFiltersTitle: string;
  mapFiltersTitle: string;
  closeFiltersAria: string;
  driverSearchAria: string;
  driverSearchPlaceholder: string;
  cityLabel: string;
  filterCityAria: string;
  groupMorocco: string;
  groupIntlHubs: string;
  openDropoffsOnly: string;
  availableDriversOnly: string;
  resetBtn: string;
  driverFocusAria: string;
  serviceCategoryAria: string;
  liveClientFeedBadge: string;
  feedSyncedBadge: string;
  searchAndFiltersAria: string;
  signOutAria: string;
  guestUrgentBadge: string;
  signInCta: string;
  hideDetailsBtn: string;
  detailsAndFleetBtn: string;
  destHospitalsHeading: string;
  panMapHint: string;
  activeClientPickup: string;
  selectedClientRequest: string;
  takeClientToLabel: string;
  goOnlineBtn: string;
  enRouteBtn: string;
  offDutyBtn: string;
  latitudeLabel: string;
  longitudeLabel: string;
  statusReady: string;
  statusAssigned: string;
  statusOnTheWay: string;
  updateAmbulanceLocBtn: string;
  incomingClientsHeading: string;
  noOpenPickupsHint: string;
  dropoffPrefix: string;
  openDriverPanelBtn: string;
  acceptingBtn: string;
  finishActiveFirstBtn: string;
  acceptClientBtn: string;
  refuseBtn: string;
  startEnRouteBtn: string;
  releaseRideBtn: string;
  markArrivedBtn: string;
  completeDropoffBtn: string;
  routeSummaryAria: string;
  routePickupLegLabel: string;
  routeDropoffLegLabel: string;
  minutesShort: string;
  kmShort: string;
  secondsShort: string;
  autoRefusePrefix: string;
  liveOfferBadge: string;
  offerExpiredAutoRefused: string;
  liveDemandArrived: string;
  onlineListening: string;
  onlineShortBadge: string;
  offDutyPaused: string;
  syncingDutyStatus: string;
  syncGpsAria: string;
  autoGpsAria: string;
  navigatePickupBtn: string;
  navigateHospitalBtn: string;
  navigateFacilityBtn: string;
  waitingDemandsLabel: string;
  closePanelAria: string;
  gpsUnavailableNotice: string;
  gpsDeniedNotice: string;
  activeMissionDutyLockNotice: string;
  driverOnlineNotice: string;
  driverOffDutyNotice: string;
  returnToOfferCta: string;
}

export const MAPS_COPY: Record<LocaleCode, MapsUiCopy> = {
  en: {
    fastBookPill: "1-Tap Fast Book",
    liveRideTrackerAria: "Live Approaching Transport Tracker",
    liveRideTrackerPrefix: "Live Ride Tracker",
    kmAwaySuffix: "km away",
    broadcastingPickup: "Broadcasting pickup request to nearby ambulances...",
    destinationLabel: "Destination:",
    nearestHospitalFallback: "Nearest Verified Hospital / Clinic",
    cancelRequestBtn: "Cancel Request",
    cancellingBtn: "Cancelling...",
    newFastBookBtn: "New Fast Book",
    closeFastBookAria: "Close Fast Book panel",
    autoPickupAria: "Auto-detected pickup location",
    pickupGpsDetected: "Pickup · Live GPS Detected",
    pickupPinSet: "Pickup · Map Pin Set",
    pickupAutoArea: "Pickup · Auto Area",
    redetectPickupAria: "Re-detect pickup location",
    redetectPickupTitle: "Re-detect live GPS location",
    fastBookDestAria: "Fast book destination facility",
    destFromMap: "Destination · Selected from Map",
    destAutoClosest: "Destination · Auto Closest Open",
    nearestOpenClinicHospital: "Nearest Open Hospital / Clinic",
    tapMapIconHint: "Tap any hospital or clinic icon on the map to choose",
    autoClosestBtn: "Auto Closest",
    fastBookNearestDriverBtn: "Fast Book Nearest Driver",
    unitLabel: "Unit",
    openPharmacyStorefront: "Open Pharmacy Storefront",
    viewDiagnosticLab: "View Diagnostic Lab",
    bookAppointment: "Book Appointment",
    detailsSuffix: "details",
    medicalShuttle: "Medical Shuttle",
    ambulanceUnit: "Ambulance Unit",
    verifiedBadge: "Verified",
    closeDetailsAria: "Close details card",
    driverPortraitSuffix: "portrait",
    driverWord: "Driver",
    statusLabel: "Status",
    vehicleLabel: "Vehicle",
    serviceZoneLabel: "Service Zone",
    baseFacilityLabel: "Base Facility",
    dispatchContactLabel: "Dispatch Contact",
    locationDistanceLabel: "Location & Distance",
    lastGpsSyncLabel: "Last GPS Sync",
    viewBaseHubBtn: "View Base Hub",
    openDispatchPortalBtn: "Open Dispatch Portal",
    badge247: "24/7 Service",
    badgeEmergencyCare: "Emergency Care",
    badgeTelehealth: "Telehealth",
    badgeHomeVisits: "Home Visits",
    addressCoordsLabel: "Address & Coordinates",
    phoneEmergencyLabel: "Phone & Emergency",
    emergencyHotlinePrefix: "Emergency Hotline",
    licenseAccreditationLabel: "License & Accreditation",
    specialtiesServicesLabel: "Specialties & Services",
    acceptedInsuranceLabel: "Accepted Insurance",
    languagesLabel: "Languages",
    stationedStaffHeading: "Stationed Doctors & Nurses",
    fastBookEmsHereBtn: "Fast Book EMS Here",
    clinicianPortraitSuffix: "portrait",
    clinicianWord: "Clinician",
    medicalPracticeFallback: "Medical Practice",
    practiceFallback: "Practice",
    practiceFacilityLabel: "Practice Facility",
    consultationFeeLabel: "Consultation Fee",
    consultationModesLabel: "Consultation Modes",
    clinicVisitWord: "Clinic Visit",
    videoVisitWord: "Video Visit",
    homeVisitWord: "Home Visit",
    emailLabel: "Email",
    viewClinicBtn: "View Clinic",
    clientsWord: "clients",
    clientWord: "client",
    dropoffsWord: "drop-offs",
    dropoffWord: "drop-off",
    verifiedDoctorsWord: "verified doctor(s)",
    zoomInAria: "Zoom in viewport",
    zoomOutAria: "Zoom out viewport",
    centerMapAria: "Center map on region",
    exitFullscreenAria: "Exit full-screen map",
    expandFullscreenAria: "Expand full-screen map",
    selectedPickupPinAria: "Selected Pickup Location Pin",
    clientPickupWord: "Client pickup",
    yourPickupWord: "Your pickup",
    medicalUnitWord: "Medical Unit",
    assignedToTripSuffix: "Assigned to your trip",
    yourAssignedDriverAria: "Your assigned driver unit",
    selectDriverAria: "Select driver unit",
    yourDriverWord: "Your Driver",
    selectDoctorAria: "Select doctor",
    interactiveStreetMapAria: "Interactive street map of",
    sectorOptions: {
      DRIVER: "Ambulances & Drivers",
      DOCTOR: "Doctors & Nurses",
      HOSPITAL: "Hospitals",
      CLINIC: "Clinics",
      PHARMACY: "Pharmacies",
      DIAGNOSTIC_LAB: "Diagnostic Labs",
    },
    driverLayerOptions: {
      ALL: "Clients & Destinations",
      CLIENTS: "Client Pickups",
      DESTINATIONS: "Hospitals & Clinics",
    },
    driverWorkspaceTitle: "Driver Relay Workspace",
    driverGateEyebrow: "Driver Relay Workspace",
    driverGateHeading: "Sign in with your verified driver account",
    driverGateDesc:
      "Receive nearby client pickups, accept or refuse incoming requests, broadcast live vehicle status, and route directly to destination hospitals and clinics.",
    driverGateRegisterCta: "Register or Sign In as Driver →",
    driverGatePublicMapCta: "Open Patient Live Map",
    driverPendingPrompt: "Signed in as a driver candidate.",
    collapseDispatchAria: "Collapse dispatch panel",
    expandDispatchAria: "Expand dispatch panel",
    searchPlaceholder: "Search hospital, clinic, doctor, or zone...",
    searchAria: "Search facilities or doctors",
    clearSearchAria: "Clear map search",
    toggleFiltersAria: "Toggle map filters",
    filtersBtn: "Filters",
    matchingListAria: "Matching facilities and doctors",
    noSearchMatchesPrefix: "No verified facilities or doctors matched",
    mapFiltersDialogAria: "Map Search and Filters",
    searchAndFiltersTitle: "Search & Filters",
    mapFiltersTitle: "Map Filters",
    closeFiltersAria: "Close filters",
    driverSearchAria: "Search medical centers, doctors, or pickup zone",
    driverSearchPlaceholder: "Filter clients or hospitals...",
    cityLabel: "City",
    filterCityAria: "Filter by city",
    groupMorocco: "Morocco",
    groupIntlHubs: "International Hubs",
    openDropoffsOnly: "Open Drop-Offs Only",
    availableDriversOnly: "Available Drivers Only",
    resetBtn: "Reset",
    driverFocusAria: "Driver map focus filter",
    serviceCategoryAria: "Service category options",
    liveClientFeedBadge: "Live Client Feed",
    feedSyncedBadge: "Feed Synced",
    searchAndFiltersAria: "Search & Filters",
    signOutAria: "Sign Out",
    guestUrgentBadge: "Guest Urgent",
    signInCta: "Sign In",
    hideDetailsBtn: "Hide Details",
    detailsAndFleetBtn: "Details & Fleet",
    destHospitalsHeading: "Destination Hospitals & Clinics",
    panMapHint:
      "Pan the map or tap Search This Area to view nearby receiving hospitals and clinics.",
    activeClientPickup: "Active Client Pickup",
    selectedClientRequest: "Selected Client Request",
    takeClientToLabel: "Take Client To:",
    goOnlineBtn: "Go Online",
    enRouteBtn: "En Route",
    offDutyBtn: "Off Duty",
    latitudeLabel: "Latitude",
    longitudeLabel: "Longitude",
    statusReady: "Ready for Requests",
    statusAssigned: "Assigned to Patient",
    statusOnTheWay: "On the Way",
    updateAmbulanceLocBtn: "Update Ambulance Location",
    incomingClientsHeading: "Incoming & Active Clients",
    noOpenPickupsHint: "No open client pickup requests in your service zone right now.",
    dropoffPrefix: "Drop-off:",
    openDriverPanelBtn: "Open Driver Dispatch Panel",
    acceptingBtn: "Accepting...",
    finishActiveFirstBtn: "Finish Active Ride First",
    acceptClientBtn: "Accept Client",
    refuseBtn: "Refuse",
    startEnRouteBtn: "Start En Route",
    releaseRideBtn: "Release Ride",
    markArrivedBtn: "Mark Arrived at Pickup",
    completeDropoffBtn: "Complete Hospital Drop-Off",
    routeSummaryAria: "Live Route Time and Distance",
    routePickupLegLabel: "Driver → Pickup",
    routeDropoffLegLabel: "Pickup → Destination",
    minutesShort: "min",
    kmShort: "km",
    secondsShort: "s",
    autoRefusePrefix: "Auto-refuses in",
    liveOfferBadge: "Live Demand",
    offerExpiredAutoRefused:
      "Demand timed out after 60s — automatically refused.",
    liveDemandArrived: "New live pickup request received — 60s to respond.",
    onlineListening: "Online · Receiving live demands",
    onlineShortBadge: "Online",
    offDutyPaused: "Off Duty · Demands paused",
    syncingDutyStatus: "Syncing status...",
    syncGpsAria: "Sync live GPS location",
    autoGpsAria: "Toggle live auto-GPS tracking",
    navigatePickupBtn: "Navigate Pickup",
    navigateHospitalBtn: "Navigate Hospital",
    navigateFacilityBtn: "Navigate to Facility",
    waitingDemandsLabel: "More live demands",
    closePanelAria: "Close panel",
    gpsUnavailableNotice:
      "Device geolocation unavailable. Enable browser location to broadcast live GPS.",
    gpsDeniedNotice:
      "Browser location permission denied. Allow location access to sync your ambulance GPS.",
    activeMissionDutyLockNotice:
      "Complete or release your active patient mission before going Off Duty.",
    driverOnlineNotice:
      "You are now Online and receiving live pickup demands.",
    driverOffDutyNotice:
      "You are now Off Duty. New pickup demands are paused.",
    returnToOfferCta: "Respond now",
  },
  fr: {
    fastBookPill: "Appel Express 1-Clic",
    liveRideTrackerAria: "Suivi en direct du transport médical",
    liveRideTrackerPrefix: "Suivi Trajet",
    kmAwaySuffix: "km",
    broadcastingPickup: "Diffusion de la demande aux ambulances proches...",
    destinationLabel: "Destination :",
    nearestHospitalFallback: "Hôpital / Clinique vérifié le plus proche",
    cancelRequestBtn: "Annuler la demande",
    cancellingBtn: "Annulation...",
    newFastBookBtn: "Nouvelle demande",
    closeFastBookAria: "Fermer le panneau d'appel rapide",
    autoPickupAria: "Lieu de prise en charge détecté",
    pickupGpsDetected: "Départ · GPS en direct détecté",
    pickupPinSet: "Départ · Repère carte défini",
    pickupAutoArea: "Départ · Zone détectée",
    redetectPickupAria: "Recalculer ma position GPS",
    redetectPickupTitle: "Recalculer ma position GPS en direct",
    fastBookDestAria: "Établissement de destination",
    destFromMap: "Destination · Choisie sur la carte",
    destAutoClosest: "Destination · Plus proche ouvert",
    nearestOpenClinicHospital: "Hôpital / Clinique ouvert le plus proche",
    tapMapIconHint: "Touchez un hôpital ou une clinique sur la carte pour choisir",
    autoClosestBtn: "Plus proche auto",
    fastBookNearestDriverBtn: "Envoyer l'ambulance la plus proche",
    unitLabel: "Unité",
    openPharmacyStorefront: "Ouvrir la pharmacie",
    viewDiagnosticLab: "Voir le laboratoire",
    bookAppointment: "Prendre rendez-vous",
    detailsSuffix: "détails",
    medicalShuttle: "Navette Médicale",
    ambulanceUnit: "Ambulance SMUR",
    verifiedBadge: "Vérifié",
    closeDetailsAria: "Fermer la fiche",
    driverPortraitSuffix: "portrait",
    driverWord: "Chauffeur",
    statusLabel: "Statut",
    vehicleLabel: "Véhicule",
    serviceZoneLabel: "Zone de service",
    baseFacilityLabel: "Base d'attache",
    dispatchContactLabel: "Contact régulation",
    locationDistanceLabel: "Position & distance",
    lastGpsSyncLabel: "Dernier signal GPS",
    viewBaseHubBtn: "Voir le centre",
    openDispatchPortalBtn: "Portail régulation",
    badge247: "Ouvert 24/7",
    badgeEmergencyCare: "Urgences",
    badgeTelehealth: "Téléconsultation",
    badgeHomeVisits: "Visite à domicile",
    addressCoordsLabel: "Adresse & coordonnées",
    phoneEmergencyLabel: "Téléphone & Urgence",
    emergencyHotlinePrefix: "Numéro d'urgence",
    licenseAccreditationLabel: "Agrément & accréditation",
    specialtiesServicesLabel: "Spécialités & services",
    acceptedInsuranceLabel: "Mutuelles acceptées",
    languagesLabel: "Langues",
    stationedStaffHeading: "Médecins & Infirmiers rattachés",
    fastBookEmsHereBtn: "Urgence vers ce centre",
    clinicianPortraitSuffix: "portrait",
    clinicianWord: "Praticien",
    medicalPracticeFallback: "Cabinet médical",
    practiceFallback: "Cabinet",
    practiceFacilityLabel: "Lieu d'exercice",
    consultationFeeLabel: "Tarif consultation",
    consultationModesLabel: "Modes de visite",
    clinicVisitWord: "Cabinet",
    videoVisitWord: "Vidéo",
    homeVisitWord: "À domicile",
    emailLabel: "E-mail",
    viewClinicBtn: "Voir clinique",
    clientsWord: "patients",
    clientWord: "patient",
    dropoffsWord: "destinations",
    dropoffWord: "destination",
    verifiedDoctorsWord: "médecin(s) vérifié(s)",
    zoomInAria: "Zoomer",
    zoomOutAria: "Dézoomer",
    centerMapAria: "Centrer la carte",
    exitFullscreenAria: "Quitter le plein écran",
    expandFullscreenAria: "Agrandir en plein écran",
    selectedPickupPinAria: "Point de départ sélectionné",
    clientPickupWord: "Prise en charge client",
    yourPickupWord: "Votre départ",
    medicalUnitWord: "Unité médicale",
    assignedToTripSuffix: "Affecté à votre trajet",
    yourAssignedDriverAria: "Votre ambulance assignée",
    selectDriverAria: "Sélectionner l'unité",
    yourDriverWord: "Votre chauffeur",
    selectDoctorAria: "Sélectionner médecin",
    interactiveStreetMapAria: "Carte interactive de",
    sectorOptions: {
      DRIVER: "Ambulances & Chauffeurs",
      DOCTOR: "Médecins & Infirmiers",
      HOSPITAL: "Hôpitaux",
      CLINIC: "Cliniques",
      PHARMACY: "Pharmacies",
      DIAGNOSTIC_LAB: "Laboratoires",
    },
    driverLayerOptions: {
      ALL: "Clients & Hôpitaux",
      CLIENTS: "Appels Clients",
      DESTINATIONS: "Hôpitaux & Cliniques",
    },
    driverWorkspaceTitle: "Console Chauffeur Ambulance",
    driverGateEyebrow: "Espace Ambulance & Relais",
    driverGateHeading: "Connectez-vous avec votre compte ambulancier vérifié",
    driverGateDesc:
      "Recevez les demandes à proximité, acceptez ou refusez les courses, diffusez votre position GPS et rejoignez les urgences.",
    driverGateRegisterCta: "Connexion / Inscription Chauffeur →",
    driverGatePublicMapCta: "Voir la carte publique",
    driverPendingPrompt: "Connecté en tant que candidat chauffeur.",
    collapseDispatchAria: "Réduire le panneau",
    expandDispatchAria: "Afficher le panneau",
    searchPlaceholder: "Hôpital, clinique, médecin ou quartier...",
    searchAria: "Rechercher établissements ou médecins",
    clearSearchAria: "Effacer la recherche",
    toggleFiltersAria: "Afficher les filtres",
    filtersBtn: "Filtres",
    matchingListAria: "Établissements et médecins correspondants",
    noSearchMatchesPrefix: "Aucun résultat vérifié pour",
    mapFiltersDialogAria: "Recherche et filtres carte",
    searchAndFiltersTitle: "Recherche & Filtres",
    mapFiltersTitle: "Filtres de la carte",
    closeFiltersAria: "Fermer les filtres",
    driverSearchAria: "Rechercher hôpital ou secteur client",
    driverSearchPlaceholder: "Filtrer clients ou hôpitaux...",
    cityLabel: "Ville",
    filterCityAria: "Filtrer par ville",
    groupMorocco: "Maroc",
    groupIntlHubs: "Pôles internationaux",
    openDropoffsOnly: "Centres ouverts uniquement",
    availableDriversOnly: "Unités disponibles uniquement",
    resetBtn: "Réinitialiser",
    driverFocusAria: "Filtre d'affichage chauffeur",
    serviceCategoryAria: "Catégorie de carte",
    liveClientFeedBadge: "Flux Direct Actif",
    feedSyncedBadge: "Flux Synchronisé",
    searchAndFiltersAria: "Recherche & Filtres",
    signOutAria: "Déconnexion",
    guestUrgentBadge: "Urgence Invité",
    signInCta: "Connexion",
    hideDetailsBtn: "Masquer",
    detailsAndFleetBtn: "Détails & Flotte",
    destHospitalsHeading: "Hôpitaux & Cliniques d'accueil",
    panMapHint:
      "Déplacez la carte pour afficher les hôpitaux et cliniques d'accueil à proximité.",
    activeClientPickup: "Prise en charge active",
    selectedClientRequest: "Demande client sélectionnée",
    takeClientToLabel: "Transporter vers :",
    goOnlineBtn: "Disponible",
    enRouteBtn: "En route",
    offDutyBtn: "Hors service",
    latitudeLabel: "Latitude",
    longitudeLabel: "Longitude",
    statusReady: "Disponible pour missions",
    statusAssigned: "Assigné au patient",
    statusOnTheWay: "En route",
    updateAmbulanceLocBtn: "Mettre à jour ma position",
    incomingClientsHeading: "Clients entrants & en cours",
    noOpenPickupsHint: "Aucune demande ouverte dans votre secteur pour l'instant.",
    dropoffPrefix: "Destination :",
    openDriverPanelBtn: "Ouvrir le panneau chauffeur",
    acceptingBtn: "Acceptation...",
    finishActiveFirstBtn: "Terminez d'abord la course active",
    acceptClientBtn: "Accepter le client",
    refuseBtn: "Refuser",
    startEnRouteBtn: "Démarrer le trajet",
    releaseRideBtn: "Libérer",
    markArrivedBtn: "Arrivé sur place",
    completeDropoffBtn: "Dépose à l'hôpital terminée",
    routeSummaryAria: "Temps et distance du trajet en direct",
    routePickupLegLabel: "Chauffeur → Patient",
    routeDropoffLegLabel: "Patient → Destination",
    minutesShort: "min",
    kmShort: "km",
    secondsShort: "s",
    autoRefusePrefix: "Refus auto dans",
    liveOfferBadge: "Demande en direct",
    offerExpiredAutoRefused:
      "Demande expirée après 60 s — refusée automatiquement.",
    liveDemandArrived: "Nouvelle demande reçue en direct — 60 s pour répondre.",
    onlineListening: "En ligne · Réception en direct",
    onlineShortBadge: "En ligne",
    offDutyPaused: "Hors service · Demandes en pause",
    syncingDutyStatus: "Synchronisation...",
    syncGpsAria: "Synchroniser ma position GPS",
    autoGpsAria: "Activer le suivi GPS automatique",
    navigatePickupBtn: "Itinéraire Départ",
    navigateHospitalBtn: "Itinéraire Hôpital",
    navigateFacilityBtn: "Ouvrir l'itinéraire",
    waitingDemandsLabel: "Autres demandes",
    closePanelAria: "Fermer le panneau",
    gpsUnavailableNotice:
      "Géolocalisation indisponible sur cet appareil. Activez le GPS pour diffuser votre position.",
    gpsDeniedNotice:
      "Accès à la position refusé. Autorisez la géolocalisation dans votre navigateur pour synchroniser le GPS.",
    activeMissionDutyLockNotice:
      "Terminez ou libérez la mission en cours avant de passer hors service.",
    driverOnlineNotice:
      "Vous êtes en ligne et prêt à recevoir les demandes en direct.",
    driverOffDutyNotice:
      "Vous êtes hors service. Les nouvelles demandes sont mises en pause.",
    returnToOfferCta: "Répondre",
  },
  ar: {
    fastBookPill: "طلب إسعاف سريع",
    liveRideTrackerAria: "تتبع سيارة الإسعاف مباشرة",
    liveRideTrackerPrefix: "التتبع المباشر",
    kmAwaySuffix: "كلم عنك",
    broadcastingPickup: "جاري إرسال طلبك لأقرب سيارات الإسعاف...",
    destinationLabel: "الوجهة:",
    nearestHospitalFallback: "أقرب مستشفى أو عيادة معتمدة",
    cancelRequestBtn: "إلغاء الطلب",
    cancellingBtn: "جاري الإلغاء...",
    newFastBookBtn: "طلب جديد",
    closeFastBookAria: "إغلاق نافذة الطلب السريع",
    autoPickupAria: "موقع الانطلاق المحدد تلقائياً",
    pickupGpsDetected: "نقطة الانطلاق · موقع GPS مباشر",
    pickupPinSet: "نقطة الانطلاق · محددة على الخريطة",
    pickupAutoArea: "نقطة الانطلاق · المنطقة الحالية",
    redetectPickupAria: "إعادة تحديد موقعي GPS",
    redetectPickupTitle: "تحديث موقعي المباشر",
    fastBookDestAria: "المستشفى أو المصحة المستهدفة",
    destFromMap: "الوجهة · مختارة من الخريطة",
    destAutoClosest: "الوجهة · أقرب مركز مفتوح",
    nearestOpenClinicHospital: "أقرب مستشفى أو عيادة مفتوحة",
    tapMapIconHint: "اضغط على أي مستشفى أو عيادة في الخريطة لاختيارها",
    autoClosestBtn: "الأقرب تلقائياً",
    fastBookNearestDriverBtn: "طلب أقرب سيارة إسعاف الآن",
    unitLabel: "مركبة",
    openPharmacyStorefront: "فتح الصيدلية",
    viewDiagnosticLab: "عرض المختبر",
    bookAppointment: "حجز موعد",
    detailsSuffix: "تفاصيل",
    medicalShuttle: "حافلة طبية",
    ambulanceUnit: "سيارة إسعاف",
    verifiedBadge: "معتمد",
    closeDetailsAria: "إغلاق بطاقة التفاصيل",
    driverPortraitSuffix: "صورة",
    driverWord: "السائق",
    statusLabel: "الحالة",
    vehicleLabel: "السيارة",
    serviceZoneLabel: "نطاق التغطية",
    baseFacilityLabel: "المركز الأساسي",
    dispatchContactLabel: "رقم التواصل",
    locationDistanceLabel: "الموقع والمسافة",
    lastGpsSyncLabel: "آخر تحديث GPS",
    viewBaseHubBtn: "عرض المركز",
    openDispatchPortalBtn: "بوابة التوجيه",
    badge247: "مفتوح 24/7",
    badgeEmergencyCare: "قسم المستعجلات",
    badgeTelehealth: "استشارة عن بُعد",
    badgeHomeVisits: "زيارات منزلية",
    addressCoordsLabel: "العنوان والإحداثيات",
    phoneEmergencyLabel: "الهاتف والطوارئ",
    emergencyHotlinePrefix: "خط الطوارئ",
    licenseAccreditationLabel: "الترخيص والاعتماد",
    specialtiesServicesLabel: "التخصصات والخدمات",
    acceptedInsuranceLabel: "التأمينات المقبولة",
    languagesLabel: "اللغات",
    stationedStaffHeading: "الأطباء والممرضون في هذا المركز",
    fastBookEmsHereBtn: "إسعاف إلى هنا",
    clinicianPortraitSuffix: "صورة",
    clinicianWord: "الإطار الطبي",
    medicalPracticeFallback: "عيادة طبية",
    practiceFallback: "العيادة",
    practiceFacilityLabel: "مكان العمل",
    consultationFeeLabel: "ثمن الاستشارة",
    consultationModesLabel: "طرق الاستشارة",
    clinicVisitWord: "في العيادة",
    videoVisitWord: "مكالمة فيديو",
    homeVisitWord: "زيارة منزلية",
    emailLabel: "البريد الإلكتروني",
    viewClinicBtn: "عرض العيادة",
    clientsWord: "مرضى",
    clientWord: "مريض",
    dropoffsWord: "وجهات",
    dropoffWord: "وجهة",
    verifiedDoctorsWord: "طبيب(ة) معتمد(ة)",
    zoomInAria: "تكبير الخريطة",
    zoomOutAria: "تصغير الخريطة",
    centerMapAria: "توسيط الخريطة على المدينة",
    exitFullscreenAria: "الخروج من ملء الشاشة",
    expandFullscreenAria: "توسيع الخريطة لملء الشاشة",
    selectedPickupPinAria: "نقطة الانطلاق المختارة",
    clientPickupWord: "موقع المريض",
    yourPickupWord: "موقعك الحالي",
    medicalUnitWord: "وحدة طبية",
    assignedToTripSuffix: "مخصصة لطلبك",
    yourAssignedDriverAria: "سيارة الإسعاف المخصصة لك",
    selectDriverAria: "اختيار سيارة إسعاف",
    yourDriverWord: "سائقك المباشر",
    selectDoctorAria: "اختيار الطبيب",
    interactiveStreetMapAria: "خريطة تفاعلية لـ",
    sectorOptions: {
      DRIVER: "الإسعاف والنقل الطبي",
      DOCTOR: "الأطباء والممرضون",
      HOSPITAL: "المستشفيات",
      CLINIC: "العيادات والمصحات",
      PHARMACY: "الصيدليات",
      DIAGNOSTIC_LAB: "مختبرات التحاليل",
    },
    driverLayerOptions: {
      ALL: "المرضى والمستشفيات",
      CLIENTS: "طلبات المرضى",
      DESTINATIONS: "المستشفيات والعيادات",
    },
    driverWorkspaceTitle: "لوحة سائق الإسعاف المباشرة",
    driverGateEyebrow: "فضاء سائق الإسعاف والنقل",
    driverGateHeading: "سجّل الدخول بحساب السائق المعتمد",
    driverGateDesc:
      "استقبل نداءات المرضى القريبين، اقبل الطلبات، بث موقع سيارتك عبر GPS وتوجه مباشرة إلى المستشفى المستهدف.",
    driverGateRegisterCta: "تسجيل الدخول أو إنشاء حساب سائق ←",
    driverGatePublicMapCta: "فتح خريطة المرضى",
    driverPendingPrompt: "مسجل الدخول كمرشح سائق.",
    collapseDispatchAria: "طي اللوحة",
    expandDispatchAria: "فتح اللوحة",
    searchPlaceholder: "ابحث عن مستشفى، عيادة، طبيب أو حي...",
    searchAria: "البحث عن المراكز أو الأطباء",
    clearSearchAria: "مسح البحث",
    toggleFiltersAria: "إظهار فلاتر الخريطة",
    filtersBtn: "فلاتر",
    matchingListAria: "المراكز والأطباء المطابقون",
    noSearchMatchesPrefix: "لا توجد مراكز أو أطباء مطابقون لـ",
    mapFiltersDialogAria: "البحث وفلاتر الخريطة",
    searchAndFiltersTitle: "البحث والفلاتر",
    mapFiltersTitle: "فلاتر الخريطة",
    closeFiltersAria: "إغلاق الفلاتر",
    driverSearchAria: "ابحث عن مركز طبي أو مريض",
    driverSearchPlaceholder: "تصفية المرضى أو المستشفيات...",
    cityLabel: "المدينة",
    filterCityAria: "تصفية حسب المدينة",
    groupMorocco: "المغرب",
    groupIntlHubs: "مراكز دولية",
    openDropoffsOnly: "المراكز المفتوحة الآن فقط",
    availableDriversOnly: "السيارات المتاحة فقط",
    resetBtn: "إعادة ضبط",
    driverFocusAria: "تصفية عرض السائق",
    serviceCategoryAria: "اختيار نوع العرض",
    liveClientFeedBadge: "تحديث مباشر",
    feedSyncedBadge: "تمت المزامنة",
    searchAndFiltersAria: "البحث والفلاتر",
    signOutAria: "تسجيل الخروج",
    guestUrgentBadge: "طوارئ للزوار",
    signInCta: "تسجيل الدخول",
    hideDetailsBtn: "إخفاء",
    detailsAndFleetBtn: "التفاصيل والأسطول",
    destHospitalsHeading: "مستشفيات وعيادات الاستقبال",
    panMapHint: "حرّك الخريطة لعرض المستشفيات والعيادات القريبة لاستقبال الحالات.",
    activeClientPickup: "مهمة نقل جارية",
    selectedClientRequest: "طلب مريض محدد",
    takeClientToLabel: "نقل المريض إلى:",
    goOnlineBtn: "متاح الآن",
    enRouteBtn: "في الطريق",
    offDutyBtn: "خارج الخدمة",
    latitudeLabel: "خط العرض",
    longitudeLabel: "خط الطول",
    statusReady: "مستعد لاستقبال الطلبات",
    statusAssigned: "مكلّف بمريض",
    statusOnTheWay: "في الطريق",
    updateAmbulanceLocBtn: "تحديث موقع سيارة الإسعاف",
    incomingClientsHeading: "نداءات المرضى الحالية",
    noOpenPickupsHint: "لا توجد طلبات نقل مفتوحة في منطقتك حالياً.",
    dropoffPrefix: "الوجهة:",
    openDriverPanelBtn: "فتح لوحة التوجيه",
    acceptingBtn: "جاري القبول...",
    finishActiveFirstBtn: "أنهِ المهمة الحالية أولاً",
    acceptClientBtn: "قبول الطلب",
    refuseBtn: "رفض",
    startEnRouteBtn: "انطلاق نحو المريض",
    releaseRideBtn: "إلغاء التخصيص",
    markArrivedBtn: "تأكيد الوصول للمريض",
    completeDropoffBtn: "إتمام التسليم للمستشفى",
    routeSummaryAria: "الوقت والمسافة على الخريطة",
    routePickupLegLabel: "السائق ← المريض",
    routeDropoffLegLabel: "المريض ← الوجهة",
    minutesShort: "دقيقة",
    kmShort: "كلم",
    secondsShort: "ث",
    autoRefusePrefix: "رفض تلقائي خلال",
    liveOfferBadge: "طلب مباشر",
    offerExpiredAutoRefused: "انتهت مهلة 60 ثانية — تم رفض الطلب تلقائياً.",
    liveDemandArrived: "وصل طلب نقل جديد مباشر — لديك 60 ثانية للرد.",
    onlineListening: "متاح · استقبال الطلبات مباشرة",
    onlineShortBadge: "متاح",
    offDutyPaused: "خارج الخدمة · الطلبات متوقفة",
    syncingDutyStatus: "جاري المزامنة...",
    syncGpsAria: "مزامنة موقع GPS المباشر",
    autoGpsAria: "تفعيل تتبع GPS التلقائي",
    navigatePickupBtn: "التوجيه للمريض",
    navigateHospitalBtn: "التوجيه للمستشفى",
    navigateFacilityBtn: "التوجيه للمركز",
    waitingDemandsLabel: "طلبات أخرى مباشرة",
    closePanelAria: "إغلاق اللوحة",
    gpsUnavailableNotice:
      "تحديد الموقع غير متوفر على هذا الجهاز. فعّل خدمة GPS لبث موقعك المباشر.",
    gpsDeniedNotice:
      "تم رفض إذن الموقع. اسمح للمتصفح بالوصول إلى موقعك لمزامنة موقع سيارة الإسعاف.",
    activeMissionDutyLockNotice:
      "أنهِ أو ألغِ تخصيص المهمة الجارية قبل التحول إلى خارج الخدمة.",
    driverOnlineNotice:
      "أنت الآن متاح وتستقبل طلبات النقل المباشرة.",
    driverOffDutyNotice:
      "أنت الآن خارج الخدمة. تم إيقاف استقبال الطلبات الجديدة مؤقتاً.",
    returnToOfferCta: "الرد الآن",
  },
};
