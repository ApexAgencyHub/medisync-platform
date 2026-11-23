import type { UiBadgeTone } from "@/shared/ui/primitives";
import type { BloodType, LocaleCode } from "@medisync/contracts";

export type PatientSearchCategory =
  | "ALL"
  | "DRIVER"
  | "DOCTOR"
  | "CARE_CENTER"
  | "PHARMACY_LAB";

export interface PatientSearchResultItem {
  id: string;
  category: Exclude<PatientSearchCategory, "ALL">;
  badgeLabel: string;
  badgeTone: UiBadgeTone;
  title: string;
  plainHint: string;
  subtitle: string;
  keywords: string;
  href: string;
  ctaLabel: string;
  secondaryHref?: string;
  secondaryCtaLabel?: string;
  specialty?: string;
  imageSrc: string;
  avatarName?: string;
  avatarRole?: string;
  avatarSpecialty?: string;
}

export interface PatientUiCopy {
  guestLabel: string;
  fastBookHeaderCta: string;
  reserveHeaderCta: string;
  signedOutNotice: string;
  navItems: ReadonlyArray<{
    href: string;
    label: string;
    isCurrent?: boolean;
  }>;
  guideEyebrow: string;
  guideTitle: string;
  guideSubtitle: string;
  guideCards: ReadonlyArray<{
    id: string;
    href: string;
    badge: string;
    badgeTone: UiBadgeTone;
    title: string;
    description: string;
    ctaLabel: string;
    imageSrc: string;
    imageAlt: string;
    secondaryHref?: string;
    secondaryLabel?: string;
    isEmergency?: boolean;
  }>;
  searchHeading: string;
  searchSubheading: string;
  searchAriaLabel: string;
  searchPlaceholder: string;
  clearSearchLabel: string;
  popularLabel: string;
  noResultsPrefix: string;
  resetSearchLabel: string;
  allSpecialtiesLabel: string;
  specialtyFilterLabel: string;
  filterTabs: ReadonlyArray<{ value: PatientSearchCategory; label: string }>;
  quickChips: ReadonlyArray<{ label: string; query: string }>;
  nearbyTitle: string;
  nearbySubtitle: string;
  nearbyBrowseAll: string;
  bookNowLabel: string;
  visitWorkplaceLabel: string;
  videoCallLabel: string;
  requestNurseLabel: string;
  openPharmacyLabel: string;
  seeOnMapLabel: string;
  openNowLabel: string;
  activityTitle: string;
  activityEmptyTitle: string;
  activityEmptyHint: string;
  trackedWord: string;
  savedWord: string;
  reserveVisitCta: string;
  openMapCta: string;
  savedTitle: string;
  savedEmptyTitle: string;
  savedEmptyHint: string;
  browseDoctorsCta: string;
  exploreMapCta: string;
  medicalPickupTitle: string;
  trackDriverCta: string;
  joinVideoCallCta: string;
  openItemCta: string;
  removePassAriaPrefix: string;
  healthFolderTitle: string;
  healthFolderSubtitle: string;
  signedInBadgePrefix: string;
  lockedBadge: string;
  lockedHeading: string;
  lockedDescription: string;
  lockedUnlockCta: string;
  lockedPreviews: ReadonlyArray<{
    title: string;
    detail: string;
    imageSrc: string;
    imageAlt: string;
  }>;
  apiOfflineText: string;
  loadingRecordsText: string;
  rxHeading: string;
  rxHint: string;
  rxEmpty: string;
  scansHeading: string;
  scansEmpty: string;
  inspectPhotoLabel: string;
  openDocumentLabel: string;
  notesHeading: string;
  notesEmpty: string;
  noteFoundLabel: string;
  noteNextStepsLabel: string;
  labsHeading: string;
  labsEmpty: string;
  safetyTitle: string;
  safetySubtitle: string;
  bloodGroupLabel: string;
  bloodTypeBadgePrefix: string;
  emergencyNameLabel: string;
  emergencyNamePlaceholder: string;
  emergencyPhoneLabel: string;
  allergiesHeading: string;
  allergiesEmpty: string;
  allergenPlaceholder: string;
  addAllergenLabel: string;
  chronicLabel: string;
  chronicPlaceholder: string;
  saveSafetyCta: string;
  savingCta: string;
  safetySavedToast: string;
  insuranceTitle: string;
  insuranceSubtitle: string;
  insuranceEmpty: string;
  addInsuranceHeading: string;
  quickFillLabel: string;
  insurerPlaceholder: string;
  policyPlaceholder: string;
  memberIdPlaceholder: string;
  planPlaceholder: string;
  percentLabel: string;
  saveInsuranceCta: string;
  savingInsuranceCta: string;
}

const PLAIN_SPECIALTY_MAP: Record<
  string,
  { en: string; fr: string; ar: string }
> = {
  cardiology: {
    en: "Heart & blood pressure",
    fr: "Cœur & tension artérielle",
    ar: "القلب وضغط الدم",
  },
  pediatrics: {
    en: "Children & baby doctor",
    fr: "Médecin pour enfants",
    ar: "طب الأطفال والرضع",
  },
  general: {
    en: "Family & general health",
    fr: "Médecin généraliste",
    ar: "الطب العام وفحوصات الأسرة",
  },
  family: {
    en: "Family & general health",
    fr: "Médecin de famille",
    ar: "طب الأسرة",
  },
  dermatology: {
    en: "Skin, hair & allergies",
    fr: "Peau, cheveux & allergies",
    ar: "الجلد والحساسية",
  },
  nursing: {
    en: "Nurse visit at home",
    fr: "Soin infirmier à domicile",
    ar: "تمريض منزلي فالدار",
  },
  infirmier: {
    en: "Nurse visit at home",
    fr: "Infirmier à domicile",
    ar: "ممرض(ة) للدار",
  },
  orthopedic: {
    en: "Bones, joints & back",
    fr: "Os, dos & articulations",
    ar: "العظام والظهر والمفاصل",
  },
  gynecolog: {
    en: "Women's health & pregnancy",
    fr: "Santé féminine & grossesse",
    ar: "طب النساء والتوليد",
  },
  ophthalmolog: {
    en: "Eyes & vision doctor",
    fr: "Médecin des yeux",
    ar: "طب العيون",
  },
  emergency: {
    en: "Urgent & emergency care",
    fr: "Soins d'urgence",
    ar: "العلاجات المستعجلة",
  },
  internal: {
    en: "Adult checkups & chronic illness",
    fr: "Médecine interne (adultes)",
    ar: "الطب الباطني والأمراض المزمنة",
  },
};

export function formatPlainSpecialty(
  specialty: string,
  locale: LocaleCode,
): string {
  const lower = specialty.toLowerCase();
  for (const [key, entry] of Object.entries(PLAIN_SPECIALTY_MAP)) {
    if (lower.includes(key)) {
      if (locale === "ar") return entry.ar;
      if (locale === "fr") return entry.fr;
      return entry.en;
    }
  }
  return specialty;
}

export function formatPlainBloodType(
  bloodType: BloodType,
  locale: LocaleCode,
): string {
  if (bloodType !== "UNKNOWN") return bloodType;
  if (locale === "ar") return "لا أعرف بعد";
  if (locale === "fr") return "Je ne sais pas encore";
  return "I don't know yet";
}

export function formatPlainLabStatus(
  status: string,
  locale: LocaleCode,
): string {
  const s = status.toUpperCase();
  if (s === "COMPLETED" || s === "RESULT_UPLOADED") {
    return locale === "ar"
      ? "النتيجة جاهزة"
      : locale === "fr"
        ? "Résultat prêt"
        : "Result Ready";
  }
  if (s === "IN_PROGRESS" || s === "COLLECTED" || s === "PROCESSING") {
    return locale === "ar"
      ? "قيد التحليل"
      : locale === "fr"
        ? "En cours d'analyse"
        : "In Progress";
  }
  if (s === "ORDERED" || s === "PENDING") {
    return locale === "ar"
      ? "بانتظار المختبر"
      : locale === "fr"
        ? "En attente du labo"
        : "Waiting for Lab";
  }
  return status;
}

export function formatPlainInsuranceStatus(
  status: string,
  locale: LocaleCode,
): string {
  const s = status.toUpperCase();
  if (s === "VERIFIED") {
    return locale === "ar" ? "مفعّلة" : locale === "fr" ? "Vérifiée" : "Verified";
  }
  if (s === "REJECTED") {
    return locale === "ar" ? "مرفوضة" : locale === "fr" ? "Refusée" : "Rejected";
  }
  return locale === "ar"
    ? "قيد التحقق"
    : locale === "fr"
      ? "En vérification"
      : "Under Review";
}

const COPY_EN: PatientUiCopy = {
  guestLabel: "Guest Care",
  fastBookHeaderCta: "1-Tap Fast Book Ride",
  reserveHeaderCta: "Reserve Visit Slot",
  signedOutNotice:
    "Signed out cleanly. Your saved doctors and local guest passes remain stored in this browser.",
  navItems: [
    { href: "#patient-guide", label: "Start Here", isCurrent: true },
    { href: "#patient-search", label: "Search Care" },
    { href: "/booking", label: "Book Visit" },
    { href: "/profiles", label: "Doctors & Clinics" },
    { href: "/pharmacy", label: "24/7 Pharmacy" },
    { href: "/map?layer=DRIVER", label: "Live Map" },
    { href: "#patient-records", label: "My Health Folder" },
  ],
  guideEyebrow: "Simple Start · No Medical Jargon",
  guideTitle: "What help do you need today?",
  guideSubtitle:
    "Tap the picture that matches what you need — no account required to find care, pharmacies, or call an ambulance.",
  guideCards: [
    {
      id: "doctor-visit",
      href: "/booking?provider=doctor&mode=IN_PERSON",
      badge: "Clinic or Video",
      badgeTone: "teal",
      title: "See a Doctor",
      description:
        "Choose a visit to the doctor's clinic workplace or talk face-to-face on video call.",
      ctaLabel: "Visit Workplace",
      secondaryHref: "/booking?provider=doctor&mode=TELEHEALTH",
      secondaryLabel: "Video Call",
      imageSrc: "/media/scenes/telehealth-video.webp",
      imageAlt: "Doctor smiling during a video consultation on tablet",
    },
    {
      id: "home-nurse",
      href: "/booking?provider=nurse",
      badge: "At Your Home",
      badgeTone: "emerald",
      title: "Nurse Visit at Home",
      description:
        "Need blood pressure checked, injections, or wound dressings at home? A licensed nurse comes to you.",
      ctaLabel: "Request Home Nurse",
      imageSrc: "/media/scenes/home-nursing-visit.webp",
      imageAlt: "Home nurse checking blood pressure with a patient at home",
    },
    {
      id: "pharmacy",
      href: "/pharmacy",
      badge: "Open 24/7 & Delivery",
      badgeTone: "amber",
      title: "Medicines & Pharmacy",
      description:
        "Find an open pharmacy nearby, order wellness products delivered home, or show your prescription QR.",
      ctaLabel: "Open Pharmacy",
      imageSrc: "/media/facilities/pharmacy-interior.webp",
      imageAlt: "Clean sunlit local pharmacy interior counter",
    },
    {
      id: "ambulance-map",
      href: "/map?layer=DRIVER",
      badge: "Urgent · Emergency",
      badgeTone: "red",
      title: "Ambulance & Open Clinics Map",
      description:
        "See ambulances, hospitals, and labs moving on the street map right now, or call emergency 141.",
      ctaLabel: "Open Live Map",
      imageSrc: "/media/vehicles/ambulance-van.webp",
      imageAlt: "Medical emergency ambulance outside hospital bay",
      isEmergency: true,
    },
  ],
  searchHeading: "Search in Your Own Words",
  searchSubheading:
    "Type a symptom, doctor type, medicine, neighborhood, or hospital — or tap one quick button.",
  searchAriaLabel: "Search doctors, ambulances, clinics, pharmacies, or services",
  searchPlaceholder:
    "Try: fever, heart doctor, nurse at home, open pharmacy, ambulance 141...",
  clearSearchLabel: "Clear care search",
  popularLabel: "Common needs:",
  noResultsPrefix: "Nothing matched",
  resetSearchLabel: "Show All Options",
  allSpecialtiesLabel: "All Specialties",
  specialtyFilterLabel: "Doctor Specialty",
  filterTabs: [
    { value: "ALL", label: "Everything" },
    { value: "DOCTOR", label: "Doctors & Home Nurses" },
    { value: "PHARMACY_LAB", label: "Pharmacies & Blood Tests" },
    { value: "CARE_CENTER", label: "Clinics & Hospitals" },
    { value: "DRIVER", label: "Ambulances" },
  ],
  quickChips: [
    { label: "Ambulance 141", query: "Ambulance 141" },
    { label: "Heart & Blood Pressure", query: "Cardiology" },
    { label: "24/7 Pharmacy", query: "24/7 Pharmacy" },
    { label: "Home Nurse", query: "Home Nurse" },
    { label: "Blood Test & X-Ray", query: "Diagnostic Lab" },
  ],
  nearbyTitle: "Verified Care Ready Near You",
  nearbySubtitle:
    "Real photos, plain specialties, and open hours before you tap.",
  nearbyBrowseAll: "See Everyone",
  bookNowLabel: "Book Visit",
  visitWorkplaceLabel: "Visit Workplace",
  videoCallLabel: "Video Call",
  requestNurseLabel: "Ask to Come Home",
  openPharmacyLabel: "Order Here",
  seeOnMapLabel: "See on Map",
  openNowLabel: "Open Now",
  activityTitle: "Your Upcoming Visits & Ambulance Tracking",
  activityEmptyTitle: "You have no scheduled visits or active rides yet.",
  activityEmptyHint:
    "As soon as you book a doctor or request an ambulance, your live arrival countdown and map link appear here.",
  trackedWord: "active",
  savedWord: "saved",
  reserveVisitCta: "Reserve Visit",
  openMapCta: "Open Live Map",
  savedTitle: "Saved Doctors & Pharmacies",
  savedEmptyTitle: "No saved doctors or clinics yet.",
  savedEmptyHint:
    "Tap the star button on any doctor, nurse, or pharmacy to keep them in one quick list.",
  browseDoctorsCta: "Browse Public Profiles",
  exploreMapCta: "Explore Live Map",
  medicalPickupTitle: "Medical Pickup Request",
  trackDriverCta: "Track Live Driver on Map →",
  joinVideoCallCta: "Join Video Call",
  openItemCta: "Open",
  removePassAriaPrefix: "Remove tracking pass",
  healthFolderTitle: "Your Personal Health Folder",
  healthFolderSubtitle:
    "Your prescriptions, lab results, blood type & insurance card kept private in one safe place.",
  signedInBadgePrefix: "Private Folder ·",
  lockedBadge: "Private & Password Protected",
  lockedHeading: "Your private clinical documents stay protected",
  lockedDescription:
    "You do not need an account to browse doctors, pharmacies, or call an ambulance. Sign in whenever you want to keep your papers safe here:",
  lockedUnlockCta: "Open Clinical Documents",
  lockedPreviews: [
    {
      title: "Medicine Prescriptions (QR)",
      detail: "Show your phone barcode at the pharmacy instead of paper.",
      imageSrc: "/media/icons/icon-pharmacy.webp",
      imageAlt: "Medicine bottle and capsule icon",
    },
    {
      title: "Blood Tests & X-Ray Results",
      detail: "Open PDF reports and X-ray photos as soon as the lab finishes.",
      imageSrc: "/media/icons/icon-diagnostics.webp",
      imageAlt: "Laboratory microscope icon",
    },
    {
      title: "Blood Type, Allergies & Insurance",
      detail: "Keep your CNSS / CNOPS card and allergies ready for doctors.",
      imageSrc: "/media/icons/icon-ehr.webp",
      imageAlt: "Protected health notebook icon",
    },
  ],
  apiOfflineText:
    "We cannot load your saved health files right now because the connection paused. Please try again in a few seconds.",
  loadingRecordsText:
    "Opening your prescriptions, lab results, and doctor notes...",
  rxHeading: "Your Medicine Prescriptions",
  rxHint: "Tap the QR square to make it big so the pharmacist can scan it.",
  rxEmpty: "No doctor prescriptions here yet.",
  scansHeading: "Uploaded X-Rays & PDF Test Reports",
  scansEmpty: "No X-ray photos or lab PDFs uploaded yet.",
  inspectPhotoLabel: "View Photo",
  openDocumentLabel: "Open PDF",
  notesHeading: "What Your Doctors Wrote",
  notesEmpty: "No consultation notes from a doctor yet.",
  noteFoundLabel: "What the doctor found:",
  noteNextStepsLabel: "Treatment & next steps:",
  labsHeading: "Blood Tests & Lab Checks",
  labsEmpty: "No lab tests ordered yet.",
  safetyTitle: "Emergency Info Card",
  safetySubtitle:
    "Paramedics and doctors check this first if you ever need urgent help.",
  bloodGroupLabel: "Blood Group",
  bloodTypeBadgePrefix: "Blood Type:",
  emergencyNameLabel: "Who to call in emergency",
  emergencyNamePlaceholder: "Mother, brother, spouse name...",
  emergencyPhoneLabel: "Their phone number",
  allergiesHeading: "Food or Medicines You Are Allergic To",
  allergiesEmpty: "No allergies added yet.",
  allergenPlaceholder: "Add allergen (e.g. Penicillin, Peanuts)",
  addAllergenLabel: "Add",
  chronicLabel: "Long-term health conditions (if any, comma-separated)",
  chronicPlaceholder: "Example: Asthma, Diabetes, High blood pressure",
  saveSafetyCta: "Save Safety Profile",
  savingCta: "Saving...",
  safetySavedToast:
    "Emergency Safety Profile updated for attending clinicians and dispatchers.",
  insuranceTitle: "Health Insurance & Mutuelle Cards",
  insuranceSubtitle:
    "Add your CNSS, CNOPS, or private mutuelle once to speed up clinic and pharmacy coverage.",
  insuranceEmpty:
    "No insurance cards added yet. Tap one option below or type your card details.",
  addInsuranceHeading: "Add Your Insurance Card",
  quickFillLabel: "Tap to auto-fill:",
  insurerPlaceholder: "Insurer (e.g. CNOPS, CNSS, AXA)",
  policyPlaceholder: "Policy Number",
  memberIdPlaceholder: "Member / CIN Number",
  planPlaceholder: "Plan (CNSS / AMO / VIP)",
  percentLabel: "Covered %",
  saveInsuranceCta: "Link Insurance Policy",
  savingInsuranceCta: "Saving Card...",
};

const COPY_FR: PatientUiCopy = {
  guestLabel: "Accès Invité",
  fastBookHeaderCta: "Appel Ambulance Rapide",
  reserveHeaderCta: "Prendre Rendez-vous",
  signedOutNotice:
    "Déconnexion réussie. Vos favoris et suivis restent enregistrés sur cet appareil.",
  navItems: [
    { href: "#patient-guide", label: "Démarrer Ici", isCurrent: true },
    { href: "#patient-search", label: "Rechercher" },
    { href: "/booking", label: "Rendez-vous" },
    { href: "/profiles", label: "Médecins & Cliniques" },
    { href: "/pharmacy", label: "Pharmacie 24/7" },
    { href: "/map?layer=DRIVER", label: "Carte en Direct" },
    { href: "#patient-records", label: "Mon Dossier Santé" },
  ],
  guideEyebrow: "Guide Simple · Sans Jargon Médical",
  guideTitle: "De quoi avez-vous besoin aujourd'hui ?",
  guideSubtitle:
    "Appuyez simplement sur l'image qui correspond à votre situation — aucune connaissance médicale requise.",
  guideCards: [
    {
      id: "doctor-visit",
      href: "/booking?provider=doctor&mode=IN_PERSON",
      badge: "Cabinet ou Vidéo",
      badgeTone: "teal",
      title: "Voir un Médecin",
      description:
        "Prenez rendez-vous au cabinet du médecin ou discutez par appel vidéo depuis chez vous.",
      ctaLabel: "Au Cabinet",
      secondaryHref: "/booking?provider=doctor&mode=TELEHEALTH",
      secondaryLabel: "Appel Vidéo",
      imageSrc: "/media/scenes/telehealth-video.webp",
      imageAlt: "Médecin souriant en consultation vidéo sur tablette",
    },
    {
      id: "home-nurse",
      href: "/booking?provider=nurse",
      badge: "À Domicile",
      badgeTone: "emerald",
      title: "Infirmier à la Maison",
      description:
        "Besoin d'une piqûre, d'un pansement ou de prendre la tension chez vous ? Un infirmier se déplace.",
      ctaLabel: "Demander un Infirmier",
      imageSrc: "/media/scenes/home-nursing-visit.webp",
      imageAlt: "Infirmière prenant la tension d'une patiente à domicile",
    },
    {
      id: "pharmacy",
      href: "/pharmacy",
      badge: "Ouverte 24/7 & Livraison",
      badgeTone: "amber",
      title: "Médicaments & Pharmacie",
      description:
        "Trouvez une pharmacie ouverte, commandez des soins livrés chez vous ou présentez votre ordonnance QR.",
      ctaLabel: "Ouvrir la Pharmacie",
      imageSrc: "/media/facilities/pharmacy-interior.webp",
      imageAlt: "Comptoir lumineux d'une pharmacie agréée",
    },
    {
      id: "ambulance-map",
      href: "/map?layer=DRIVER",
      badge: "Urgence",
      badgeTone: "red",
      title: "Ambulance & Carte des Soins",
      description:
        "Voyez les ambulances, hôpitaux et laboratoires ouverts autour de vous en direct, ou appelez le 141.",
      ctaLabel: "Ouvrir la Carte",
      imageSrc: "/media/vehicles/ambulance-van.webp",
      imageAlt: "Ambulance médicale devant les urgences",
      isEmergency: true,
    },
  ],
  searchHeading: "Recherchez avec vos propres mots",
  searchSubheading:
    "Tapez ce que vous ressentez, un quartier, un médicament ou appuyez sur un raccourci.",
  searchAriaLabel: "Rechercher médecins, ambulances, cliniques, pharmacies ou services",
  searchPlaceholder:
    "Ex : fièvre, cœur, infirmier à domicile, pharmacie ouverte, ambulance 141...",
  clearSearchLabel: "Effacer la recherche",
  popularLabel: "Besoins fréquents :",
  noResultsPrefix: "Aucun résultat pour",
  resetSearchLabel: "Tout réafficher",
  allSpecialtiesLabel: "Toutes spécialités",
  specialtyFilterLabel: "Spécialité du médecin",
  filterTabs: [
    { value: "ALL", label: "Tout" },
    { value: "DOCTOR", label: "Médecins & Infirmiers" },
    { value: "PHARMACY_LAB", label: "Pharmacies & Analyses" },
    { value: "CARE_CENTER", label: "Cliniques & Hôpitaux" },
    { value: "DRIVER", label: "Ambulances" },
  ],
  quickChips: [
    { label: "Ambulance 141", query: "Ambulance" },
    { label: "Cœur & Tension", query: "Cardiology" },
    { label: "Pharmacie 24/7", query: "Pharmacy" },
    { label: "Infirmier Maison", query: "Home Nurse" },
    { label: "Analyses & Radio", query: "Diagnostic Lab" },
  ],
  nearbyTitle: "Professionnels & Centres Prêts Près de Vous",
  nearbySubtitle:
    "Photos réelles et explications claires en un coup d'œil.",
  nearbyBrowseAll: "Voir tout l'annuaire",
  bookNowLabel: "Réserver",
  visitWorkplaceLabel: "Au Cabinet",
  videoCallLabel: "Appel Vidéo",
  requestNurseLabel: "Visite Maison",
  openPharmacyLabel: "Commander",
  seeOnMapLabel: "Sur la Carte",
  openNowLabel: "Ouvert",
  activityTitle: "Vos Prochains Rendez-vous & Suivi Ambulance",
  activityEmptyTitle: "Aucun rendez-vous ou trajet en cours pour le moment.",
  activityEmptyHint:
    "Dès que vous réservez un médecin ou appelez une ambulance, le suivi en direct apparaît ici.",
  trackedWord: "en cours",
  savedWord: "favoris",
  reserveVisitCta: "Prendre RDV",
  openMapCta: "Ouvrir la Carte",
  savedTitle: "Vos Médecins & Pharmacies Favoris",
  savedEmptyTitle: "Aucun favori enregistré pour l'instant.",
  savedEmptyHint:
    "Appuyez sur l'étoile d'un médecin ou d'une clinique pour le retrouver ici en 1 clic.",
  browseDoctorsCta: "Voir les Profils",
  exploreMapCta: "Explorer la Carte",
  medicalPickupTitle: "Demande de Transport Médical",
  trackDriverCta: "Suivre le Chauffeur sur la Carte →",
  joinVideoCallCta: "Rejoindre l'appel vidéo",
  openItemCta: "Ouvrir",
  removePassAriaPrefix: "Supprimer le suivi",
  healthFolderTitle: "Votre Dossier Santé Personnel",
  healthFolderSubtitle:
    "Ordonnances, analyses, groupe sanguin et mutuelle réunis en toute confidentialité.",
  signedInBadgePrefix: "Dossier Privé ·",
  lockedBadge: "Protégé par Mot de Passe",
  lockedHeading: "Vos documents médicaux restent protégés",
  lockedDescription:
    "Pas besoin de compte pour chercher un médecin ou appeler une ambulance. Connectez-vous pour garder vos documents ici :",
  lockedUnlockCta: "Ouvrir Mon Dossier Santé",
  lockedPreviews: [
    {
      title: "Ordonnances par Code QR",
      detail: "Montrez votre téléphone en pharmacie au lieu du papier.",
      imageSrc: "/media/icons/icon-pharmacy.webp",
      imageAlt: "Icône médicaments",
    },
    {
      title: "Analyses de Sang & Radios",
      detail: "Consultez vos PDF et imageries dès que le labo termine.",
      imageSrc: "/media/icons/icon-diagnostics.webp",
      imageAlt: "Icône laboratoire",
    },
    {
      title: "Groupe Sanguin, Allergies & Mutuelle",
      detail: "Gardez votre carte CNSS / CNOPS prête pour les urgences.",
      imageSrc: "/media/icons/icon-ehr.webp",
      imageAlt: "Icône carnet santé",
    },
  ],
  apiOfflineText:
    "Impossible de charger vos dossiers pour l'instant. Réessayez dans un instant.",
  loadingRecordsText:
    "Ouverture de vos ordonnances, analyses et comptes-rendus...",
  rxHeading: "Vos Ordonnances de Médicaments",
  rxHint: "Touchez le carré QR pour l'agrandir devant le pharmacien.",
  rxEmpty: "Aucune ordonnance enregistrée pour le moment.",
  scansHeading: "Radios & Résultats PDF Reçus",
  scansEmpty: "Aucun examen ou fichier PDF reçu pour le moment.",
  inspectPhotoLabel: "Voir l'image",
  openDocumentLabel: "Ouvrir le PDF",
  notesHeading: "Ce que le Médecin a Noté",
  notesEmpty: "Aucune note de consultation pour le moment.",
  noteFoundLabel: "Ce que le médecin a constaté :",
  noteNextStepsLabel: "Traitement et étapes suivantes :",
  labsHeading: "Analyses & Bilans Demandés",
  labsEmpty: "Aucune analyse demandée pour le moment.",
  safetyTitle: "Fiche d'Urgence Médicale",
  safetySubtitle:
    "Les secours et médecins consultent ceci en premier en cas de besoin urgent.",
  bloodGroupLabel: "Groupe sanguin",
  bloodTypeBadgePrefix: "Groupe :",
  emergencyNameLabel: "Personne à prévenir en urgence",
  emergencyNamePlaceholder: "Nom du parent, conjoint, proche...",
  emergencyPhoneLabel: "Téléphone d'urgence",
  allergiesHeading: "Allergies (Médicaments ou Aliments)",
  allergiesEmpty: "Aucune allergie indiquée.",
  allergenPlaceholder: "Ajouter une allergie (ex: Pénicilline, Arachides)",
  addAllergenLabel: "Ajouter",
  chronicLabel: "Maladies suivies régulièrement (séparées par virgule)",
  chronicPlaceholder: "Exemple : Asthme, Diabète, Hypertension",
  saveSafetyCta: "Enregistrer la Fiche Urgence",
  savingCta: "Enregistrement...",
  safetySavedToast:
    "Fiche d'urgence mise à jour pour vos médecins et les secours.",
  insuranceTitle: "Cartes Mutuelle & Assurance",
  insuranceSubtitle:
    "Enregistrez votre CNSS, CNOPS ou mutuelle une seule fois pour simplifier vos remboursements.",
  insuranceEmpty:
    "Aucune carte ajoutée. Appuyez sur un organisme ci-dessous ou saisissez le vôtre.",
  addInsuranceHeading: "Ajouter une Carte Mutuelle / Assurance",
  quickFillLabel: "Remplissage rapide :",
  insurerPlaceholder: "Organisme (ex: CNOPS, CNSS, AXA)",
  policyPlaceholder: "N° de Police",
  memberIdPlaceholder: "N° d'Immatriculation / CIN",
  planPlaceholder: "Régime (CNSS / AMO)",
  percentLabel: "Couverture %",
  saveInsuranceCta: "Enregistrer la Carte",
  savingInsuranceCta: "Enregistrement...",
};

const COPY_AR: PatientUiCopy = {
  guestLabel: "تصفح بلا حساب",
  fastBookHeaderCta: "طلب إسعاف سريع",
  reserveHeaderCta: "حجز موعد طبيب",
  signedOutNotice:
    "تم تسجيل الخروج بنجاح. الأطباء المفضلين وبطاقات التتبع بقاو محفوظين عندك.",
  navItems: [
    { href: "#patient-guide", label: "ابدا من هنا", isCurrent: true },
    { href: "#patient-search", label: "بحث سريع" },
    { href: "/booking", label: "حجز موعد" },
    { href: "/profiles", label: "الأطباء والعيادات" },
    { href: "/pharmacy", label: "صيدلية 24/7" },
    { href: "/map?layer=DRIVER", label: "الخريطة المباشرة" },
    { href: "#patient-records", label: "ملفي الصحي" },
  ],
  guideEyebrow: "شرح مبسط · بلا مصطلحات صعيبة",
  guideTitle: "شنو كتحتاج اليوم؟ اختار الصورة المناسبة",
  guideSubtitle:
    "برّك على الصورة لي كتناسب حالتك دابا — ما كاين لا تعقيد لا كلمات طبية صعيبة، وما تحتاجش حساب باش تقلّب.",
  guideCards: [
    {
      id: "doctor-visit",
      href: "/booking?provider=doctor&mode=IN_PERSON",
      badge: "فالعيادة أو فيديو",
      badgeTone: "teal",
      title: "ندوز عند طبيب",
      description:
        "اختار تمشي عند الطبيب لمركز العمل ديالو فالعيادة أو تهضر معاه مباشرة فمكالمة فيديو من الدار.",
      ctaLabel: "زيارة فالعيادة",
      secondaryHref: "/booking?provider=doctor&mode=TELEHEALTH",
      secondaryLabel: "مكالمة فيديو",
      imageSrc: "/media/scenes/telehealth-video.webp",
      imageAlt: "طبيبة تتحدث مع مريض عبر استشارة فيديو",
    },
    {
      id: "home-nurse",
      href: "/booking?provider=nurse",
      badge: "كيجيك حتى للدار",
      badgeTone: "emerald",
      title: "ممرض(ة) يجي للدار",
      description:
        "محتاج شوكة، تبدال الفاصمة، أو قياس الطونسيو بلا ما تخرج؟ كيجيك ممرض مرخّص للبيت.",
      ctaLabel: "طلب ممرض للدار",
      imageSrc: "/media/scenes/home-nursing-visit.webp",
      imageAlt: "ممرضة تقيس ضغط الدم لمريضة في المنزل",
    },
    {
      id: "pharmacy",
      href: "/pharmacy",
      badge: "مفتوحة 24/7 وتوصيل",
      badgeTone: "amber",
      title: "الأدوية والصيدلية",
      description:
        "لقى أقرب صيدلية حراسة مفتوحة، اطلب الأدوية والمكملات للدار، أو صرّف الوصفة برمز QR.",
      ctaLabel: "فتح الصيدلية",
      imageSrc: "/media/facilities/pharmacy-interior.webp",
      imageAlt: "صيدلية نظيفة ومضيئة",
    },
    {
      id: "ambulance-map",
      href: "/map?layer=DRIVER",
      badge: "حالة مستعجلة",
      badgeTone: "red",
      title: "إسعاف وخريطة المستشفيات",
      description:
        "شوف سيارات الإسعاف والمستشفيات ومختبرات التحاليل القريبة ليك مباشرة على الخريطة أو عيّط لـ 141.",
      ctaLabel: "فتح الخريطة المباشرة",
      imageSrc: "/media/vehicles/ambulance-van.webp",
      imageAlt: "سيارة إسعاف مجهزة أمام قسم الطوارئ",
      isEmergency: true,
    },
  ],
  searchHeading: "قلّب بكلماتك العادية",
  searchSubheading:
    "اكتب باش كتحس (مثلا: سخانة، قلب، دواء) أو اسم الحي أو برّك على اختيار جاهز لتحت.",
  searchAriaLabel: "البحث عن الأطباء وسيارات الإسعاف والعيادات والصيدليات",
  searchPlaceholder:
    "مثال: طبيب القلب، سخانة، ممرض للدار، صيدلية مفتوحة، إسعاف 141...",
  clearSearchLabel: "مسح البحث",
  popularLabel: "اختيارات سريعة:",
  noResultsPrefix: "ما لقيناش نتيجة لـ",
  resetSearchLabel: "إرجاع كلشي",
  allSpecialtiesLabel: "كل التخصصات",
  specialtyFilterLabel: "تخصص الطبيب",
  filterTabs: [
    { value: "ALL", label: "كلشي" },
    { value: "DOCTOR", label: "أطباء وممرضين" },
    { value: "PHARMACY_LAB", label: "صيدليات وتحاليل" },
    { value: "CARE_CENTER", label: "عيادات ومستشفيات" },
    { value: "DRIVER", label: "سيارات الإسعاف" },
  ],
  quickChips: [
    { label: "إسعاف 141", query: "Ambulance" },
    { label: "القلب والطونسيو", query: "Cardiology" },
    { label: "صيدلية 24/7", query: "Pharmacy" },
    { label: "ممرض للدار", query: "Home Nurse" },
    { label: "تحاليل وراديو", query: "Diagnostic Lab" },
  ],
  nearbyTitle: "أطباء ومراكز متاحين قريب ليك",
  nearbySubtitle:
    "شوف الصورة والتخصص المفهوم والحالة واش مفتوح دابا قبل ما تحجز.",
  nearbyBrowseAll: "شوف الجميع",
  bookNowLabel: "احجز دابا",
  visitWorkplaceLabel: "زيارة فالعيادة",
  videoCallLabel: "مكالمة فيديو",
  requestNurseLabel: "طلب للدار",
  openPharmacyLabel: "طلب دواء",
  seeOnMapLabel: "على الخريطة",
  openNowLabel: "مفتوح دابا",
  activityTitle: "مواعيدك الجاية وتتبع الإسعاف",
  activityEmptyTitle: "ما عندك حتى موعد ولا طلب إسعاف حاليا.",
  activityEmptyHint:
    "غير تحجز مع شي طبيب أو تطلب سيارة إسعاف غيبان هنا الوقت المتبقي ورابط التتبع المباشر.",
  trackedWord: "نشط",
  savedWord: "محفوظ",
  reserveVisitCta: "حجز موعد",
  openMapCta: "فتح الخريطة",
  savedTitle: "الأطباء والصيدليات المفضلين",
  savedEmptyTitle: "مازال ما حفظتي حتى طبيب أو عيادة.",
  savedEmptyHint:
    "برّك على النجمة حدا أي طبيب أو صيدلية باش تلقاه هنا بالزربة وقت ما احتاجيتيه.",
  browseDoctorsCta: "تصفح الأطباء",
  exploreMapCta: "استكشف الخريطة",
  medicalPickupTitle: "طلب نقل طبي / إسعاف",
  trackDriverCta: "تتبع السائق مباشرة على الخريطة ←",
  joinVideoCallCta: "دخول لمكالمة الفيديو",
  openItemCta: "فتح",
  removePassAriaPrefix: "إزالة التتبع",
  healthFolderTitle: "ملفك الصحي الشخصي (أوراقك الطبية)",
  healthFolderSubtitle:
    "وصفات الدواء، نتائج التحاليل، فصيلة الدم ولاكارط ديال التأمين محفوظين بأمان ليك بوحدك.",
  signedInBadgePrefix: "ملف محمي ·",
  lockedBadge: "سري ومقفول لحماية خصوصيتك",
  lockedHeading: "أوراقك الطبية الشخصية محمية بالسر التام",
  lockedDescription:
    "ما تحتاجش حساب باش تقلّب على طبيب أو صيدلية أو تطلب إسعاف. سجّل الدخول غير وقت ما بغيتي تشوف وتجمع وثائقك هنا:",
  lockedUnlockCta: "افتح ملفي الصحي",
  lockedPreviews: [
    {
      title: "وصفات الدواء (QR)",
      detail: "ورّي غير الكود للصيدلي فالتيليفون بلا ما توضّر الورقة.",
      imageSrc: "/media/icons/icon-pharmacy.webp",
      imageAlt: "أيقونة الأدوية",
    },
    {
      title: "التحاليل والأشعة (الراديو)",
      detail: "شوف وتيليشارجي نتائج الدم والراديو غير يكملهم المختبر.",
      imageSrc: "/media/icons/icon-diagnostics.webp",
      imageAlt: "أيقونة المختبر",
    },
    {
      title: "فصيلة الدم، الحساسية والتأمين",
      detail: "خلي لاكارط CNSS / CNOPS ومعلومات الطوارئ واجدين ديما.",
      imageSrc: "/media/icons/icon-ehr.webp",
      imageAlt: "أيقونة الملف الصحي",
    },
  ],
  apiOfflineText:
    "تعذّر تحميل الملف الصحي دابا بسباب انقطاع مؤقت فالربط. عاود حاول بعد لحظات.",
  loadingRecordsText: "كنفتحو وصفات الدواء ونتائج التحاليل وملاحظات الأطباء...",
  rxHeading: "وصفات الدواء من عند الطبيب",
  rxHint: "برّك على المربع ديال QR باش يكبار ويقراه الصيدلي بسهولة.",
  rxEmpty: "ما كاين حتى وصفة دواء حاليا.",
  scansHeading: "صور الراديو وملفات PDF",
  scansEmpty: "ما كاين حتى صورة راديو أو PDF مرفوع حاليا.",
  inspectPhotoLabel: "تكبير الصورة",
  openDocumentLabel: "فتح الملف",
  notesHeading: "كلام وملاحظات الطبيب",
  notesEmpty: "ما كاين حتى ملاحظة استشارة مسجلة دابا.",
  noteFoundLabel: "شنو لقى الطبيب:",
  noteNextStepsLabel: "العلاج والخطوات الجاية:",
  labsHeading: "تحاليل المختبر المطلوبة",
  labsEmpty: "ما كاين حتى طلب تحاليل حاليا.",
  safetyTitle: "بطاقة الطوارئ الصحية",
  safetySubtitle:
    "أول حاجة كيشوفها الطبيب أو الإسعاف إلا وقعت شي حالة مستعجلة لا قدّر الله.",
  bloodGroupLabel: "فصيلة الدم",
  bloodTypeBadgePrefix: "فصيلة الدم:",
  emergencyNameLabel: "شكون نعيّطو ليه فالطوارئ",
  emergencyNamePlaceholder: "اسم الأم، الأخ، الزوج(ة)...",
  emergencyPhoneLabel: "رقم الهاتف ديالو",
  allergiesHeading: "الحساسية من شي دواء أو ماكلة",
  allergiesEmpty: "ما مسجّل حتى حساسية دابا.",
  allergenPlaceholder: "اكتب اسم الحساسية (مثلا: البنسلين، كاوكاو)",
  addAllergenLabel: "إضافة",
  chronicLabel: "الأمراض المزمنة إلا كانت (افصل بينها بفاصلة)",
  chronicPlaceholder: "مثال: الضيقة (الربو)، السكري، الطونسيو",
  saveSafetyCta: "حفظ معلومات الطوارئ",
  savingCta: "جاري الحفظ...",
  safetySavedToast: "تم حفظ بطاقة الطوارئ بنجاح للأطباء والإسعاف.",
  insuranceTitle: "بطاقات التأمين الصحي والتغطية (Mutuelle)",
  insuranceSubtitle:
    "سجّل رقم CNSS أو CNOPS أو التأمين الخاص مرة وحدة باش يسهل التعويض فالعيادة والصيدلية.",
  insuranceEmpty:
    "مازال ما ربطتي حتى بطاقة تأمين. اختار الشركة لتحت أو عمر المعلومات بيديك.",
  addInsuranceHeading: "إضافة بطاقة تأمين جديدة",
  quickFillLabel: "اختار بسرعة:",
  insurerPlaceholder: "اسم التأمين (مثلا: CNOPS، CNSS، AXA)",
  policyPlaceholder: "رقم العقد / البوليصة",
  memberIdPlaceholder: "رقم التسجيل أو لاكارط",
  planPlaceholder: "النظام (AMO / تكميلي)",
  percentLabel: "نسبة التغطية %",
  saveInsuranceCta: "ربط بطاقة التأمين",
  savingInsuranceCta: "جاري الحفظ...",
};

export function getPatientUiCopy(locale: LocaleCode): PatientUiCopy {
  if (locale === "ar") return COPY_AR;
  if (locale === "fr") return COPY_FR;
  return COPY_EN;
}
