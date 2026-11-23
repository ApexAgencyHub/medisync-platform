"use client";

import Link from "next/link";
import {
  Ambulance,
  ArrowRight,
  ArrowUpRight,
  Building2,
  FlaskConical,
  HeartPulse,
  MapPin,
  Pill,
  ShieldCheck,
  Stethoscope,
} from "lucide-react";
import { ACTIVE_COUNTRY_CODE } from "@/shared/config/deployment";
import { useLocale } from "@/shared/i18n/locale-store";
import { UiLinkButton } from "@/shared/ui/primitives";

const NETWORK_COPY = {
  en: {
    trustItems: [
      { id: "verified" as const, label: "Verified Doctors & Clinics" },
      { id: "emergency" as const, label: "24/7 Emergency 141 & Hospitals" },
      { id: "pharmacy" as const, label: "Signed QR Prescriptions" },
      { id: "insurance" as const, label: "AMO · CNOPS · CNSS Accepted" },
    ],
    eyebrow: "Verified Medical Network",
    heading: "Every care service, connected on one map.",
    fullMapCta: "Explore Live Map",
    cards: [
      {
        code: "01",
        pinKind: "ambulance" as const,
        status: "Emergency 141 · 24/7",
        hubLabel: "CHU Ibn Rochd Emergency Hub",
        title: "Medical Transport & 141",
        detail: "Live ambulance GPS dispatch and direct hospital routing.",
        href: "/map",
        cta: "Open Map",
        secondaryHref: "/map?layer=DRIVER",
        secondaryCta: "Live Fleet",
        img: "/media/vehicles/ambulance-van.webp",
        alt: "Emergency ambulance parked outside hospital emergency entrance",
      },
      {
        code: "02",
        pinKind: "clinic" as const,
        status: "Verified Specialists",
        hubLabel: "Clinique Anfa Cardiology & Care",
        title: "Doctors & Video Visits",
        detail: "Verified clinics, instant slots, and secure video consultations.",
        href: "/booking",
        cta: "Book Doctor",
        secondaryHref: "/profiles",
        secondaryCta: "Directory",
        img: "/media/scenes/telehealth-video.webp",
        alt: "Doctor conducting a video consultation on tablet",
      },
      {
        code: "03",
        pinKind: "pharmacy" as const,
        status: "Duty Pharmacy · 24/7",
        hubLabel: "Pharmacie Maarif 24/7",
        title: "24/7 Pharmacy & QR Rx",
        detail: "On-duty pharmacies, counter QR Rx dispensing (Law 17-04) & OTC delivery.",
        href: "/pharmacy",
        cta: "Pharmacy",
        secondaryHref: "/patient",
        secondaryCta: "My Care",
        img: "/media/facilities/pharmacy-qr-fulfillment.jpg",
        alt: "Pharmacy counter with prepared prescription parcel and tablet",
      },
    ],
    portals: [
      {
        id: "patient" as const,
        title: "Patient Portal",
        detail: "Appointments, medical records & QR prescriptions",
        href: "/patient",
      },
      {
        id: "lab" as const,
        title: "Diagnostic Labs",
        detail: "Blood panels, imaging centers & verified digital results",
        href: "/profiles?category=DIAGNOSTIC_LAB",
      },
      {
        id: "hospital" as const,
        title: "Hospitals & Clinics",
        detail: "Emergency triage intake, beds & live facility status",
        href: "/profiles?category=HOSPITAL",
      },
      {
        id: "pro" as const,
        title: "Medical Partners",
        detail: "Verified onboarding for doctors, nurses, pharmacies & drivers",
        href: "/pro",
      },
    ],
  },
  fr: {
    trustItems: [
      { id: "verified" as const, label: "Médecins & Cliniques Vérifiés" },
      { id: "emergency" as const, label: "Urgences 141 & Hôpitaux 24/7" },
      { id: "pharmacy" as const, label: "Ordonnances QR Signées" },
      { id: "insurance" as const, label: "AMO · CNOPS · CNSS Acceptés" },
    ],
    eyebrow: "Réseau Médical Vérifié",
    heading: "Tous vos services de santé réunis sur une carte.",
    fullMapCta: "Explorer la Carte",
    cards: [
      {
        code: "01",
        pinKind: "ambulance" as const,
        status: "Urgences 141 · 24/7",
        hubLabel: "CHU Ibn Rochd Emergency Hub",
        title: "Transport & Urgences 141",
        detail: "Suivi GPS des ambulances et guidage hospitalier en direct.",
        href: "/map",
        cta: "Ouvrir la Carte",
        secondaryHref: "/map?layer=DRIVER",
        secondaryCta: "Flotte Direct",
        img: "/media/vehicles/ambulance-van.webp",
        alt: "Ambulance stationnée devant l'entrée des urgences",
      },
      {
        code: "02",
        pinKind: "clinic" as const,
        status: "Spécialistes Vérifiés",
        hubLabel: "Clinique Anfa Cardiology & Care",
        title: "Médecins & Vidéo",
        detail: "Cliniques vérifiées, créneaux directs et téléconsultation.",
        href: "/booking",
        cta: "Prendre RDV",
        secondaryHref: "/profiles",
        secondaryCta: "Annuaire",
        img: "/media/scenes/telehealth-video.webp",
        alt: "Médecin en téléconsultation sur tablette",
      },
      {
        code: "03",
        pinKind: "pharmacy" as const,
        status: "Pharmacie de Garde 24/7",
        hubLabel: "Pharmacie Maarif 24/7",
        title: "Pharmacies 24/7 & QR",
        detail: "Officines de garde, délivrance Rx au comptoir (Loi 17-04) & parapharmacie.",
        href: "/pharmacy",
        cta: "Pharmacies",
        secondaryHref: "/patient",
        secondaryCta: "Mon Espace",
        img: "/media/facilities/pharmacy-qr-fulfillment.jpg",
        alt: "Comptoir de pharmacie moderne avec commande préparée",
      },
    ],
    portals: [
      {
        id: "patient" as const,
        title: "Espace Patient",
        detail: "Rendez-vous, dossier médical & ordonnances QR signées",
        href: "/patient",
      },
      {
        id: "lab" as const,
        title: "Laboratoires",
        detail: "Analyses, imagerie médicale & résultats numériques vérifiés",
        href: "/profiles?category=DIAGNOSTIC_LAB",
      },
      {
        id: "hospital" as const,
        title: "Hôpitaux & Cliniques",
        detail: "Accueil urgences, triage & disponibilité en temps réel",
        href: "/profiles?category=HOSPITAL",
      },
      {
        id: "pro" as const,
        title: "Partenaires Médicaux",
        detail: "Portail vérifié pour médecins, infirmiers et chauffeurs",
        href: "/pro",
      },
    ],
  },
  ar: {
    trustItems: [
      { id: "verified" as const, label: "أطباء وعيادات معتمدون" },
      { id: "emergency" as const, label: "إسعاف 141 ومستشفيات 24/7" },
      { id: "pharmacy" as const, label: "وصفات طبية برمز QR موثق" },
      { id: "insurance" as const, label: "تغطية AMO · CNOPS · CNSS" },
    ],
    eyebrow: "شبكة الرعاية الطبية المعتمدة",
    heading: "جميع خدماتك الصحية على خريطة واحدة مباشرة.",
    fullMapCta: "استكشاف الخريطة",
    cards: [
      {
        code: "01",
        pinKind: "ambulance" as const,
        status: "إسعاف 141 · 24/7",
        hubLabel: "CHU Ibn Rochd Emergency Hub",
        title: "النقل الطبي وإسعاف 141",
        detail: "تتبع مباشر لسيارات الإسعاف وتوجيه نحو المستشفيات.",
        href: "/map",
        cta: "الخريطة",
        secondaryHref: "/map?layer=DRIVER",
        secondaryCta: "الأسطول المباشر",
        img: "/media/vehicles/ambulance-van.webp",
        alt: "سيارة إسعاف أمام قسم الطوارئ",
      },
      {
        code: "02",
        pinKind: "clinic" as const,
        status: "أطباء معتمدون",
        hubLabel: "Clinique Anfa Cardiology & Care",
        title: "الأطباء والاستشارة عن بعد",
        detail: "عيادات معتمدة، مواعيد مباشرة واستشارات فيديو آمنة.",
        href: "/booking",
        cta: "حجز موعد",
        secondaryHref: "/profiles",
        secondaryCta: "الدليل",
        img: "/media/scenes/telehealth-video.webp",
        alt: "طبيبة تجري استشارة عبر الفيديو",
      },
      {
        code: "03",
        pinKind: "pharmacy" as const,
        status: "صيدلية حراسة 24/7",
        hubLabel: "Pharmacie Maarif 24/7",
        title: "الصيدليات 24/7 ووصفات QR",
        detail: "صيدليات الحراسة، صرف الوصفات بالصيدلية (قانون 17-04) وتوصيل شبه الصيدلية.",
        href: "/pharmacy",
        cta: "الصيدليات",
        secondaryHref: "/patient",
        secondaryCta: "ملفي الصحي",
        img: "/media/facilities/pharmacy-qr-fulfillment.jpg",
        alt: "مكتب صيدلية مع طلب دوائي جاهز",
      },
    ],
    portals: [
      {
        id: "patient" as const,
        title: "بوابة المريض",
        detail: "المواعيد، السجل الطبي الرقمي ووصفات QR المعتمدة",
        href: "/patient",
      },
      {
        id: "lab" as const,
        title: "مختبرات التحاليل",
        detail: "التحاليل الطبية، الأشعة والنتائج الرقمية الموثقة",
        href: "/profiles?category=DIAGNOSTIC_LAB",
      },
      {
        id: "hospital" as const,
        title: "المستشفيات والعيادات",
        detail: "استقبال الطوارئ، الفرز الطبي وحالة المرافق المباشرة",
        href: "/profiles?category=HOSPITAL",
      },
      {
        id: "pro" as const,
        title: "الشركاء الطبيون",
        detail: "تسجيل معتمد للأطباء، الممرضين، الصيادلة والسائقين",
        href: "/pro",
      },
    ],
  },
} as const;

const TRUST_STYLES = {
  verified: { icon: ShieldCheck, wrap: "bg-[#EBF4FF] text-[#0066CC]" },
  emergency: { icon: HeartPulse, wrap: "bg-rose-50 text-[#DC2626]" },
  pharmacy: { icon: Pill, wrap: "bg-[#E6F7F4] text-[#0F9D88]" },
  insurance: { icon: Stethoscope, wrap: "bg-[#EBF4FF] text-[#0066CC]" },
} as const;

const PIN_STYLES = {
  ambulance: {
    badgeBg: "bg-[#DC2626]",
    pill: "bg-rose-50 text-[#B91C1C] border-rose-200",
    dot: "bg-[#DC2626]",
    icon: Ambulance,
  },
  clinic: {
    badgeBg: "bg-[#0066CC]",
    pill: "bg-[#EBF4FF] text-[#0052A3] border-[#BFDBFE]",
    dot: "bg-[#0066CC]",
    icon: Stethoscope,
  },
  pharmacy: {
    badgeBg: "bg-[#0F9D88]",
    pill: "bg-[#E6F7F4] text-[#0B6B5C] border-[#B2E5DC]",
    dot: "bg-[#0F9D88]",
    icon: Pill,
  },
} as const;

const PORTAL_ICONS = {
  patient: HeartPulse,
  lab: FlaskConical,
  hospital: Building2,
  pro: ShieldCheck,
} as const;

export function ServicePillarsShowcase() {
  const { locale, isRtl } = useLocale();
  const copy = NETWORK_COPY[locale] ?? NETWORK_COPY.en;

  const withCountry = (href: string) => {
    const sep = href.includes("?") ? "&" : "?";
    return `${href}${sep}country=${encodeURIComponent(ACTIVE_COUNTRY_CODE)}`;
  };

  return (
    <section
      dir={isRtl ? "rtl" : "ltr"}
      aria-label="Core Care Networks"
      className="bg-[#F3F8FD] text-[#0F243E]"
    >
      {/* Pure White Medical Trust & Coverage Strip */}
      <div className="border-b border-[#D7E4F2] bg-white">
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-2 px-4 py-3 sm:px-6 lg:grid-cols-4 lg:gap-3 lg:px-8">
          {copy.trustItems.map((item) => {
            const style = TRUST_STYLES[item.id];
            const Icon = style.icon;
            return (
              <div
                key={item.id}
                className="flex items-center gap-2 rounded-xl border border-[#E8F1FA] bg-[#F8FBFE] px-2.5 py-2 xl:px-3 xl:py-2.5"
              >
                <span
                  className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg xl:h-8 xl:w-8 ${style.wrap}`}
                >
                  <Icon className="h-3.5 w-3.5 xl:h-4 xl:w-4" aria-hidden="true" />
                </span>
                <span className="truncate text-[11.5px] font-semibold text-[#0F243E] xl:text-xs">
                  {item.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10 xl:px-8 xl:py-14">
        {/* Clean Clinical Section Header */}
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div className="min-w-0">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[#BFDBFE] bg-[#EBF4FF] px-2.5 py-0.5 text-[11px] font-semibold text-[#0052A3] xl:px-3 xl:py-1 xl:text-xs">
              <HeartPulse className="h-3.5 w-3.5 text-[#0066CC]" aria-hidden="true" />
              <span>{copy.eyebrow}</span>
            </span>
            <h2 className="font-editorial mt-2 text-xl font-bold leading-tight tracking-[-0.025em] text-[#0F243E] sm:text-2xl xl:text-3xl">
              {copy.heading}
            </h2>
          </div>

          <UiLinkButton
            href={withCountry("/map")}
            variant="outline"
            size="sm"
            className="shrink-0 self-start bg-white sm:self-auto"
          >
            <MapPin
              className="h-4 w-4 shrink-0 text-[#0066CC]"
              aria-hidden="true"
            />
            <span>{copy.fullMapCta}</span>
            <ArrowRight
              className="h-3.5 w-3.5 rtl:rotate-180"
              aria-hidden="true"
            />
          </UiLinkButton>
        </div>

        {/* 3-Column Pure White Medical Service Cards */}
        <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3 xl:gap-5">
          {copy.cards.map((card) => {
            const pin = PIN_STYLES[card.pinKind];
            const PinIcon = pin.icon;
            return (
              <article
                key={card.code}
                className="flex flex-col overflow-hidden rounded-2xl border border-[#D7E4F2] bg-white shadow-[0_12px_32px_-16px_rgba(15,36,62,0.14)]"
              >
                {/* Clean Medical Media Frame with Floating Hub Badge */}
                <div className="relative bg-[#F3F8FD]">
                  <img
                    src={card.img}
                    alt={card.alt}
                    className="aspect-[16/9] w-full object-cover object-center xl:aspect-[16/10]"
                  />
                  <div className="absolute top-2.5 start-2.5 inline-flex items-center gap-1.5 rounded-full border border-white/80 bg-white/95 px-2.5 py-0.5 text-[10.5px] font-semibold text-[#0F243E] shadow-sm backdrop-blur-md xl:top-3 xl:start-3 xl:py-1 xl:text-[11px]">
                    <span
                      className={`inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-white xl:h-5 xl:w-5 ${pin.badgeBg}`}
                    >
                      <PinIcon className="h-2.5 w-2.5 xl:h-3 xl:w-3" aria-hidden="true" />
                    </span>
                    <span>{card.status}</span>
                  </div>
                  <div className="absolute bottom-2.5 start-2.5 inline-flex max-w-[calc(100%-1.25rem)] items-center gap-1.5 rounded-full border border-white/80 bg-white/95 px-2.5 py-0.5 text-[10.5px] font-semibold text-[#0F243E] shadow-sm backdrop-blur-md xl:bottom-3 xl:start-3 xl:px-3 xl:py-1 xl:text-[11px]">
                    <span
                      aria-hidden="true"
                      className={`h-1.5 w-1.5 shrink-0 rounded-full xl:h-2 xl:w-2 ${pin.dot}`}
                    />
                    <span className="truncate">{card.hubLabel}</span>
                  </div>
                </div>

                {/* Concise Medical Action Body */}
                <div className="flex flex-1 flex-col justify-between p-4 xl:p-5">
                  <div>
                    <h3 className="line-clamp-1 font-editorial text-base font-bold leading-snug tracking-[-0.02em] text-[#0F243E] xl:text-lg">
                      {card.title}
                    </h3>
                    <p className="mt-1 line-clamp-2 text-xs leading-snug text-[#4A627D] xl:text-[13px] xl:leading-relaxed">
                      {card.detail}
                    </p>
                  </div>

                  <div className="mt-3.5 flex flex-wrap items-center gap-2 border-t border-[#E8F1FA] pt-3 xl:mt-4 xl:pt-3.5">
                    <UiLinkButton
                      href={withCountry(card.href)}
                      variant="primary"
                      size="sm"
                      className="flex-1 justify-center"
                    >
                      <span>{card.cta}</span>
                      <ArrowRight
                        className="h-3.5 w-3.5 rtl:rotate-180"
                        aria-hidden="true"
                      />
                    </UiLinkButton>
                    <UiLinkButton
                      href={withCountry(card.secondaryHref)}
                      variant="outline"
                      size="sm"
                    >
                      <span>{card.secondaryCta}</span>
                    </UiLinkButton>
                  </div>
                </div>
              </article>
            );
          })}
        </div>

        {/* Dedicated Clinical Portals Row */}
        <div className="mt-6 grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
          {copy.portals.map((portal) => {
            const Icon = PORTAL_ICONS[portal.id];
            return (
              <Link
                key={portal.id}
                href={withCountry(portal.href)}
                className="group flex items-start justify-between gap-3 rounded-2xl border border-[#D7E4F2] bg-white p-4 shadow-2xs transition-all hover:border-[#0066CC] hover:shadow-[0_10px_24px_-12px_rgba(0,102,204,0.2)]"
              >
                <div className="flex min-w-0 items-start gap-3">
                  <span className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#EBF4FF] text-[#0066CC] transition-colors group-hover:bg-[#0066CC] group-hover:text-white">
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-[#0F243E] group-hover:text-[#0066CC]">
                      {portal.title}
                    </p>
                    <p className="mt-0.5 text-xs leading-snug text-[#556E89]">
                      {portal.detail}
                    </p>
                  </div>
                </div>
                <ArrowUpRight
                  className="mt-0.5 h-4 w-4 shrink-0 text-[#87A0BC] transition-colors group-hover:text-[#0066CC]"
                  aria-hidden="true"
                />
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
