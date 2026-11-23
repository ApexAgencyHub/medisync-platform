"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type {
  AppointmentSummary,
  AuthResponse,
  ClinicalMediaObjectSummary,
  CountryPack,
  DirectoryDoctorSummary,
  DirectoryDriverSummary,
  DirectoryFacilitySummary,
  DispatchRequestSummary,
  LabOrderSummary,
  LocaleCode,
  MedicalServiceSummary,
  PatientInsurancePolicy,
  PatientMedicalProfile,
  PrescriptionSummary,
  VisitNoteSummary,
} from "@medisync/contracts";
import { fetchAppointments } from "@/features/booking";
import {
  fetchClinicalMedia,
  fetchLabOrders,
  fetchMyPatientProfile,
  fetchPrescriptions,
  fetchVisitNotes,
  listMyPatientInsurances,
} from "@/features/clinical-workspace";
import { listDispatchRequests } from "@/features/maps-dispatch";
import {
  checkBackendOnline,
  fetchDirectoryDoctors,
  fetchDirectoryDrivers,
  fetchDirectoryFacilities,
  fetchMedicalServices,
} from "@/shared/api/directory-client";
import { ConsumerWorkspaceGuard } from "@/shared/auth/ConsumerWorkspaceGuard";
import {
  canReadAppointments,
  canReadClinicalEhr,
  canReadDispatchFeed,
  canReadLabOrders,
  canReadPrescriptions,
  canReadVisitNotes,
  isConsumerUserOrGuest,
  syncPendingSessionStatus,
} from "@/shared/auth/role-capabilities";
import {
  clearStoredSession,
  readStoredSession,
  revokeClientSession,
} from "@/shared/auth/session-storage";
import {
  ACTIVE_COUNTRY_CODE,
  resolveActivePack,
  resolveEffectiveCountryCode,
} from "@/shared/config/deployment";
import {
  expandMoroccanCityKeywords,
  normalizeCityText,
} from "@/shared/config/morocco-standards";
import { useLocale } from "@/shared/i18n/locale-store";
import {
  formatCountryDisplayName,
  formatFacilityKind,
} from "@/shared/i18n/human-labels";
import {
  buildSpecialtyFilterOptions,
  formatSpecialtyLabel,
  getSpecialtyKeywords,
  matchesDoctorSpecialtyFilter,
} from "@/shared/i18n/specialties";
import {
  useBookmarkedProviders,
  useGuestActivityPasses,
} from "@/shared/patient/patient-local-store";
import {
  resolveFacilityPicture,
  resolveVehiclePicture,
} from "@/shared/ui/EntityAvatar";
import {
  VerificationGateNotice,
  isPendingStaffVerification,
} from "@/shared/ui/VerificationGateNotice";
import { WorkspaceHeader, useToastSetter } from "@/shared/ui/primitives";
import { Ambulance, Compass, MapPin } from "lucide-react";
import {
  formatPlainSpecialty,
  getPatientUiCopy,
  type PatientSearchCategory,
  type PatientSearchResultItem,
} from "../patient-copy";
import { CareGuideGrid } from "./CareGuideGrid";
import { NearbyCareStrip } from "./NearbyCareStrip";
import { PatientActivitySection } from "./PatientActivitySection";
import { PatientHealthFolderSection } from "./PatientHealthFolderSection";
import { PatientSafetySection } from "./PatientSafetySection";
import { PatientSearchSection } from "./PatientSearchSection";

interface PatientHubWorkspaceProps {
  packs: readonly CountryPack[];
  apiBaseUrl: string;
}

function buildStaticCareResults(
  locale: LocaleCode,
): readonly PatientSearchResultItem[] {
  if (locale === "ar") {
    return [
      {
        id: "care-action-ambulance",
        category: "DRIVER",
        badgeLabel: "إسعاف · 141",
        badgeTone: "red",
        title: "سيارة إسعاف ونقل طبي استعجالي",
        plainHint: "برّك باش تشوف أقرب سيارات الإسعاف المباشرة على الخريطة",
        subtitle: "تتبع سيارات الإسعاف أو اطلب سيارة بنقرة واحدة",
        keywords:
          "ambulance driver 141 transport samu emergency urgent ride pickup إسعاف طوارئ urgence",
        href: "/map?layer=DRIVER",
        ctaLabel: "فتح الخريطة المباشرة",
        imageSrc: "/media/vehicles/ambulance-van.webp",
      },
      {
        id: "care-action-doctors",
        category: "DOCTOR",
        badgeLabel: "أطباء وممرضون",
        badgeTone: "emerald",
        title: "الطب العام، أطباء القلب وممرضو المنزل",
        plainHint: "احجز زيارة في مكان عمل الطبيب أو مكالمة فيديو",
        subtitle: "قارن بين الأطباء المعتمدين واحجز موعدك بسهولة",
        keywords:
          "doctor nurse cardiology heart chest blood pressure pediatrics dermatology gp consultation home visit طبيب ممرض قلب طونسيو médecin infirmier",
        href: "/booking?provider=doctor&mode=IN_PERSON",
        ctaLabel: "زيارة فالعيادة",
        secondaryHref: "/booking?provider=doctor&mode=TELEHEALTH",
        secondaryCtaLabel: "مكالمة فيديو",
        imageSrc: "/media/scenes/telehealth-video.webp",
      },
      {
        id: "care-action-clinics",
        category: "CARE_CENTER",
        badgeLabel: "عيادات",
        badgeTone: "teal",
        title: "عيادات ومراكز طبية قريبة منك",
        plainHint: "تأكد أن العيادة مفتوحة الآن قبل الخروج من البيت",
        subtitle: "افتح العيادات على الخريطة المباشرة واعرف المسار",
        keywords:
          "clinic poliklinik medical center urgent care appointment casablanca rabat marrakech عيادة مصحة clinique",
        href: "/map?layer=CLINIC",
        ctaLabel: "عرض العيادات",
        imageSrc: "/media/facilities/clinic-interior.webp",
      },
      {
        id: "care-action-hospitals",
        category: "CARE_CENTER",
        badgeLabel: "مستشفيات",
        badgeTone: "teal",
        title: "مستشفيات الطوارئ والمستعجلات 24/7",
        plainHint: "اعثر على المستشفيات المفتوحة ليلاً ونهاراً بالقرب منك",
        subtitle: "تفقد جاهزية أقسام المستعجلات ومواقع المستشفيات على الخريطة",
        keywords:
          "hospital chu trauma emergency inpatient surgery urgent care مستشفى سبيطار طوارئ hôpital urgences",
        href: "/map?layer=HOSPITAL",
        ctaLabel: "عرض المستشفيات",
        imageSrc: "/media/facilities/hospital-hub.webp",
      },
      {
        id: "care-action-pharmacies",
        category: "PHARMACY_LAB",
        badgeLabel: "صيدلية 24/7",
        badgeTone: "amber",
        title: "صيدليات الحراسة وصرف وصفات QR بالصيدلية",
        plainHint: "استعمل رمز QR لصرف الوصفة بالصيدلية أو اطلب منتجات شبه الصيدلية",
        subtitle: "صرف الوصفات الإلكترونية بالصيدلية (قانون 17-04) وتوصيل العناية OTC",
        keywords:
          "pharmacy garde medication refill prescription aspirin insulin antibiotics delivery صيدلية حراسة دواء pharmacie médicament",
        href: "/pharmacy",
        ctaLabel: "فتح الصيدلية",
        imageSrc: "/media/facilities/pharmacy-interior.webp",
      },
      {
        id: "care-action-labs",
        category: "PHARMACY_LAB",
        badgeLabel: "تحاليل وراديو",
        badgeTone: "slate",
        title: "تحاليل الدم، الأشعة ومختبرات التشخيص",
        plainHint: "ابحث عن مختبرات تحاليل الدم، الرنين المغناطيسي والراديو",
        subtitle: "حدد موقع المختبرات المعتمدة وتابع نتائج تحاليلك",
        keywords:
          "diagnostic lab laboratory blood panel mri xray scan analysis مختبر تحاليل راديو أشعة laboratoire analyses",
        href: "/map?layer=DIAGNOSTIC_LAB",
        ctaLabel: "عرض المختبرات",
        imageSrc: "/media/scenes/diagnostic-imaging-lab.webp",
      },
    ];
  }

  if (locale === "fr") {
    return [
      {
        id: "care-action-ambulance",
        category: "DRIVER",
        badgeLabel: "Ambulance · 141",
        badgeTone: "red",
        title: "Ambulance d'Urgence & Transport Médical",
        plainHint: "Touchez pour voir les ambulances proches sur la carte en direct",
        subtitle: "Suivre les ambulances en direct ou réserver en 1 clic",
        keywords:
          "ambulance driver 141 transport samu emergency urgent ride pickup إسعاف طوارئ urgence",
        href: "/map?layer=DRIVER",
        ctaLabel: "Ouvrir la Carte",
        imageSrc: "/media/vehicles/ambulance-van.webp",
      },
      {
        id: "care-action-doctors",
        category: "DOCTOR",
        badgeLabel: "Médecins & Infirmiers",
        badgeTone: "emerald",
        title: "Médecine Générale, Cardiologues & Infirmiers à Domicile",
        plainHint: "Réservez au cabinet du médecin ou en appel vidéo HD",
        subtitle: "Comparez les praticiens vérifiés et réservez un créneau",
        keywords:
          "doctor nurse cardiology heart chest blood pressure pediatrics dermatology gp consultation home visit طبيب ممرض قلب طونسيو médecin infirmier",
        href: "/booking?provider=doctor&mode=IN_PERSON",
        ctaLabel: "Au Cabinet",
        secondaryHref: "/booking?provider=doctor&mode=TELEHEALTH",
        secondaryCtaLabel: "Appel Vidéo",
        imageSrc: "/media/scenes/telehealth-video.webp",
      },
      {
        id: "care-action-clinics",
        category: "CARE_CENTER",
        badgeLabel: "Cliniques",
        badgeTone: "teal",
        title: "Cliniques de Quartier Vérifiées Près de Vous",
        plainHint: "Vérifiez si la clinique est ouverte avant de partir",
        subtitle: "Ouvrir les cliniques sur la carte et voir l'itinéraire",
        keywords:
          "clinic poliklinik medical center urgent care appointment casablanca rabat marrakech عيادة مصحة clinique",
        href: "/map?layer=CLINIC",
        ctaLabel: "Voir les Cliniques",
        imageSrc: "/media/facilities/clinic-interior.webp",
      },
      {
        id: "care-action-hospitals",
        category: "CARE_CENTER",
        badgeLabel: "Hôpitaux",
        badgeTone: "teal",
        title: "Hôpitaux d'Urgence & Blocs 24/7",
        plainHint: "Trouvez les hôpitaux ouverts jour et nuit autour de vous",
        subtitle: "Consulter les urgences et hôpitaux sur la carte en direct",
        keywords:
          "hospital chu trauma emergency inpatient surgery urgent care مستشفى سبيطار طوارئ hôpital urgences",
        href: "/map?layer=HOSPITAL",
        ctaLabel: "Voir les Hôpitaux",
        imageSrc: "/media/facilities/hospital-hub.webp",
      },
      {
        id: "care-action-pharmacies",
        category: "PHARMACY_LAB",
        badgeLabel: "Pharmacie 24/7",
        badgeTone: "amber",
        title: "Pharmacies de Garde & Ordonnances QR",
        plainHint: "Retrait Rx au comptoir (Loi 17-04) ou livraison parapharmacie",
        subtitle: "Valider un QR médical au comptoir ou commander des soins OTC",
        keywords:
          "pharmacy garde medication refill prescription aspirin insulin antibiotics delivery صيدلية حراسة دواء pharmacie médicament",
        href: "/pharmacy",
        ctaLabel: "Ouvrir la Pharmacie",
        imageSrc: "/media/facilities/pharmacy-interior.webp",
      },
      {
        id: "care-action-labs",
        category: "PHARMACY_LAB",
        badgeLabel: "Bilans & Radios",
        badgeTone: "slate",
        title: "Analyses de Sang, Radiologie & Laboratoires",
        plainHint: "Trouvez un laboratoire pour prises de sang, IRM ou radios",
        subtitle: "Localiser les laboratoires agréés et suivre vos comptes-rendus",
        keywords:
          "diagnostic lab laboratory blood panel mri xray scan analysis مختبر تحاليل راديو أشعة laboratoire analyses",
        href: "/map?layer=DIAGNOSTIC_LAB",
        ctaLabel: "Voir les Labos",
        imageSrc: "/media/scenes/diagnostic-imaging-lab.webp",
      },
    ];
  }

  return [
    {
      id: "care-action-ambulance",
      category: "DRIVER",
      badgeLabel: "Ambulance · 141",
      badgeTone: "red",
      title: "Emergency Ambulance & Medical Transport",
      plainHint: "Tap to see nearest ambulances moving on the street map",
      subtitle: "View live ambulances or trigger 1-Tap Fast Book",
      keywords:
        "ambulance driver 141 transport samu emergency urgent ride pickup إسعاف طوارئ urgence",
      href: "/map?layer=DRIVER",
      ctaLabel: "Open Live Map",
      imageSrc: "/media/vehicles/ambulance-van.webp",
    },
    {
      id: "care-action-doctors",
      category: "DOCTOR",
      badgeLabel: "Doctors & Home Nurses",
      badgeTone: "emerald",
      title: "General Practice, Heart Doctors & Home Nurses",
      plainHint: "Book a clinic workplace visit or video call with a doctor",
      subtitle: "Compare verified clinicians and reserve visits",
      keywords:
        "doctor nurse cardiology heart chest blood pressure pediatrics dermatology gp consultation home visit طبيب ممرض قلب طونسيو médecin infirmier",
      href: "/booking?provider=doctor&mode=IN_PERSON",
      ctaLabel: "Visit Workplace",
      secondaryHref: "/booking?provider=doctor&mode=TELEHEALTH",
      secondaryCtaLabel: "Video Call",
      imageSrc: "/media/scenes/telehealth-video.webp",
    },
    {
      id: "care-action-clinics",
      category: "CARE_CENTER",
      badgeLabel: "Clinics",
      badgeTone: "teal",
      title: "Verified Neighborhood Clinics Near You",
      plainHint: "Check if the clinic is open right now before leaving home",
      subtitle: "Open Clinics on the live map and inspect directions",
      keywords:
        "clinic poliklinik medical center urgent care appointment casablanca rabat marrakech عيادة مصحة clinique",
      href: "/map?layer=CLINIC",
      ctaLabel: "View Clinics",
      imageSrc: "/media/facilities/clinic-interior.webp",
    },
    {
      id: "care-action-hospitals",
      category: "CARE_CENTER",
      badgeLabel: "Hospitals",
      badgeTone: "teal",
      title: "24/7 Emergency Hospitals & Trauma Units",
      plainHint: "Find nearby hospitals open day and night",
      subtitle: "Check ER readiness and emergency hospital locations on the map",
      keywords:
        "hospital chu trauma emergency inpatient surgery urgent care مستشفى سبيطار طوارئ hôpital urgences",
      href: "/map?layer=HOSPITAL",
      ctaLabel: "View Hospitals",
      imageSrc: "/media/facilities/hospital-hub.webp",
    },
    {
      id: "care-action-pharmacies",
      category: "PHARMACY_LAB",
      badgeLabel: "24/7 Pharmacy",
      badgeTone: "amber",
      title: "Guard Pharmacies, QR Rx Pickup & OTC Care",
      plainHint: "Redeem doctor QR prescriptions at the counter (Law 17-04) or order OTC care",
      subtitle: "Counter QR prescription pickup & OTC parapharmacy delivery",
      keywords:
        "pharmacy garde medication refill prescription aspirin insulin antibiotics delivery صيدلية حراسة دواء pharmacie médicament",
      href: "/pharmacy",
      ctaLabel: "Open Pharmacy",
      imageSrc: "/media/facilities/pharmacy-interior.webp",
    },
    {
      id: "care-action-labs",
      category: "PHARMACY_LAB",
      badgeLabel: "Blood Tests & X-Rays",
      badgeTone: "slate",
      title: "Blood Tests, Radiology & Diagnostic Laboratories",
      plainHint: "Find labs for blood tests, MRI, or X-ray scans nearby",
      subtitle: "Locate accredited analytical labs and check test reports",
      keywords:
        "diagnostic lab laboratory blood panel mri xray scan analysis مختبر تحاليل راديو أشعة laboratoire analyses",
      href: "/map?layer=DIAGNOSTIC_LAB",
      ctaLabel: "View Labs",
      imageSrc: "/media/scenes/diagnostic-imaging-lab.webp",
    },
  ];
}

function isNurseSpecialty(specialty: string): boolean {
  return /nursing|infirmier|nurse/i.test(specialty);
}

/**
 * Plain-language visual Patient Care Hub uniting illustrated care pathways,
 * everyday search, real provider photos, live ride tracking, and private health records.
 */
export function PatientHubWorkspace({
  packs,
  apiBaseUrl,
}: PatientHubWorkspaceProps) {
  const { locale, t, isRtl } = useLocale();
  const copy = useMemo(() => getPatientUiCopy(locale), [locale]);

  const defaultCountry = resolveActivePack(packs)?.code ?? ACTIVE_COUNTRY_CODE;
  const [selectedCountry, setSelectedCountry] = useState<string>(defaultCountry);
  const [session, setSession] = useState<AuthResponse | null>(null);
  const [sessionHydrated, setSessionHydrated] = useState<boolean>(false);
  const [apiOnline, setApiOnline] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const setBanner = useToastSetter();

  const [appointments, setAppointments] = useState<AppointmentSummary[]>([]);
  const [dispatches, setDispatches] = useState<DispatchRequestSummary[]>([]);
  const [visitNotes, setVisitNotes] = useState<VisitNoteSummary[]>([]);
  const [prescriptions, setPrescriptions] = useState<PrescriptionSummary[]>([]);
  const [labOrders, setLabOrders] = useState<LabOrderSummary[]>([]);
  const [mediaFiles, setMediaFiles] = useState<ClinicalMediaObjectSummary[]>(
    [],
  );
  const [medicalProfile, setMedicalProfile] =
    useState<PatientMedicalProfile | null>(null);
  const [insurancePolicies, setInsurancePolicies] = useState<
    PatientInsurancePolicy[]
  >([]);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchCategory, setSearchCategory] =
    useState<PatientSearchCategory>("ALL");
  const [specialtyFilter, setSpecialtyFilter] = useState<string>("ALL");
  const [directoryDoctors, setDirectoryDoctors] = useState<
    DirectoryDoctorSummary[]
  >([]);
  const [directoryFacilities, setDirectoryFacilities] = useState<
    DirectoryFacilitySummary[]
  >([]);
  const [directoryDrivers, setDirectoryDrivers] = useState<
    DirectoryDriverSummary[]
  >([]);
  const [medicalServices, setMedicalServices] = useState<
    MedicalServiceSummary[]
  >([]);

  const bookmarks = useBookmarkedProviders(selectedCountry);
  const guestPasses = useGuestActivityPasses(selectedCountry);

  const activePack = useMemo(
    () => packs.find((pack) => pack.code === selectedCountry) ?? packs[0] ?? null,
    [packs, selectedCountry],
  );

  useEffect(() => {
    const stored = readStoredSession();
    if (stored) {
      setSession(stored);
      setSelectedCountry(resolveEffectiveCountryCode(stored.user.countryCode));
    }
    setSessionHydrated(true);
  }, []);

  useEffect(() => {
    if (!sessionHydrated) return;
    let active = true;
    async function loadPatientData() {
      const online = await checkBackendOnline();
      if (!active) return;
      setApiOnline(online);

      const currentVisitor = session?.user ?? null;
      if (
        !online ||
        (currentVisitor && !isConsumerUserOrGuest(currentVisitor))
      ) {
        setDirectoryDoctors([]);
        setDirectoryFacilities([]);
        setDirectoryDrivers([]);
        setMedicalServices([]);
        setAppointments([]);
        setDispatches([]);
        setVisitNotes([]);
        setPrescriptions([]);
        setLabOrders([]);
        setMediaFiles([]);
        setMedicalProfile(null);
        setInsurancePolicies([]);
        return;
      }

      const [docsRes, facsRes, drvsRes, svcRes] = await Promise.all([
        fetchDirectoryDoctors(apiBaseUrl, {
          countryCode: selectedCountry,
          limit: 50,
        }),
        fetchDirectoryFacilities(apiBaseUrl, {
          countryCode: selectedCountry,
          limit: 50,
        }),
        fetchDirectoryDrivers(apiBaseUrl, {
          countryCode: selectedCountry,
          limit: 50,
        }),
        fetchMedicalServices(apiBaseUrl, {
          countryCode: selectedCountry,
          limit: 50,
        }),
      ]);
      if (!active) return;
      if (docsRes.ok) setDirectoryDoctors(docsRes.doctors);
      if (facsRes.ok) setDirectoryFacilities(facsRes.facilities);
      if (drvsRes.ok) setDirectoryDrivers(drvsRes.drivers);
      if (svcRes.ok) setMedicalServices(svcRes.services);

      if (!session?.token) {
        setAppointments([]);
        setDispatches([]);
        setVisitNotes([]);
        setPrescriptions([]);
        setLabOrders([]);
        setMediaFiles([]);
        setMedicalProfile(null);
        setInsurancePolicies([]);
        return;
      }

      let activeSession = session;
      if (isPendingStaffVerification(activeSession.user)) {
        const syncRes = await syncPendingSessionStatus(
          apiBaseUrl,
          activeSession,
        );
        if (!active) return;
        if (syncRes.status === "expired") {
          setSession(null);
          return;
        }
        if (syncRes.status === "updated" && syncRes.session) {
          activeSession = syncRes.session;
          setSession(syncRes.session);
        }
      }

      const activeUser = activeSession.user;
      const allowAppointments = canReadAppointments(activeUser);
      const allowDispatch = canReadDispatchFeed(activeUser);
      const allowNotes = canReadVisitNotes(activeUser);
      const allowRx = canReadPrescriptions(activeUser);
      const allowLabs = canReadLabOrders(activeUser);
      const allowEhr = canReadClinicalEhr(activeUser);

      if (
        !allowAppointments &&
        !allowDispatch &&
        !allowNotes &&
        !allowRx &&
        !allowLabs &&
        !allowEhr
      ) {
        setAppointments([]);
        setDispatches([]);
        setVisitNotes([]);
        setPrescriptions([]);
        setLabOrders([]);
        setMediaFiles([]);
        setMedicalProfile(null);
        setInsurancePolicies([]);
        return;
      }

      setLoading(true);
      const token = activeSession.token;
      const [
        apptRes,
        dispatchRes,
        notesRes,
        rxRes,
        labsRes,
        mediaRes,
        profileRes,
        insurancesRes,
      ] = await Promise.all([
        allowAppointments
          ? fetchAppointments(apiBaseUrl, token, selectedCountry)
          : Promise.resolve(null),
        allowDispatch
          ? listDispatchRequests(apiBaseUrl, token, selectedCountry)
          : Promise.resolve(null),
        allowNotes
          ? fetchVisitNotes(apiBaseUrl, token, selectedCountry)
          : Promise.resolve(null),
        allowRx
          ? fetchPrescriptions(apiBaseUrl, token, selectedCountry)
          : Promise.resolve(null),
        allowLabs
          ? fetchLabOrders(apiBaseUrl, token, selectedCountry)
          : Promise.resolve(null),
        allowLabs
          ? fetchClinicalMedia(apiBaseUrl, token, selectedCountry)
          : Promise.resolve(null),
        allowEhr
          ? fetchMyPatientProfile(apiBaseUrl, token)
          : Promise.resolve(null),
        allowEhr
          ? listMyPatientInsurances(apiBaseUrl, token)
          : Promise.resolve(null),
      ]);
      if (!active) return;
      setLoading(false);

      setAppointments(apptRes && apptRes.ok ? apptRes.data.appointments : []);
      setDispatches(
        dispatchRes && dispatchRes.ok ? dispatchRes.data.dispatches : [],
      );
      setVisitNotes(notesRes && notesRes.ok ? notesRes.data.visitNotes : []);
      setPrescriptions(rxRes && rxRes.ok ? rxRes.data.prescriptions : []);
      setLabOrders(labsRes && labsRes.ok ? labsRes.data.labOrders : []);
      setMediaFiles(mediaRes && mediaRes.ok ? mediaRes.data.mediaObjects : []);
      setMedicalProfile(
        profileRes && profileRes.ok ? profileRes.data.profile : null,
      );
      setInsurancePolicies(
        insurancesRes && insurancesRes.ok ? insurancesRes.data.policies : [],
      );

      const hasUnauthorized = [
        apptRes,
        dispatchRes,
        notesRes,
        rxRes,
        labsRes,
        mediaRes,
        profileRes,
        insurancesRes,
      ].some((res) => res !== null && !res.ok && res.status === 401);

      if (hasUnauthorized) {
        clearStoredSession();
        setSession(null);
        setBanner({
          tone: "warning",
          text:
            locale === "ar"
              ? "انتهت صلاحية الجلسة. تبقى المفضلة وتذاكر المتابعة المحلية محفوظة على جهازك."
              : locale === "fr"
                ? "Votre session a expiré. Vos favoris et suivis locaux restent enregistrés sur cet appareil."
                : "Your sign-in session expired. Local bookmarks and guest passes remain saved on this device.",
        });
      }
    }
    void loadPatientData();
    return () => {
      active = false;
    };
  }, [apiBaseUrl, locale, selectedCountry, session, sessionHydrated, setBanner]);

  const activeAppointments = useMemo(() => {
    return appointments
      .filter((a) => a.status !== "CANCELLED" && a.status !== "NO_SHOW")
      .sort((a, b) => Date.parse(a.slotStartIso) - Date.parse(b.slotStartIso));
  }, [appointments]);

  const activeDispatches = useMemo(
    () =>
      dispatches.filter(
        (d) => d.status !== "CANCELLED" && d.status !== "COMPLETED",
      ),
    [dispatches],
  );

  const specialtyOptions = useMemo(
    () =>
      buildSpecialtyFilterOptions(
        directoryDoctors.map((d) => d.specialty),
        locale,
        { includeNurse: false },
      ),
    [directoryDoctors, locale],
  );

  const searchableCatalog = useMemo<PatientSearchResultItem[]>(() => {
    const items: PatientSearchResultItem[] = [];
    const verifiedCareFallback =
      locale === "ar"
        ? "عيادة معتمدة"
        : locale === "fr"
          ? "Soins vérifiés"
          : "Verified Care";
    const readyNearbyFallback =
      locale === "ar"
        ? "متاح بالقرب منك"
        : locale === "fr"
          ? "Disponible à proximité"
          : "Ready nearby";

    for (const doc of directoryDoctors) {
      const isNurse = isNurseSpecialty(doc.specialty);
      const specLabel = isNurse
        ? copy.requestNurseLabel
        : formatSpecialtyLabel(doc.specialty, locale);
      const plainSpec = formatPlainSpecialty(doc.specialty, locale);
      items.push({
        id: `doc-${doc.id}`,
        category: "DOCTOR",
        badgeLabel: specLabel,
        badgeTone: "emerald",
        title: doc.fullName,
        plainHint: `${plainSpec} · ${doc.facilityName ?? verifiedCareFallback}`,
        subtitle: `${specLabel} · ${doc.facilityName ?? verifiedCareFallback}`,
        keywords: `${doc.fullName} ${doc.specialty} ${specLabel} ${plainSpec} ${getSpecialtyKeywords(doc.specialty)} ${doc.facilityName ?? ""} ${doc.facilityCity ?? ""} ${expandMoroccanCityKeywords(doc.facilityCity)} doctor nurse`,
        specialty: doc.specialty,
        href: isNurse
          ? `/booking?doctorId=${encodeURIComponent(doc.id)}&provider=nurse`
          : `/booking?doctorId=${encodeURIComponent(doc.id)}&mode=IN_PERSON`,
        ctaLabel: isNurse ? copy.requestNurseLabel : copy.visitWorkplaceLabel,
        ...(!isNurse && doc.telehealthEnabled
          ? {
              secondaryHref: `/booking?doctorId=${encodeURIComponent(doc.id)}&mode=TELEHEALTH`,
              secondaryCtaLabel: copy.videoCallLabel,
            }
          : {}),
        imageSrc: doc.avatarUrl ?? "/media/avatars/doctor-female.webp",
        avatarName: doc.fullName,
        avatarRole: "DOCTOR",
        avatarSpecialty: doc.specialty,
      });
    }

    for (const drv of directoryDrivers) {
      items.push({
        id: `drv-${drv.id}`,
        category: "DRIVER",
        badgeLabel:
          drv.vehicleType === "AMBULANCE"
            ? locale === "ar"
              ? "إسعاف · 141"
              : "Ambulance · 141"
            : locale === "ar"
              ? "نقل طبي"
              : locale === "fr"
                ? "Transport Médical"
                : "Medical Ride",
        badgeTone: "red",
        title: `${drv.fullName} · ${drv.vehicleLabel}`,
        plainHint: `${drv.serviceZone} · ${drv.facilityName ?? readyNearbyFallback}`,
        subtitle: drv.serviceZone,
        keywords: `${drv.fullName} ${drv.vehicleLabel} ${drv.serviceZone} ${drv.facilityCity ?? ""} ${expandMoroccanCityKeywords(drv.facilityCity)} ${drv.vehicleType} ambulance driver 141`,
        href: "/map?layer=DRIVER",
        ctaLabel: copy.seeOnMapLabel,
        imageSrc: resolveVehiclePicture(drv.vehicleType),
      });
    }

    for (const fac of directoryFacilities) {
      const isPharmLab =
        fac.kind === "PHARMACY" || fac.kind === "DIAGNOSTIC_LAB";
      items.push({
        id: `fac-${fac.id}`,
        category: isPharmLab ? "PHARMACY_LAB" : "CARE_CENTER",
        badgeLabel: formatFacilityKind(fac.kind, locale),
        badgeTone: fac.kind === "PHARMACY" ? "amber" : "teal",
        title: fac.name,
        plainHint: `${fac.address} · ${fac.acceptedInsurances.join(", ")}`,
        subtitle: fac.address,
        keywords: `${fac.name} ${fac.kind} ${formatFacilityKind(fac.kind, locale)} ${fac.address} ${fac.city ?? ""} ${expandMoroccanCityKeywords(fac.city)} ${fac.acceptedInsurances.join(" ")} lab pharmacy hospital clinic`,
        href:
          fac.kind === "PHARMACY"
            ? `/pharmacy?facilityId=${encodeURIComponent(fac.id)}`
            : `/map?layer=${encodeURIComponent(fac.kind)}&facilityId=${encodeURIComponent(fac.id)}`,
        ctaLabel:
          fac.kind === "PHARMACY" ? copy.openPharmacyLabel : copy.seeOnMapLabel,
        imageSrc: resolveFacilityPicture(fac.kind),
      });
    }

    for (const svc of medicalServices) {
      const cat: Exclude<PatientSearchCategory, "ALL"> =
        svc.category === "AMBULANCE"
          ? "DRIVER"
          : svc.category === "PHARMACY_SERVICE" ||
              svc.category === "LAB_TEST" ||
              svc.category === "IMAGING"
            ? "PHARMACY_LAB"
            : svc.category === "HOME_CARE"
              ? "DOCTOR"
              : "CARE_CENTER";
      items.push({
        id: `svc-${svc.id}`,
        category: cat,
        badgeLabel: svc.specialty
          ? formatSpecialtyLabel(svc.specialty, locale)
          : svc.category.replace("_", " "),
        badgeTone: svc.category === "AMBULANCE" ? "red" : "teal",
        title: svc.name,
        plainHint: `${svc.facilityName} · ${svc.durationMinutes} min`,
        subtitle: svc.facilityName,
        keywords: `${svc.name} ${svc.facilityName} ${svc.specialty ?? ""} ${svc.specialty ? getSpecialtyKeywords(svc.specialty) : ""} ${svc.description ?? ""} ${svc.category}`,
        ...(svc.specialty ? { specialty: svc.specialty } : {}),
        href:
          svc.category === "AMBULANCE"
            ? "/map?layer=DRIVER"
            : `/booking?facilityId=${encodeURIComponent(svc.facilityId)}`,
        ctaLabel:
          svc.category === "AMBULANCE" ? copy.seeOnMapLabel : copy.bookNowLabel,
        imageSrc:
          svc.category === "AMBULANCE"
            ? "/media/vehicles/ambulance-van.webp"
            : "/media/scenes/diagnostic-imaging-lab.webp",
      });
    }

    return [...buildStaticCareResults(locale), ...items];
  }, [
    copy.bookNowLabel,
    copy.openPharmacyLabel,
    copy.requestNurseLabel,
    copy.seeOnMapLabel,
    copy.videoCallLabel,
    copy.visitWorkplaceLabel,
    directoryDoctors,
    directoryDrivers,
    directoryFacilities,
    locale,
    medicalServices,
  ]);

  const normalizedQuery = normalizeCityText(searchQuery);
  const isSearchActive =
    normalizedQuery.length > 0 ||
    searchCategory !== "ALL" ||
    specialtyFilter !== "ALL";

  const filteredSearchResults = useMemo(() => {
    if (!isSearchActive) return [];
    const tokens = normalizedQuery.split(/\s+/).filter(Boolean);
    return searchableCatalog
      .filter((item) => {
        if (searchCategory !== "ALL" && item.category !== searchCategory) {
          return false;
        }
        if (specialtyFilter !== "ALL") {
          if (
            !item.specialty ||
            !matchesDoctorSpecialtyFilter(item.specialty, specialtyFilter)
          ) {
            return false;
          }
        }
        if (tokens.length === 0) return true;
        const haystack = normalizeCityText(
          `${item.title} ${item.plainHint} ${item.subtitle} ${item.badgeLabel} ${item.keywords}`,
        );
        return tokens.every((tok) => haystack.includes(tok));
      })
      .slice(0, 8);
  }, [
    isSearchActive,
    normalizedQuery,
    searchCategory,
    searchableCatalog,
    specialtyFilter,
  ]);

  function handleSignOut() {
    revokeClientSession(apiBaseUrl);
    setSession(null);
    setBanner({
      tone: "info",
      text: copy.signedOutNotice,
    });
  }

  const isBlockedStaffVisitor =
    sessionHydrated &&
    Boolean(session?.user) &&
    !isConsumerUserOrGuest(session?.user);

  const hotline = activePack?.emergencyHotlines.ambulance ?? "141";
  const displayCountryName = formatCountryDisplayName(
    selectedCountry,
    activePack?.name ?? selectedCountry,
    locale,
  );

  return (
    <div dir={isRtl ? "rtl" : "ltr"} className="space-y-5">
      <WorkspaceHeader
        title={t("patient.heading")}
        countryCode={selectedCountry}
        countryName={displayCountryName}
        currencyCode={activePack?.currencyCode ?? selectedCountry}
        emergencyHotline={hotline}
        user={session?.user ?? null}
        guestLabel={copy.guestLabel}
        onSignOut={handleSignOut}
        actions={
          isBlockedStaffVisitor ? null : (
            <div className="flex flex-wrap items-center gap-1.5">
              <Link
                href="/map?fastBook=1"
                className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-[#0066CC] px-4 text-xs font-semibold text-white shadow-2xs transition hover:bg-[#0052A3]"
              >
                <Ambulance className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{copy.fastBookHeaderCta}</span>
              </Link>
              <Link
                href="/booking"
                className="hidden h-10 items-center rounded-xl bg-[#F3F8FD] border border-[#D7E4F2] px-4 text-xs font-semibold text-slate-800 transition hover:bg-[#E1EBF2] hover:text-[#0066CC] sm:inline-flex"
              >
                {copy.reserveHeaderCta}
              </Link>
            </div>
          )
        }
      />

      <ConsumerWorkspaceGuard
        user={session?.user ?? null}
        hydrated={sessionHydrated}
        surfaceTitle={t("patient.heading")}
        onSignOut={handleSignOut}
      >
        <VerificationGateNotice user={session?.user} compact />

        {/* Wrap-safe Page Menu without misleading /map highlight or clipped pills */}
        <nav
          aria-label="Patient homepage menu"
          className="flex flex-wrap items-center gap-1.5"
        >
          {copy.navItems.map((item) => {
            const isMapLink = item.href.startsWith("/map");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`inline-flex h-9 items-center gap-1.5 rounded-xl px-3.5 text-xs font-semibold transition-colors ${
                  item.isCurrent
                    ? "bg-[#0066CC] text-white"
                    : "bg-slate-100/90 text-slate-700 hover:bg-emerald-50 hover:text-[#0066CC]"
                }`}
              >
                {item.isCurrent ? (
                  <Compass className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                ) : isMapLink ? (
                  <MapPin className="h-3.5 w-3.5 shrink-0 text-[#0066CC]" aria-hidden="true" />
                ) : null}
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* 1. Visual "What Do You Need Today?" Picture Guide */}
        <CareGuideGrid copy={copy} emergencyHotline={hotline} />

        {/* 2. Plain-Language Universal Search */}
        <PatientSearchSection
          copy={copy}
          searchQuery={searchQuery}
          onSearchQueryChange={setSearchQuery}
          searchCategory={searchCategory}
          onSearchCategoryChange={setSearchCategory}
          specialtyFilter={specialtyFilter}
          onSpecialtyFilterChange={setSpecialtyFilter}
          specialtyOptions={specialtyOptions}
          isSearchActive={isSearchActive}
          filteredResults={filteredSearchResults}
        />

        {/* 3. Real Nearby Doctors, Nurses & Open Places */}
        <NearbyCareStrip
          copy={copy}
          locale={locale}
          doctors={directoryDoctors}
          facilities={directoryFacilities}
        />

        {/* 4. Upcoming Visits, Live Rides & Saved Team */}
        <PatientActivitySection
          copy={copy}
          activeAppointments={activeAppointments}
          activeDispatches={activeDispatches}
          guestPasses={guestPasses}
          bookmarks={bookmarks}
        />

        {/* 5. Personal Health Folder */}
        <PatientHealthFolderSection
          copy={copy}
          locale={locale}
          session={session}
          apiOnline={apiOnline}
          loading={loading}
          prescriptions={prescriptions}
          mediaFiles={mediaFiles}
          visitNotes={visitNotes}
          labOrders={labOrders}
        />

        {/* 6. Emergency Safety Card & Health Insurance */}
        {session && apiOnline && canReadClinicalEhr(session.user) ? (
          <PatientSafetySection
            key={medicalProfile?.updatedAtIso ?? session.user.id}
            copy={copy}
            locale={locale}
            apiBaseUrl={apiBaseUrl}
            token={session.token}
            medicalProfile={medicalProfile}
            insurancePolicies={insurancePolicies}
            onProfileUpdated={setMedicalProfile}
            onPolicyAdded={(policy) =>
              setInsurancePolicies((prev) => [policy, ...prev])
            }
          />
        ) : null}
      </ConsumerWorkspaceGuard>
    </div>
  );
}
