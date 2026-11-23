"use client";

import Image from "next/image";

export function BrandMark() {
  return (
    <div className="flex items-center gap-2 sm:gap-2.5">
      <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-[#D7E4F2] bg-[#EBF4FF] p-1 shadow-[0_2px_8px_rgba(0,102,204,0.08)] xl:h-9 xl:w-9">
        <Image
          src="/brand/logo-mark.png"
          alt="MediSync Global emblem"
          width={28}
          height={28}
          priority
          className="h-5 w-5 shrink-0 object-contain xl:h-6 xl:w-6"
        />
      </span>
      <div className="leading-none">
        <span className="block whitespace-nowrap font-editorial text-sm font-bold tracking-[-0.02em] text-[#0F243E] xl:text-[15.5px]">
          MediSync Global
        </span>
        <span className="mt-0.5 hidden whitespace-nowrap text-[10px] font-medium text-[#0066CC] sm:block xl:text-[11px]">
          Medical Care Network
        </span>
      </div>
    </div>
  );
}
