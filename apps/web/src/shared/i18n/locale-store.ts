"use client";

import { useEffect, useSyncExternalStore } from "react";
import type { LocaleCode } from "@medisync/contracts";

const LOCALE_STORAGE_KEY = "medisync.locale.v1";
const LOCALE_EVENT = "medisync:locale-change";

let currentLocaleCache: LocaleCode = "en";
let initializedFromStorage = false;

const TRANSLATIONS: Record<LocaleCode, Record<string, string>> = {
  en: {
    "menu.open": "Open navigation and language menu",
    "menu.close": "Close menu",
    "menu.title": "Menu",
    "menu.navigation": "Explore Care",
    "menu.sectionCare": "Care & Services",
    "menu.sectionAccount": "Account & Directory",
    "menu.language": "Language",
    "menu.guestTitle": "MediSync Account",
    "menu.guestSubtitle": "Sign in to manage bookings & Rx",
    "menu.signInCta": "Sign in",
    "menu.manageAccount": "Profile & security",
    "menu.staffPending": "Pending review",
    "menu.partnerTitle": "Medical Staff & Partners",
    "menu.partnerSubtitle": "Doctors, nurses, drivers, labs",
    "menu.signOutStaff": "Sign Out of Staff Session",
    "nav.overview": "Overview",
    "nav.patient": "My Care",
    "nav.profiles": "Profiles",

    // Patient Care Hub (/patient)
    "patient.heading": "Find Care, Track Visits & Open the Live Map",
    "nav.map": "Live Map",
    "nav.driver": "Driver Workspace",
    "nav.booking": "Booking",
    "nav.clinical": "Physician Suite",
    "nav.nurse": "Nursing Station",
    "nav.hospital": "Hospital & Clinic",
    "nav.lab": "Lab Workbench",
    "nurse.heading": "Nursing & Home Care Station",
    "nav.pharmacy": "Pharmacy",
    "nav.admin": "Admin",
    "nav.portal": "Patient Sign In",
    "nav.pro": "MediSync Pro",
    "nav.profile": "My Profile",
    "navSub./": "Network hub & emergency numbers",
    "navSub./patient": "Visits, dispatch & records",
    "navSub./profiles": "Doctors, clinics & fleet",
    "navSub./profile": "Details, credentials & security",
    "navSub./map": "Hospitals & live transport",
    "navSub./driver": "Active dispatches & GPS relay",
    "navSub./booking": "Clinic or home visit booking",
    "navSub./clinical": "Consultations, e-Rx & charts",
    "navSub./nurse": "Vitals, rounds & care notes",
    "navSub./hospital": "Capacity, reception & billing",
    "navSub./lab": "Diagnostic orders & results",
    "navSub./pharmacy": "Medications, Rx QR & delivery",
    "navSub./admin": "Verification & compliance",
    "navSub./portal": "Patient & family sign-in",
    "navSub./pro": "Staff, clinics, labs & fleet",

    // Profiles Directory (/profiles)
    "profiles.heading": "Care Providers, Clinics, Hospitals & Transport Units",

    // Home Overview & Quick Care Launchpad
    "home.eyebrow": "Morocco Care Network",
    "home.title": "Global medical coordination.",
    "home.subtitle":
      "Verified clinics, QR prescriptions, and live emergency transport in one network.",
    "home.ctaFindCare": "Find Care on Map",
    "home.ctaBookDoctor": "Book a Doctor",
    "country.eyebrow": "Regional Standards",
    "country.activePrefix": "Care Region",

    // Portal (/portal), Pro (/pro) & Profile (/profile)
    "portal.heading": "Patient & Family Sign In",
    "pro.heading": "MediSync Pro — Staff & Partner Portal",
    "profile.heading": "My Profile & Account",
    "portal.recoveryTab": "Verify & Reset",
    "portal.uploadCredential": "Upload & Verify Credential",
    "portal.facilityRegistry": "Verified Care Facilities",

    // Map (/map)
    "map.heading": "Live Medical Map & Dispatch Console",
    "map.openNowOnly": "Open Now Only",
    "map.facilitiesFound": "Medical Centers",
    "map.activeUnits": "Active Units",
    "map.driverBeaconTitle": "Ambulance Location Sharing",
    "map.emptyOverlay":
      "Pan or zoom to view verified hospitals, clinics, pharmacies, and labs.",

    // Booking (/booking)
    "booking.heading": "Doctor Appointments & Clinic Hours",

    // Clinical (/clinical)
    "clinical.heading": "Clinical Care, QR E-Prescriptions & Diagnostic Labs",
    "clinical.tabDoctor": "Consultation & E-Rx",
    "clinical.tabCalendar": "Clients & Calendar",
    "clinical.tabSchedule": "Clinic Shifts",
    "clinical.tabLabs": "Diagnostic Labs & Scans",
    "clinical.saveNote": "Save Consultation Note",
    "clinical.issueRx": "Issue QR Prescription",
    "clinical.uploadScanBtn": "Upload Diagnostic File",
    "clinical.labsHeading": "Diagnostic Lab Orders & Report Upload",
    "lab.heading": "Diagnostic Lab Queue & Encrypted Scans",
    "hospital.heading": "Facility Readiness, Reception & Incoming EMS",

    // Pharmacy (/pharmacy)
    "pharma.heading": "Online Pharmacy Catalog & Courier Checkout",
    "pharma.searchPlaceholder": "Search medications or active ingredients...",
    "pharma.addToCart": "Add to Cart",
    "pharma.cartTitle": "Shopping Cart & Checkout",
    "pharma.placeOrder": "Place Order & Pay Now",
    "pharma.emptyCart": "Add OTC or Rx items from the catalog to check out.",
    "pharma.ordersTitle": "Orders & Printable Receipts",

    // Admin (/admin)
    "admin.heading": "Master Operations & Compliance Center",
  },
  fr: {
    "menu.open": "Ouvrir le menu et les langues",
    "menu.close": "Fermer le menu",
    "menu.title": "Menu",
    "menu.navigation": "Services de soins",
    "menu.sectionCare": "Soins & Services",
    "menu.sectionAccount": "Compte & Annuaire",
    "menu.language": "Langue",
    "menu.guestTitle": "Compte MediSync",
    "menu.guestSubtitle": "Connectez-vous pour gérer vos soins",
    "menu.signInCta": "Connexion",
    "menu.manageAccount": "Profil et sécurité",
    "menu.staffPending": "En attente",
    "menu.partnerTitle": "Personnel Médical & Partenaires",
    "menu.partnerSubtitle": "Médecins, infirmiers, chauffeurs, labos",
    "menu.signOutStaff": "Fermer la session pro",
    "nav.overview": "Aperçu",
    "nav.patient": "Mon Espace Soins",
    "nav.profiles": "Profils",

    // Patient Care Hub (/patient)
    "patient.heading": "Trouvez un Soin, Suivez vos Visites & Carte en Direct",
    "nav.map": "Carte Live",
    "nav.driver": "Espace Chauffeur",
    "nav.booking": "Rendez-vous",
    "nav.clinical": "Espace Médecin",
    "nav.nurse": "Poste Infirmier",
    "nav.hospital": "Hôpital & Clinique",
    "nav.lab": "Laboratoire",
    "nurse.heading": "Poste Infirmier & Soins à Domicile",
    "nav.pharmacy": "Pharmacie",
    "nav.admin": "Admin",
    "nav.portal": "Espace Patient",
    "nav.pro": "MediSync Pro",
    "nav.profile": "Mon Profil",
    "navSub./": "Réseau et numéros d'urgence",
    "navSub./patient": "Visites, suivi et dossier",
    "navSub./profiles": "Médecins, cliniques et flotte",
    "navSub./profile": "Coordonnées, justificatifs et sécurité",
    "navSub./map": "Hôpitaux et ambulances en direct",
    "navSub./driver": "Missions actives et relais GPS",
    "navSub./booking": "RDV en cabinet ou à domicile",
    "navSub./clinical": "Consultations, e-Rx et dossier",
    "navSub./nurse": "Constantes, visites et soins",
    "navSub./hospital": "Lits, accueil, assurance et facturation",
    "navSub./lab": "Analyses et résultats",
    "navSub./pharmacy": "Médicaments, QR et livraison",
    "navSub./admin": "Vérification et gouvernance",
    "navSub./portal": "Connexion patients & familles",
    "navSub./pro": "Médecins, cliniques, labos & flotte",

    // Profiles Directory (/profiles)
    "profiles.heading": "Praticiens, Infirmiers, Établissements & Véhicules",

    // Home Overview & Quick Care Launchpad
    "home.eyebrow": "Réseau de Soins · Maroc",
    "home.title": "Coordination médicale directe.",
    "home.subtitle":
      "Cliniques agréées, ordonnances QR et ambulances en temps réel.",
    "home.ctaFindCare": "Explorer la carte des soins",
    "home.ctaBookDoctor": "Prendre rendez-vous",
    "country.eyebrow": "Standards Régionaux",
    "country.activePrefix": "Région Active",

    // Portal (/portal), Pro (/pro) & Profile (/profile)
    "portal.heading": "Connexion Patients & Familles",
    "pro.heading": "MediSync Pro — Portail Praticiens & Partenaires",
    "profile.heading": "Mon Profil & Compte",
    "portal.recoveryTab": "Vérifier & Réinit.",
    "portal.uploadCredential": "Téléverser le justificatif",
    "portal.facilityRegistry": "Établissements Agréés",

    // Map (/map)
    "map.heading": "Carte Médicale & Régulation en Direct",
    "map.openNowOnly": "Ouvert maintenant",
    "map.facilitiesFound": "Centres de soins",
    "map.activeUnits": "Unités actives",
    "map.driverBeaconTitle": "Position Ambulance en Direct",
    "map.emptyOverlay":
      "Déplacez la carte pour afficher les établissements vérifiés.",

    // Booking (/booking)
    "booking.heading": "Rendez-vous Médicaux & Horaires",

    // Clinical (/clinical)
    "clinical.heading": "Suivi Clinique, Ordonnances QR & Analyses Médicales",
    "clinical.tabDoctor": "Consultations & E-Rx",
    "clinical.tabCalendar": "Clients & Agenda",
    "clinical.tabSchedule": "Plannings Cliniques",
    "clinical.tabLabs": "Analyses & Imagerie",
    "clinical.saveNote": "Enregistrer la note clinique",
    "clinical.issueRx": "Émettre l'ordonnance QR",
    "clinical.uploadScanBtn": "Envoyer l'examen médical",
    "clinical.labsHeading": "Prescriptions d'Analyses & Dépôt de Résultats",
    "lab.heading": "File d'Analyses & Comptes-Rendus",
    "hospital.heading": "Capacité d'Accueil, Réception & Urgences",

    // Pharmacy (/pharmacy)
    "pharma.heading": "Pharmacies de Garde & Parapharmacie",
    "pharma.searchPlaceholder": "Rechercher un médicament ou principe actif...",
    "pharma.addToCart": "Ajouter",
    "pharma.cartTitle": "Panier & Paiement",
    "pharma.placeOrder": "Commander & Payer",
    "pharma.emptyCart": "Ajoutez des produits pour commander.",
    "pharma.ordersTitle": "Commandes & Reçus Imprimables",

    // Admin (/admin)
    "admin.heading": "Centre d'Opérations & Conformité",
  },
  ar: {
    "menu.open": "فتح القائمة واللغة",
    "menu.close": "إغلاق القائمة",
    "menu.title": "القائمة",
    "menu.navigation": "الخدمات الصحية",
    "menu.sectionCare": "الرعاية والخدمات",
    "menu.sectionAccount": "الحساب والدليل",
    "menu.language": "اللغة",
    "menu.guestTitle": "حساب ميديسينك",
    "menu.guestSubtitle": "تابع مواعيدك ووصفاتك",
    "menu.signInCta": "تسجيل الدخول",
    "menu.manageAccount": "الملف الشخصي والأمان",
    "menu.staffPending": "قيد المراجعة",
    "menu.partnerTitle": "الطاقم الطبي والشركاء",
    "menu.partnerSubtitle": "الأطباء والممرضون والسائقون والمختبرات",
    "menu.signOutStaff": "تسجيل الخروج المهني",
    "nav.overview": "نظرة عامة",
    "nav.patient": "رعايتي الطبية",
    "nav.profiles": "الملفات",

    // Patient Care Hub (/patient)
    "patient.heading": "ابحث عن طبيب، صيدلية أو إسعاف وتابع مواعيدك بسهولة",
    "nav.map": "الخريطة الحية",
    "nav.driver": "مساحة السائق",
    "nav.booking": "الحجوزات",
    "nav.clinical": "فضاء الطبيب",
    "nav.nurse": "محطة التمريض",
    "nav.hospital": "المستشفى والعيادة",
    "nav.lab": "مكتب المختبر",
    "nurse.heading": "محطة التمريض والرعاية المنزلية",
    "nav.pharmacy": "الصيدلية",
    "nav.admin": "الإدارة",
    "nav.portal": "دخول المرضى",
    "nav.pro": "بوابة المهنيين Pro",
    "nav.profile": "ملفي الشخصي",
    "navSub./": "نظرة عامة وأرقام الطوارئ",
    "navSub./patient": "المواعيد والتنقلات والملف الطبي",
    "navSub./profiles": "الأطباء والعيادات وأسطول الإسعاف",
    "navSub./profile": "البيانات والوثائق والأمان",
    "navSub./map": "المستشفيات وسيارات الإسعاف الحية",
    "navSub./driver": "مهام النقل والتتبع المباشر",
    "navSub./booking": "حجز عيادة أو زيارة منزلية",
    "navSub./clinical": "الاستشارات والوصفات الطبية",
    "navSub./nurse": "التمريض والزيارات المنزلية",
    "navSub./hospital": "الأسرّة والاستقبال والفوترة",
    "navSub./lab": "طلبات المختبر ونتائج الفحوصات",
    "navSub./pharmacy": "الأدوية والوصفات الرقمية والتوصيل",
    "navSub./admin": "التحقق من الطواقم والامتثال",
    "navSub./portal": "حسابات المرضى والعائلات",
    "navSub./pro": "الأطباء والعيادات والمختبرات والأسطول",

    // Profiles Directory (/profiles)
    "profiles.heading": "الأطباء والممرضون والمستشفيات وسيارات النقل الطبي",

    // Home Overview & Quick Care Launchpad
    "home.eyebrow": "شبكة الرعاية · المغرب",
    "home.title": "تنسيق طبي مباشر ومتكامل.",
    "home.subtitle": "عيادات معتمدة، وصفات QR رقمية، ونقل إسعافي مباشر.",
    "home.ctaFindCare": "ابحث عن الرعاية على الخريطة",
    "home.ctaBookDoctor": "احجز موعد طبيب",
    "country.eyebrow": "المعايير الإقليمية",
    "country.activePrefix": "المنطقة الصحية",

    // Portal (/portal), Pro (/pro) & Profile (/profile)
    "portal.heading": "تسجيل دخول المرضى والعائلات",
    "pro.heading": "بوابة المهنيين والشركاء — MediSync Pro",
    "profile.heading": "ملفي الشخصي والحساب",
    "portal.recoveryTab": "التحقق والاستعادة",
    "portal.uploadCredential": "رفع واعتماد الوثيقة",
    "portal.facilityRegistry": "سجل المنشآت المعتمدة",

    // Map (/map)
    "map.heading": "الخريطة الطبية والتنسيق الفوري",
    "map.openNowOnly": "مفتوح الآن فقط",
    "map.facilitiesFound": "منشأة طبية",
    "map.activeUnits": "وحدة نشطة",
    "map.driverBeaconTitle": "مشاركة موقع سيارة الإسعاف",
    "map.emptyOverlay": "حرّك الخريطة لعرض المنشآت الصحية المعتمدة.",

    // Booking (/booking)
    "booking.heading": "حجز المواعيد الطبية وجدول العيادات",

    // Clinical (/clinical)
    "clinical.heading": "الرعاية السريرية، الوصفات الرقمية والمختبرات",
    "clinical.tabDoctor": "الفحص والوصفات الرقمية",
    "clinical.tabCalendar": "المرضى وجدول المواعيد",
    "clinical.tabSchedule": "جداول العيادات",
    "clinical.tabLabs": "المختبرات والأشعة",
    "clinical.saveNote": "حفظ ملاحظات الفحص",
    "clinical.issueRx": "إصدار وصفة QR الرقمية",
    "clinical.uploadScanBtn": "رفع ملف الفحص أو الأشعة",
    "clinical.labsHeading": "طلبات المختبر ورفع النتائج الطبية",
    "lab.heading": "قائمة التحاليل ورفع النتائج المشفرة",
    "hospital.heading": "جاهزية المؤسسة، الاستقبال والطوارئ",

    // Pharmacy (/pharmacy)
    "pharma.heading": "صيدليات الحراسة، شبه الصيدلية والوصفات QR",
    "pharma.searchPlaceholder": "ابحث عن دواء أو مادة فعالة...",
    "pharma.addToCart": "إضافة للسلة",
    "pharma.cartTitle": "سلة المشتريات والدفع",
    "pharma.placeOrder": "تأكيد الطلب والدفع",
    "pharma.emptyCart": "أضف أدوية أو مستلزمات لإتمام الطلب.",
    "pharma.ordersTitle": "الطلبات وإيصالات الدفع",

    // Admin (/admin)
    "admin.heading": "مركز العمليات والامتثال",
  },
};

function syncDocumentLocale(locale: LocaleCode): void {
  if (typeof document !== "undefined") {
    if (document.documentElement.lang !== locale) {
      document.documentElement.lang = locale;
    }
    const nextDir = locale === "ar" ? "rtl" : "ltr";
    if (document.documentElement.dir !== nextDir) {
      document.documentElement.dir = nextDir;
    }
  }
}

const LOCALE_TRANSLATORS: Record<LocaleCode, (key: string) => string> = {
  en: (key: string) => TRANSLATIONS.en[key] ?? key,
  fr: (key: string) => TRANSLATIONS.fr[key] ?? TRANSLATIONS.en[key] ?? key,
  ar: (key: string) => TRANSLATIONS.ar[key] ?? TRANSLATIONS.en[key] ?? key,
};

function readInitialClientLocale(): LocaleCode {
  if (typeof window === "undefined") return "en";
  if (!initializedFromStorage) {
    initializedFromStorage = true;
    try {
      const saved = window.localStorage.getItem(LOCALE_STORAGE_KEY);
      if (saved === "en" || saved === "fr" || saved === "ar") {
        currentLocaleCache = saved;
      }
    } catch {
      currentLocaleCache = "en";
    }
    syncDocumentLocale(currentLocaleCache);
  }
  return currentLocaleCache;
}

function subscribeLocale(callback: () => void): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }
  const handler = () => callback();
  const storageHandler = (event: StorageEvent) => {
    if (event.key !== LOCALE_STORAGE_KEY) return;
    if (
      event.newValue === "en" ||
      event.newValue === "fr" ||
      event.newValue === "ar"
    ) {
      currentLocaleCache = event.newValue;
      initializedFromStorage = true;
      syncDocumentLocale(event.newValue);
      callback();
    }
  };
  window.addEventListener(LOCALE_EVENT, handler);
  window.addEventListener("storage", storageHandler);
  return () => {
    window.removeEventListener(LOCALE_EVENT, handler);
    window.removeEventListener("storage", storageHandler);
  };
}

function getServerLocaleSnapshot(): LocaleCode {
  return "en";
}

export function setAppLocale(next: LocaleCode): void {
  currentLocaleCache = next;
  initializedFromStorage = true;
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(LOCALE_STORAGE_KEY, next);
    } catch {
      // Ignore storage quota errors
    }
    syncDocumentLocale(next);
    window.dispatchEvent(new Event(LOCALE_EVENT));
  }
}

const LOCALE_HOOK_RESULTS: Record<
  LocaleCode,
  {
    locale: LocaleCode;
    setLocale: (next: LocaleCode) => void;
    t: (key: string) => string;
    isRtl: boolean;
  }
> = {
  en: { locale: "en", setLocale: setAppLocale, t: LOCALE_TRANSLATORS.en, isRtl: false },
  fr: { locale: "fr", setLocale: setAppLocale, t: LOCALE_TRANSLATORS.fr, isRtl: false },
  ar: { locale: "ar", setLocale: setAppLocale, t: LOCALE_TRANSLATORS.ar, isRtl: true },
};

export function useLocale(): {
  locale: LocaleCode;
  setLocale: (next: LocaleCode) => void;
  t: (key: string) => string;
  isRtl: boolean;
} {
  const locale = useSyncExternalStore(
    subscribeLocale,
    readInitialClientLocale,
    getServerLocaleSnapshot,
  );

  useEffect(() => {
    syncDocumentLocale(locale);
  }, [locale]);

  return LOCALE_HOOK_RESULTS[locale];
}
