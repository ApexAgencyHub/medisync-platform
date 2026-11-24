"use client";

import Link from "next/link";
import { ArrowRight, Video } from "lucide-react";
import { UiBadge } from "@/shared/ui/primitives";
import type { PatientUiCopy } from "../patient-copy";

interface CareGuideGridProps {
  copy: PatientUiCopy;
}

/** Visual photo bento showing the 4 core care pathways without duplicating AppHeader 141 or WorkspaceHeader Book/Ambulance buttons. */
export function CareGuideGrid({ copy }: CareGuideGridProps) {
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
          const isHeaderDuplicatedAction =
            card.id === "doctor-visit" || card.isEmergency;
          return (
            <article
              key={card.id}
              className={`group flex flex-col overflow-hidden rounded-xl border transition-all hover:shadow-[0_10px_26px_-12px_rgba(11,18,32,0.12)] active:scale-[0.99] ${
                card.isEmergency
                  ? "border-rose-200 bg-rose-50/60 hover:bg-rose-50"
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
                {!card.isEmergency ? (
                  <div className="absolute top-2.5 start-2.5">
                    <UiBadge
                      tone={card.badgeTone}
                      className="bg-white/95 shadow-xs backdrop-blur-sm"
                    >
                      {card.badge}
                    </UiBadge>
                  </div>
                ) : null}
              </Link>

              <div className="flex flex-1 flex-col justify-between gap-2.5 p-3 xl:gap-3 xl:p-4">
                <Link href={card.href} className="block space-y-0.5">
                  <h3 className="line-clamp-1 text-sm font-bold text-slate-950 transition-colors group-hover:text-[#0066CC] xl:text-[15px]">
                    {card.title}
                  </h3>
                  <p className="line-clamp-2 text-xs leading-snug text-slate-600">
                    {card.description}
                  </p>
                </Link>

                <div className="flex flex-wrap items-center gap-2 border-t border-[#E8F1FA] pt-2">
                  {!isHeaderDuplicatedAction ? (
                    <Link
                      href={card.href}
                      className="inline-flex min-h-[34px] flex-1 items-center justify-center gap-1.5 rounded-lg bg-[#0F243E] px-3 text-xs font-semibold text-white transition hover:bg-slate-800"
                    >
                      <span className="truncate">{card.ctaLabel}</span>
                      <ArrowRight
                        className="h-3.5 w-3.5 shrink-0 rtl:rotate-180"
                        aria-hidden="true"
                      />
                    </Link>
                  ) : card.secondaryHref && card.secondaryLabel ? (
                    <Link
                      href={card.secondaryHref}
                      className="inline-flex min-h-[34px] flex-1 items-center justify-center gap-1.5 rounded-lg border border-[#D7E4F2] bg-[#F3F8FD] px-3 text-xs font-semibold text-[#0066CC] transition hover:border-[#0066CC] hover:bg-[#EBF4FF]"
                    >
                      <Video className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      <span className="truncate">{card.secondaryLabel}</span>
                    </Link>
                  ) : (
                    <Link
                      href={card.href}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-rose-700 transition hover:text-rose-900 hover:underline"
                    >
                      <span className="truncate">{card.ctaLabel}</span>
                      <ArrowRight
                        className="h-3.5 w-3.5 shrink-0 rtl:rotate-180"
                        aria-hidden="true"
                      />
                    </Link>
                  )}
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
