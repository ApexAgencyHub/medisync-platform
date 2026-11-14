"use client";

import { useEffect, useSyncExternalStore } from "react";
import type { LocaleCode } from "@medisync/contracts";

const LOCALE_STORAGE_KEY = "medisync.locale.v1";
const LOCALE_EVENT = "medisync:locale-change";

let currentLocaleCache: LocaleCode = "en";
let initializedFromStorage = false;

const TRANSLATIONS: Record<LocaleCode, Record<string, string>> = {
  en: {
    "brand.tagline": "Connected Care Network",
    "menu.open": "Open navigation and language menu",
    "menu.close": "Close menu",
    "menu.title": "Menu",
    "menu.navigation": "Care Workspaces",
    "menu.language": "Language & Reading Direction",
    "nav.overview": "Overview",
    "nav.map": "Live Map",
    "nav.booking": "Booking",
    "nav.clinical": "Clinical",
    "nav.pharmacy": "Pharmacy",
    "nav.admin": "Admin",
    "nav.portal": "Portal",

    // Home Overview & Quick Care Launchpad
    "home.eyebrow": "Verified Care Network · 24/7 Clinical & Emergency Access",
    "home.title":
      "Global medical coordination built for clinics, hospitals, drivers, and patients.",
    "home.subtitle":
      "Locate trusted hospitals and pharmacies on live street maps, book same-day doctor visits, verify digital prescriptions, and coordinate emergency transport in one unified network.",
    "home.ctaFindCare": "Find Care on Map",
    "home.ctaBookDoctor": "Book a Doctor",
    "home.ctaOrderPharmacy": "Order Pharmacy",
    "home.ctaPortal": "Care & Provider Portal",
    "home.hotlineLabel": "Emergency Hotline",
    "home.coverageLabel": "Licensed Clinics & 24/7 Pharmacies",
    "country.eyebrow": "Regional Health Standards",
    "country.activePrefix": "Care Region",
    "country.dirLocale": "Languages",
    "country.emergencyNumbers": "Ambulance / Emergency",
    "country.currencyUnits": "Currency & Units",
    "country.dataResidency": "Care Network",
    "ecosystem.heading": "Connected Care Portals by Role",
    "ecosystem.subtitle":
      "Seamless tools tailored for patients, physicians, medical transport teams, pharmacies, laboratories, and operations.",
    "ecosystem.verifiedBadge": "All Care Portals Live",
    "ecosystem.openPortal": "Open workspace",
    "ecosystem.role.patient.title": "Patients & Families",
    "ecosystem.role.patient.summary":
      "Browse verified clinics and 24/7 pharmacies near you, reserve appointments, order medications, and track live emergency transport.",
    "ecosystem.role.doctor.title": "Doctors & Specialists",
    "ecosystem.role.doctor.summary":
      "Manage multi-clinic schedules, record consultation notes, order diagnostic panels, and issue scannable digital prescriptions.",
    "ecosystem.role.clinic.title": "Clinics & Reception",
    "ecosystem.role.clinic.summary":
      "Maintain clinic directory profiles, manage daily shift rosters, check in arriving patients, and coordinate referrals.",
    "ecosystem.role.hospital.title": "Hospitals & Emergency",
    "ecosystem.role.hospital.summary":
      "Coordinate urgent intake, monitor incoming emergency ambulances in real time, and verify regional facility readiness.",
    "ecosystem.role.driver.title": "Ambulance & Medical Couriers",
    "ecosystem.role.driver.summary":
      "Share live GPS location updates, accept emergency dispatch requests, and track pharmacy or lab home deliveries.",
    "ecosystem.role.pharmacy.title": "Pharmacies",
    "ecosystem.role.pharmacy.summary":
      "Verify patient e-prescriptions by QR code, dispense safely without duplicates, and fulfill online medication orders.",
    "ecosystem.role.lab.title": "Diagnostic Labs & Imaging",
    "ecosystem.role.lab.summary":
      "Receive test orders, track home sample pickups, and upload certified radiology scans and PDF lab reports.",
    "ecosystem.role.admin.title": "Operations & Compliance",
    "ecosystem.role.admin.summary":
      "Review facility licenses and clinician credentials, resolve service disputes, and inspect full regulatory audit trails.",

    // Portal (/portal)
    "portal.eyebrow": "Identity & Care Facility Access",
    "portal.heading": "Clinical & Ops Access Portal",
    "portal.recoveryTab": "Verify & Reset",
    "portal.uploadCredential": "Upload & Verify Credential",
    "portal.facilityRegistry": "Verified Care Facilities",
    "portal.signInPrompt":
      "Sign in or register to view licensed healthcare centers and role tools in your country.",

    // Map (/map)
    "map.eyebrow": "Real-Time Care Discovery & Dispatch",
    "map.heading": "Live Medical Map & Dispatch Console",
    "map.searchArea": "Search This Area",
    "map.searching": "Updating Map...",
    "map.openNowOnly": "Open Now Only",
    "map.facilitiesFound": "Medical Centers",
    "map.activeUnits": "Active Units",
    "map.driverBeaconTitle": "Ambulance Location Sharing",
    "map.emptyOverlay":
      "Click Search This Area or select a region to view verified hospitals, clinics, pharmacies, and laboratories.",

    // Booking (/booking)
    "booking.eyebrow": "Same-Day Clinic & Specialist Scheduling",
    "booking.heading": "Doctor Appointments & Clinic Hours",
    "booking.subtitle":
      "Compare open specialist hours, reserve clinic or video consultations with conflict-free slot locking, and track visit statuses.",

    // Clinical (/clinical)
    "clinical.eyebrow": "Consultations, E-Prescriptions & Diagnostic Labs",
    "clinical.heading": "Clinical Care, QR E-Prescriptions & Diagnostic Labs",
    "clinical.subtitle":
      "Complete consultation notes, verifiable pharmacy QR prescriptions, and certified radiology or laboratory report uploads.",
    "clinical.tabDoctor": "Consultation & E-Rx",
    "clinical.tabPharmacy": "Pharmacy QR Dispense",
    "clinical.tabLabs": "Diagnostic Labs & Scans",
    "clinical.saveNote": "Save Consultation Note",
    "clinical.issueRx": "Issue QR Prescription",
    "clinical.dispenseBtn": "Confirm & Dispense",
    "clinical.uploadScanBtn": "Upload Diagnostic File",
    "clinical.labsHeading": "Diagnostic Lab Orders & Report Upload",

    // Pharmacy (/pharmacy)
    "pharma.eyebrow": "Verified Pharmacy Storefront",
    "pharma.heading": "Online Pharmacy Catalog & Courier Checkout",
    "pharma.subtitle":
      "Browse country-licensed pharmacies, add OTC & prescription items, verify Rx links, pay securely, and dispatch live couriers.",
    "pharma.searchPlaceholder": "Search medications or active ingredients...",
    "pharma.addToCart": "Add to Cart",
    "pharma.cartTitle": "Shopping Cart & Checkout",
    "pharma.placeOrder": "Place Order & Pay Now",
    "pharma.emptyCart": "Add OTC or Rx medications from the catalog to start checkout.",
    "pharma.ordersTitle": "Orders & Printable Receipts",

    // Admin (/admin)
    "admin.eyebrow": "Regional Compliance, Licensing & Operations",
    "admin.heading": "Master Operations & Compliance Center",
  },
  fr: {
    "brand.tagline": "Réseau de Soins Connecté",
    "menu.open": "Ouvrir le menu et les langues",
    "menu.close": "Fermer le menu",
    "menu.title": "Menu",
    "menu.navigation": "Espaces de soins",
    "menu.language": "Langue et sens de lecture",
    "nav.overview": "Aperçu",
    "nav.map": "Carte Live",
    "nav.booking": "Rendez-vous",
    "nav.clinical": "Clinique",
    "nav.pharmacy": "Pharmacie",
    "nav.admin": "Admin",
    "nav.portal": "Portail",

    // Home Overview & Quick Care Launchpad
    "home.eyebrow": "Réseau de Soins Agréé · Coordination Médicale 24h/24",
    "home.title":
      "La coordination médicale conçue pour les cliniques, hôpitaux, ambulanciers et patients.",
    "home.subtitle":
      "Localisez cliniques, hôpitaux et pharmacies de garde sur la carte en direct, réservez une consultation le jour même, vérifiez vos ordonnances QR et suivez les transports médicaux.",
    "home.ctaFindCare": "Explorer la carte des soins",
    "home.ctaBookDoctor": "Prendre rendez-vous",
    "home.ctaOrderPharmacy": "Commander en pharmacie",
    "home.ctaPortal": "Espace Patient & Praticien",
    "home.hotlineLabel": "Urgences Médicales",
    "home.coverageLabel": "Cliniques agréées & Pharmacies 24/7",
    "country.eyebrow": "Standards Sanitaires Régionaux",
    "country.activePrefix": "Région Active",
    "country.dirLocale": "Langues",
    "country.emergencyNumbers": "SAMU / Urgences",
    "country.currencyUnits": "Devise & Unités",
    "country.dataResidency": "Réseau de Soins",
    "ecosystem.heading": "Portails de Soins par Rôle",
    "ecosystem.subtitle":
      "Des outils dédiés aux patients, médecins, secours d'urgence, pharmacies, laboratoires et équipes de régulation.",
    "ecosystem.verifiedBadge": "Tous les portails actifs",
    "ecosystem.openPortal": "Ouvrir l'espace",
    "ecosystem.role.patient.title": "Patients & Aidants",
    "ecosystem.role.patient.summary":
      "Trouvez un établissement ou une pharmacie de garde, réservez un créneau, commandez vos traitements et suivez l'ambulance en direct.",
    "ecosystem.role.doctor.title": "Médecins & Spécialistes",
    "ecosystem.role.doctor.summary":
      "Gérez vos plannings multi-cliniques, rédigez vos comptes-rendus, prescrivez des bilans et délivrez des ordonnances QR.",
    "ecosystem.role.clinic.title": "Cliniques & Accueil",
    "ecosystem.role.clinic.summary":
      "Mettez à jour vos fiches d'établissement, gérez les gardes des praticiens et accueillez les consultations sans attente.",
    "ecosystem.role.hospital.title": "Hôpitaux & Urgences",
    "ecosystem.role.hospital.summary":
      "Suivez les arrivées d'ambulances en temps réel, coordonnez les transferts urgents et diffusez la disponibilité des services.",
    "ecosystem.role.driver.title": "Ambulanciers & Coursiers Santé",
    "ecosystem.role.driver.summary":
      "Transmettez votre position GPS en direct, acceptez les missions d'urgence et assurez la livraison de médicaments.",
    "ecosystem.role.pharmacy.title": "Pharmacies d'Officine",
    "ecosystem.role.pharmacy.summary":
      "Validez les ordonnances électroniques par QR code sans double délivrance et expédiez les commandes en ligne.",
    "ecosystem.role.lab.title": "Laboratoires & Imagerie",
    "ecosystem.role.lab.summary":
      "Recevez les prescriptions d'analyses, planifiez les prélèvements à domicile et déposez les comptes-rendus certifiés.",
    "ecosystem.role.admin.title": "Régulation & Conformité",
    "ecosystem.role.admin.summary":
      "Contrôlez les agréments ministériels, arbitrez les incidents de service et consultez le journal d'audit complet.",

    // Portal (/portal)
    "portal.eyebrow": "Accès Sécurisé & Agrément Établissements",
    "portal.heading": "Portail d'Accès Clinique & Opérations",
    "portal.recoveryTab": "Vérifier & Réinit.",
    "portal.uploadCredential": "Téléverser le justificatif",
    "portal.facilityRegistry": "Établissements Agréés",
    "portal.signInPrompt":
      "Connectez-vous ou créez un compte pour accéder aux établissements agréés de votre pays.",

    // Map (/map)
    "map.eyebrow": "Recherche de Soins & Régulation d'Urgence",
    "map.heading": "Carte Médicale & Régulation en Direct",
    "map.searchArea": "Rechercher dans cette zone",
    "map.searching": "Actualisation...",
    "map.openNowOnly": "Ouvert maintenant",
    "map.facilitiesFound": "Centres de soins",
    "map.activeUnits": "Unités actives",
    "map.driverBeaconTitle": "Position Ambulance en Direct",
    "map.emptyOverlay":
      "Cliquez sur Rechercher dans cette zone pour afficher les hôpitaux, cliniques, pharmacies et laboratoires vérifiés.",

    // Booking (/booking)
    "booking.eyebrow": "Plannings Praticiens & Prise de Rendez-vous",
    "booking.heading": "Rendez-vous Médicaux & Horaires",
    "booking.subtitle":
      "Consultez les créneaux disponibles en cabinet ou téléconsultation avec réservation instantanée garantie sans doublon.",

    // Clinical (/clinical)
    "clinical.eyebrow": "Consultations, Ordonnances QR & Laboratoires",
    "clinical.heading": "Suivi Clinique, Ordonnances QR & Analyses Médicales",
    "clinical.subtitle":
      "Notes de consultation, délivrance sécurisée par QR code en pharmacie et dépôt sécurisé d'imagerie et comptes-rendus.",
    "clinical.tabDoctor": "Consultations & E-Rx",
    "clinical.tabPharmacy": "Délivrance QR Pharmacie",
    "clinical.tabLabs": "Analyses & Imagerie",
    "clinical.saveNote": "Enregistrer la note clinique",
    "clinical.issueRx": "Émettre l'ordonnance QR",
    "clinical.dispenseBtn": "Confirmer la délivrance",
    "clinical.uploadScanBtn": "Envoyer l'examen médical",
    "clinical.labsHeading": "Prescriptions d'Analyses & Dépôt de Résultats",

    // Pharmacy (/pharmacy)
    "pharma.eyebrow": "Officines Agréées en Ligne",
    "pharma.heading": "Pharmacie en Ligne & Livraison Express",
    "pharma.subtitle":
      "Parcourez les officines agréées, commandez sans ou avec ordonnance, payez en ligne et suivez le coursier.",
    "pharma.searchPlaceholder": "Rechercher un médicament ou principe actif...",
    "pharma.addToCart": "Ajouter",
    "pharma.cartTitle": "Panier & Paiement",
    "pharma.placeOrder": "Commander & Payer",
    "pharma.emptyCart": "Ajoutez des produits de l'officine pour passer commande.",
    "pharma.ordersTitle": "Commandes & Reçus Imprimables",

    // Admin (/admin)
    "admin.eyebrow": "Gouvernance Sanitaire, Licences & Audits",
    "admin.heading": "Centre d'Opérations & Conformité",
  },
  ar: {
    "brand.tagline": "شبكة الرعاية الصحية المتصلة",
    "menu.open": "فتح القائمة واللغة",
    "menu.close": "إغلاق القائمة",
    "menu.title": "القائمة",
    "menu.navigation": "أقسام الرعاية الصحية",
    "menu.language": "اللغة واتجاه القراءة",
    "nav.overview": "نظرة عامة",
    "nav.map": "الخريطة الحية",
    "nav.booking": "الحجوزات",
    "nav.clinical": "السجل السريري",
    "nav.pharmacy": "الصيدلية",
    "nav.admin": "الإدارة",
    "nav.portal": "البوابة",

    // Home Overview & Quick Care Launchpad
    "home.eyebrow": "شبكة رعاية صحية معتمدة · تنسيق طبي على مدار الساعة",
    "home.title":
      "التنسيق الطبي المتكامل للعيادات والمستشفيات وفرق الإسعاف والمرضى.",
    "home.subtitle":
      "ابحث عن المستشفيات والصيدليات المناوبة على خريطة الشوارع المباشرة، احجز موعدك الطبي فوراً، تحقق من الوصفات الرقمية وتابع النقل الطبي الحي.",
    "home.ctaFindCare": "ابحث عن الرعاية على الخريطة",
    "home.ctaBookDoctor": "احجز موعد طبيب",
    "home.ctaOrderPharmacy": "اطلب من الصيدلية",
    "home.ctaPortal": "بوابة المرضى والأطباء",
    "home.hotlineLabel": "طوارئ الإسعاف",
    "home.coverageLabel": "عيادات مرخصة وصيدليات 24/7",
    "country.eyebrow": "المعايير الصحية الإقليمية",
    "country.activePrefix": "المنطقة الصحية",
    "country.dirLocale": "اللغات المتاحة",
    "country.emergencyNumbers": "الإسعاف والطوارئ",
    "country.currencyUnits": "العملة والوحدات",
    "country.dataResidency": "شبكة الرعاية",
    "ecosystem.heading": "بوابات الرعاية حسب الدور",
    "ecosystem.subtitle":
      "واجهات متخصصة للمرضى والأطباء وفرق الإسعاف والصيدليات والمختبرات وفرق الإشراف.",
    "ecosystem.verifiedBadge": "جميع البوابات متصلة",
    "ecosystem.openPortal": "فتح البوابة",
    "ecosystem.role.patient.title": "المرضى والأسر",
    "ecosystem.role.patient.summary":
      "اعثر على أقرب العيادات والصيدليات المناوبة على الخريطة، احجز موعدك، اطلب أدويتك وتتبع سيارة الإسعاف.",
    "ecosystem.role.doctor.title": "الأطباء والأخصائيون",
    "ecosystem.role.doctor.summary":
      "نظم جداول المناوبات عبر عدة عيادات، سجل ملاحظات الفحص واطلب التحاليل وأصدر وصفات رقمية برمز QR.",
    "ecosystem.role.clinic.title": "العيادات والاستقبال",
    "ecosystem.role.clinic.summary":
      "أدر ملفات المراكز الصحية وجداول الأطباء واستقبل المواعيد الحضورية والاستشارات عن بعد بكفاءة.",
    "ecosystem.role.hospital.title": "المستشفيات وأقسام الطوارئ",
    "ecosystem.role.hospital.summary":
      "نسق استقبال الحالات المستعجلة وتابع وصول وحدات الإسعاف المباشرة وجاهزية الأقسام الطبية.",
    "ecosystem.role.driver.title": "سيارات الإسعاف والتوصيل الطبي",
    "ecosystem.role.driver.summary":
      "بث الموقع المباشر باستمرار، استجب لنداءات الطوارئ وأوصل الأدوية والعينات الطبية بأمان.",
    "ecosystem.role.pharmacy.title": "الصيدليات المعتمدة",
    "ecosystem.role.pharmacy.summary":
      "تحقق من الوصفات الإلكترونية عبر رمز QR وصرفها بأمان دون تكرار وتوصيل طلبات المتجر.",
    "ecosystem.role.lab.title": "مختبرات التحاليل والأشعة",
    "ecosystem.role.lab.summary":
      "استلم طلبات الفحوصات وحدد مواعيد سحب العينات وارفع تقارير المختبر وصور الأشعة المعتمدة.",
    "ecosystem.role.admin.title": "الإدارة والرقابة الصحية",
    "ecosystem.role.admin.summary":
      "اعتمد تراخيص المنشآت والممارسين وعالج النزاعات وراجع سجل التدقيق الكامل.",

    // Portal (/portal)
    "portal.eyebrow": "الهوية الرقمية واعتماد المنشآت الصحية",
    "portal.heading": "بوابة الدخول والاعتماد الطبي",
    "portal.recoveryTab": "التحقق والاستعادة",
    "portal.uploadCredential": "رفع واعتماد الوثيقة",
    "portal.facilityRegistry": "سجل المنشآت المعتمدة",
    "portal.signInPrompt":
      "سجل الدخول أو أنشئ حساباً لاستعراض المراكز الصحية المرخصة في بلدك.",

    // Map (/map)
    "map.eyebrow": "اكتشاف الرعاية المباشر والتنسيق الإسعافي",
    "map.heading": "الخريطة الطبية والتنسيق الفوري",
    "map.searchArea": "البحث في هذه المنطقة",
    "map.searching": "جاري التحديث...",
    "map.openNowOnly": "مفتوح الآن فقط",
    "map.facilitiesFound": "منشأة طبية",
    "map.activeUnits": "وحدة نشطة",
    "map.driverBeaconTitle": "مشاركة موقع سيارة الإسعاف",
    "map.emptyOverlay":
      "اضغط على البحث في هذه المنطقة لعرض المستشفيات والعيادات والصيدليات والمختبرات المعتمدة.",

    // Booking (/booking)
    "booking.eyebrow": "مواعيد الأخصائيين وحجز العيادات",
    "booking.heading": "حجز المواعيد الطبية وجدول العيادات",
    "booking.subtitle":
      "قارن مواعيد الأطباء المتاحة واحجز استشارتك الحضورية أو المرئية فوراً مع منع تضارب المواعيد.",

    // Clinical (/clinical)
    "clinical.eyebrow": "الاستشارات والوصفات الرقمية والمختبرات",
    "clinical.heading": "الرعاية السريرية، الوصفات الرقمية والمختبرات",
    "clinical.subtitle":
      "تسجيل ملاحظات الفحص والتحقق من وصفات QR بالصيدلية ورفع نتائج المختبر وصور الأشعة بأمان.",
    "clinical.tabDoctor": "الفحص والوصفات الرقمية",
    "clinical.tabPharmacy": "صرف وصفة QR",
    "clinical.tabLabs": "المختبرات والأشعة",
    "clinical.saveNote": "حفظ ملاحظات الفحص",
    "clinical.issueRx": "إصدار وصفة QR الرقمية",
    "clinical.dispenseBtn": "تأكيد الصرف الدوائي",
    "clinical.uploadScanBtn": "رفع ملف الفحص أو الأشعة",
    "clinical.labsHeading": "طلبات المختبر ورفع النتائج الطبية",

    // Pharmacy (/pharmacy)
    "pharma.eyebrow": "متجر الصيدليات المعتمدة",
    "pharma.heading": "الصيدلية الإلكترونية والدفع والتوصيل الفوري",
    "pharma.subtitle":
      "تصفح الصيدليات المعتمدة، أضف الأدوية والمستلزمات الطبية، اربط الوصفة الرقمية وأكمل الدفع بأمان.",
    "pharma.searchPlaceholder": "ابحث عن دواء أو مادة فعالة...",
    "pharma.addToCart": "إضافة للسلة",
    "pharma.cartTitle": "سلة المشتريات والدفع",
    "pharma.placeOrder": "تأكيد الطلب والدفع",
    "pharma.emptyCart": "أضف أدوية أو مستلزمات طبية للبدء في الطلب.",
    "pharma.ordersTitle": "الطلبات وإيصالات الدفع",

    // Admin (/admin)
    "admin.eyebrow": "الحوكمة الإقليمية والرقابة التشغيلية",
    "admin.heading": "مركز العمليات والامتثال",
  },
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
  }
  return currentLocaleCache;
}

function subscribeLocale(callback: () => void): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }
  const handler = () => callback();
  window.addEventListener(LOCALE_EVENT, handler);
  return () => window.removeEventListener(LOCALE_EVENT, handler);
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
    window.dispatchEvent(new Event(LOCALE_EVENT));
  }
}

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
    if (typeof document !== "undefined") {
      document.documentElement.lang = locale;
      document.documentElement.dir = locale === "ar" ? "rtl" : "ltr";
    }
  }, [locale]);

  return {
    locale,
    setLocale: setAppLocale,
    t: (key: string) => TRANSLATIONS[locale][key] ?? TRANSLATIONS.en[key] ?? key,
    isRtl: locale === "ar",
  };
}
