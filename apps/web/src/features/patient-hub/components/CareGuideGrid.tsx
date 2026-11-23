"use client";

import Link from "next/link";
import { ArrowRight, PhoneCall, Stethoscope, Video } from "lucide-react";
import { UiBadge } from "@/shared/ui/primitives";
import type { PatientUiCopy } from "../patient-copy";

interface CareGuideGridProps {
  copy: PatientUiCopy;
  emergencyHotline: string;
}

/** Visual photo bento showing the 4 core actions in everyday plain language. */
export function CareGuideGrid({ copy, emergencyHotline }: CareGuideGridProps) {
  return (
    <section
      id="patient-guide"
      aria-label={copy.guideTitle}
      className="space-y-3"
    >
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div className="space-y-0.5">
          <p className="text-[11px] font-bold uppercase tracking-wider text-[#0066CC]">
            {copy.guideEyebrow}
          </p>
          <h2 className="text-base font-bold text-slate-950 sm:text-lg">
            {copy.guideTitle}
          </h2>
          <p className="text-xs text-slate-600 sm:text-[13px]">
            {copy.guideSubtitle}
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:gap-4">
        {copy.guideCards.map((card) => {
          const badgeText =
            card.isEmergency && emergencyHotline
              ? `${card.badge} ${emergencyHotline}`
              : card.badge;
          return (
            <article
              key={card.id}
              className={`group flex flex-col overflow-hidden rounded-xl border transition-all hover:shadow-[0_10px_26px_-12px_rgba(11,18,32,0.12)] active:scale-[0.99] ${
                card.isEmergency
                  ? "border-rose-200 bg-rose-50/75 hover:bg-rose-50"
                  : "border-[#D7E4F2] bg-white hover:border-[#B9C3CD]"
              }`}
            >
              <Link
                href={card.href}
                className="relative aspect-[16/9] w-full overflow-hidden border-b border-[#D7E4F2] bg-[#E8F1FA]"
              >
                <img
                  src={card.imageSrc}
                  alt={card.imageAlt}
                  className="h-full w-full object-cover object-center transition-transform duration-300 group-hover:scale-[1.03]"
                />
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-slate-950/30 to-transparent" />
                <div className="absolute top-2.5 start-2.5">
                  <UiBadge tone={card.badgeTone} className="bg-white/95 shadow-xs backdrop-blur-sm">
                    {badgeText}
                  </UiBadge>
                </div>
              </Link>

              <div className="flex flex-1 flex-col justify-between gap-2.5 p-3 xl:gap-3 xl:p-4">
                <div className="space-y-0.5">
                  <h3 className="line-clamp-1 text-sm font-bold text-slate-950 xl:text-[15px]">
                    {card.title}
                  </h3>
                  <p className="line-clamp-2 text-xs leading-snug text-slate-600">
                    {card.description}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-1.5 pt-0.5 xl:gap-2">
                  <Link
                    href={card.href}
                    className={`inline-flex min-h-[36px] flex-1 items-center justify-center gap-1.5 rounded-lg px-3 text-xs font-semibold text-white transition ${
                      card.isEmergency
                        ? "bg-rose-700 hover:bg-rose-800"
                        : "bg-[#0F243E] hover:bg-slate-800"
                    }`}
                  >
                    {card.secondaryHref ? (
                      <Stethoscope className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    ) : null}
                    <span className="truncate">{card.ctaLabel}</span>
                    {!card.secondaryHref ? (
                      <ArrowRight
                        className="h-3.5 w-3.5 shrink-0 rtl:rotate-180"
                        aria-hidden="true"
                      />
                    ) : null}
                  </Link>

                  {card.secondaryHref && card.secondaryLabel ? (
                    <Link
                      href={card.secondaryHref}
                      className="inline-flex min-h-[38px] flex-1 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-[#0066CC] shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition hover:bg-[#0066CC] hover:text-white"
                    >
                      <Video className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      <span className="truncate">{card.secondaryLabel}</span>
                    </Link>
                  ) : null}

                  {card.isEmergency && emergencyHotline ? (
                    <a
                      href={`tel:${emergencyHotline}`}
                      className="inline-flex min-h-[38px] shrink-0 items-center gap-1 rounded-xl bg-white px-3 text-xs font-bold text-rose-700 shadow-2xs transition hover:bg-rose-100"
                      dir="ltr"
                    >
                      <PhoneCall className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>{emergencyHotline}</span>
                    </a>
                  ) : null}
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
