"use client";

import dynamic from "next/dynamic";

export const DynamicViewportVectorMap = dynamic(
  () => import("./ViewportVectorMap").then((m) => m.ViewportVectorMap),
  {
    ssr: false,
    loading: () => (
      <div className="h-full min-h-[340px] w-full animate-pulse rounded-2xl border border-[#D7E4F2] bg-[#E8F1FA]" />
    ),
  },
);
