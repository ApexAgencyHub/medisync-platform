"use client";

import Image from "next/image";
import { useLocale } from "@/shared/i18n/locale-store";

export function BrandMark() {
  const { t } = useLocale();

  return (
    <div className="flex items-center gap-3">
      <Image
        src="/brand/logo-mark.png"
        alt="MediSync Global emblem"
        width={40}
        height={40}
        priority
        className="h-10 w-10 shrink-0 object-contain"
      />
      <div className="leading-tight">
        <span className="block text-base font-bold tracking-tight text-slate-900">
          MediSync Global
        </span>
        <span className="block text-[11px] font-semibold tracking-wide text-teal-800">
          {t("brand.tagline")}
        </span>
      </div>
    </div>
  );
}
