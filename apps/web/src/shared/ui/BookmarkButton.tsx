"use client";

import { Bookmark } from "lucide-react";
import type { BookmarkItem } from "@medisync/contracts";
import {
  toggleBookmark,
  useBookmarkedProviders,
} from "../patient/patient-local-store";

interface BookmarkButtonProps {
  entry: Omit<BookmarkItem, "savedAtIso">;
  compact?: boolean;
  className?: string;
}

/**
 * Shared accessible Save / Bookmark toggle reused across Profiles, Live Map, Booking, and Patient Care Hub.
 */
export function BookmarkButton({
  entry,
  compact = false,
  className = "",
}: BookmarkButtonProps) {
  const bookmarks = useBookmarkedProviders();
  const saved = bookmarks.some((item) => item.id === entry.id);

  return (
    <button
      type="button"
      onClick={() => toggleBookmark(entry)}
      aria-pressed={saved}
      aria-label={saved ? `Remove ${entry.title} from saved list` : `Save ${entry.title}`}
      className={`inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg border font-semibold transition-colors active:scale-[0.95] focus:outline-none focus:ring-2 focus:ring-teal-700/30 ${
        compact ? "min-h-[32px] px-2 py-1 text-[11px]" : "min-h-[34px] px-2.5 py-1 text-xs"
      } ${
        saved
          ? "border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100"
          : "border-slate-200 bg-white text-slate-700 hover:border-teal-700 hover:text-teal-900"
      } ${className}`}
    >
      <Bookmark
        className={`h-3.5 w-3.5 shrink-0 ${saved ? "fill-amber-500 text-amber-600" : ""}`}
        aria-hidden="true"
      />
      <span>{saved ? "Saved" : "Save"}</span>
    </button>
  );
}
