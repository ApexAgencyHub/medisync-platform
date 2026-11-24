"use client";

import {
  Ambulance,
  ArrowRight,
  Pill,
  Stethoscope,
} from "lucide-react";
import { ACTIVE_COUNTRY_CODE } from "@/shared/config/deployment";
import { useLocale } from "@/shared/i18n/locale-store";
import { UiLinkButton } from "@/shared/ui/primitives";

const NETWORK_COPY = {
  en: {
    heading: "National care network across all 12 Moroccan regions.",
    cards: [
      {
        code: "01",
        pinKind: "ambulance" as const,
        hubLabel: "All 12 Regions · SAMU 141",
        title: "Emergency & Patient Transport",
        detail: "Live ambulance GPS dispatch and direct CHU / CHR hospital routing nationwide.",
        href: "/map",
        cta: "Open Live Map",
        img: "/media/vehicles/ambulance-van.webp",
        alt: "Emergency ambulance parked outside hospital emergency entrance",
      },
      {
        code: "02",
        pinKind: "clinic" as const,
        hubLabel: "CNOM Verified Specialists",
        title: "Doctors, Labs & Telehealth",
        detail: "Instant in-clinic slots, diagnostic imaging labs, and Decree 2-18-378 video visits.",
        href: "/booking",
        cta: "Book Consultation",
        img: "/media/scenes/telehealth-video.webp",
        alt: "Doctor conducting a video consultation on tablet",
      },
      {
        code: "03",
        pinKind: "pharmacy" as const,
        hubLabel: "Law 17-04 · AMO / CNSS / CNOPS",
        title: "24/7 Duty Pharmacy & QR Rx",
        detail: "On-duty pharmacies across Morocco, signed QR dispensing at counter, and OTC care.",
        href: "/pharmacy",
        cta: "Open Pharmacy",
        img: "/media/facilities/pharmacy-qr-fulfillment.jpg",
        alt: "Pharmacy counter with prepared prescription parcel and tablet",
      },
    ],
  },
  fr: {
    heading: "Réseau national de soins dans les 12 régions du Maroc.",
    cards: [
      {
        code: "01",
        pinKind: "ambulance" as const,
        hubLabel: "12 Régions · SAMU 141",
        title: "Urgences & Transport Sanitaire",
        detail: "Suivi GPS des ambulances et orientation directe vers les CHU et CHR.",
        href: "/map",
        cta: "Ouvrir la Carte",
        img: "/media/vehicles/ambulance-van.webp",
        alt: "Ambulance stationnée devant l'entrée des urgences",
      },
      {
        code: "02",
        pinKind: "clinic" as const,
        hubLabel: "Spécialistes Vérifiés CNOM",
        title: "Médecins, Labos & Vidéo",
        detail: "Rendez-vous en clinique, laboratoires d'analyses et téléconsultation Décret 2-18-378.",
        href: "/booking",
        cta: "Prendre RDV",
        img: "/media/scenes/telehealth-video.webp",
        alt: "Médecin en téléconsultation sur tablette",
      },
      {
        code: "03",
        pinKind: "pharmacy" as const,
        hubLabel: "Loi 17-04 · AMO / CNSS / CNOPS",
        title: "Pharmacies 24/7 & Ordonnances QR",
        detail: "Officines de garde partout au Maroc, délivrance Rx au comptoir et parapharmacie.",
        href: "/pharmacy",
        cta: "Ouvrir Pharmacie",
        img: "/media/facilities/pharmacy-qr-fulfillment.jpg",
        alt: "Comptoir de pharmacie moderne avec commande préparée",
      },
    ],
  },
  ar: {
    heading: "شبكة الرعاية الوطنية عبر جميع جهات المغرب الاثنتي عشرة.",
    cards: [
      {
        code: "01",
        pinKind: "ambulance" as const,
        hubLabel: "12 جهة · إسعاف 141",
        title: "الطوارئ والنقل الطبي",
        detail: "تتبع مباشر لسيارات الإسعاف وتوجيه فوري نحو المستشفيات الجامعية والجهوية.",
        href: "/map",
        cta: "فتح الخريطة",
        img: "/media/vehicles/ambulance-van.webp",
        alt: "سيارة إسعاف أمام قسم الطوارئ",
      },
      {
        code: "02",
        pinKind: "clinic" as const,
        hubLabel: "أطباء ومختبرات معتمدون",
        title: "الأطباء والمختبرات والاستشارة عن بعد",
        detail: "مواعيد مباشرة في العيادات، مختبرات التحاليل واستشارات فيديو مؤمنة.",
        href: "/booking",
        cta: "حجز موعد",
        img: "/media/scenes/telehealth-video.webp",
        alt: "طبيبة تجري استشارة عبر الفيديو",
      },
      {
        code: "03",
        pinKind: "pharmacy" as const,
        hubLabel: "قانون 17-04 · AMO / CNSS / CNOPS",
        title: "صيدليات الحراسة 24/7 ووصفات QR",
        detail: "صيدليات الحراسة بمدن المغرب، صرف الوصفات بالصيدلية ومنتجات شبه الصيدلية.",
        href: "/pharmacy",
        cta: "فتح الصيدلية",
        img: "/media/facilities/pharmacy-qr-fulfillment.jpg",
        alt: "مكتب صيدلية مع طلب دوائي جاهز",
      },
    ],
  },
} as const;

const PIN_STYLES = {
  ambulance: {
    badgeBg: "bg-[#DC2626]",
    icon: Ambulance,
  },
  clinic: {
    badgeBg: "bg-[#0066CC]",
    icon: Stethoscope,
  },
  pharmacy: {
    badgeBg: "bg-[#0F9D88]",
    icon: Pill,
  },
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
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10 xl:px-8 xl:py-12">
        <h2 className="font-editorial text-xl font-bold leading-tight tracking-[-0.025em] text-[#0F243E] sm:text-2xl xl:text-[28px]">
          {copy.heading}
        </h2>

        {/* 3-Column Pure White Medical Service Cards — single crisp CTA per card, zero repetition */}
        <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-3 xl:gap-5">
          {copy.cards.map((card) => {
            const pin = PIN_STYLES[card.pinKind];
            const PinIcon = pin.icon;
            return (
              <article
                key={card.code}
                className="flex flex-col overflow-hidden rounded-2xl border border-[#D7E4F2] bg-white shadow-[0_12px_32px_-16px_rgba(15,36,62,0.14)]"
              >
                <div className="relative bg-[#F3F8FD]">
                  <img
                    src={card.img}
                    alt={card.alt}
                    className="aspect-[16/9] w-full object-cover object-center xl:aspect-[16/10]"
                  />
                  <div className="absolute bottom-2.5 start-2.5 inline-flex max-w-[calc(100%-1.25rem)] items-center gap-1.5 rounded-full border border-white/80 bg-white/95 px-2.5 py-0.5 text-[10.5px] font-semibold text-[#0F243E] shadow-sm backdrop-blur-md xl:bottom-3 xl:start-3 xl:px-3 xl:py-1 xl:text-[11px]">
                    <span
                      className={`inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-white ${pin.badgeBg}`}
                    >
                      <PinIcon className="h-2.5 w-2.5" aria-hidden="true" />
                    </span>
                    <span className="truncate">{card.hubLabel}</span>
                  </div>
                </div>

                <div className="flex flex-1 flex-col justify-between p-4 xl:p-5">
                  <div>
                    <h3 className="line-clamp-1 font-editorial text-base font-bold leading-snug tracking-[-0.02em] text-[#0F243E] xl:text-lg">
                      {card.title}
                    </h3>
                    <p className="mt-1 line-clamp-2 text-xs leading-snug text-[#4A627D] xl:text-[13px] xl:leading-relaxed">
                      {card.detail}
                    </p>
                  </div>

                  <div className="mt-3.5 border-t border-[#E8F1FA] pt-3 xl:mt-4">
                    <UiLinkButton
                      href={withCountry(card.href)}
                      variant="primary"
                      size="sm"
                      className="w-full justify-center"
                    >
                      <span>{card.cta}</span>
                      <ArrowRight
                        className="h-3.5 w-3.5 rtl:rotate-180"
                        aria-hidden="true"
                      />
                    </UiLinkButton>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
