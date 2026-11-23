"use client";

import { Bookmark } from "lucide-react";
import type { BookmarkItem } from "@medisync/contracts";
import { useLocale } from "@/shared/i18n/locale-store";
import {
  toggleBookmark,
  useBookmarkedProviders,
} from "../patient/patient-local-store";

interface BookmarkButtonProps {
  entry: Omit<BookmarkItem, "savedAtIso">;
  compact?: boolean;
  className?: string;
}

const BOOKMARK_LABELS = {
  en: {
    save: "Save",
    saved: "Saved",
    ariaSave: (title: string) => `Save ${title}`,
    ariaRemove: (title: string) => `Remove ${title} from saved list`,
  },
  fr: {
    save: "Enregistrer",
    saved: "Enregistré",
    ariaSave: (title: string) => `Enregistrer ${title}`,
    ariaRemove: (title: string) => `Retirer ${title} des favoris`,
  },
  ar: {
    save: "حفظ",
    saved: "محفوظ",
    ariaSave: (title: string) => `حفظ ${title}`,
    ariaRemove: (title: string) => `إزالة ${title} من المحفوظات`,
  },
} as const;

/**
 * Shared accessible Save / Bookmark toggle reused across Profiles, Live Map, Booking, and Patient Care Hub.
 */
export function BookmarkButton({
  entry,
  compact = false,
  className = "",
}: BookmarkButtonProps) {
  const { locale } = useLocale();
  const labels = BOOKMARK_LABELS[locale] ?? BOOKMARK_LABELS.en;
  const bookmarks = useBookmarkedProviders();
  const saved = bookmarks.some((item) => item.id === entry.id);

  return (
    <button
      type="button"
      onClick={() => toggleBookmark(entry)}
      aria-pressed={saved}
      aria-label={
        saved ? labels.ariaRemove(entry.title) : labels.ariaSave(entry.title)
      }
      className={`inline-flex shrink-0 items-center justify-center gap-1.5 rounded-full font-semibold transition-colors active:scale-[0.95] focus:outline-none focus:ring-2 focus:ring-emerald-600/30 ${
        compact
          ? "min-h-[32px] px-2.5 py-1 text-[11px]"
          : "min-h-[34px] px-3 py-1 text-xs"
      } ${
        saved
          ? "bg-amber-50 text-amber-900 hover:bg-amber-100"
          : "bg-white text-slate-700 shadow-2xs hover:text-[#0066CC]"
      } ${className}`}
    >
      <Bookmark
        className={`h-3.5 w-3.5 shrink-0 ${saved ? "fill-amber-500 text-amber-600" : ""}`}
        aria-hidden="true"
      />
      <span>{saved ? labels.saved : labels.save}</span>
    </button>
  );
}
