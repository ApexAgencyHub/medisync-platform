"use client";

import { useMemo, useSyncExternalStore } from "react";
import {
  BookmarkItemSchema,
  BookmarkStoragePayloadSchema,
  GuestActivityPassSchema,
  GuestPassStoragePayloadSchema,
  type BookmarkItem,
  type GuestActivityPass,
} from "@medisync/contracts";

const BOOKMARKS_KEY = "medisync.bookmarks.v1";
const GUEST_PASSES_KEY = "medisync.guest-passes.v1";
const PATIENT_LOCAL_EVENT = "medisync:patient-local-change";

const EMPTY_BOOKMARKS: readonly BookmarkItem[] = [];
const EMPTY_PASSES: readonly GuestActivityPass[] = [];

let cachedBookmarksRaw: string | null = null;
let cachedBookmarksValue: readonly BookmarkItem[] = EMPTY_BOOKMARKS;

let cachedPassesRaw: string | null = null;
let cachedPassesValue: readonly GuestActivityPass[] = EMPTY_PASSES;

function readStorageItem(key: string): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    return window.localStorage.getItem(key);
  } catch {
    // Restricted storage contexts (private mode / sandboxed iframes)
    return null;
  }
}

function writeStorageItem(key: string, value: string): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch {
    // Storage quota exceeded or restricted storage context
    return false;
  }
}

function readBookmarksSnapshot(): readonly BookmarkItem[] {
  if (typeof window === "undefined") {
    return EMPTY_BOOKMARKS;
  }
  const raw = readStorageItem(BOOKMARKS_KEY);
  if (raw === cachedBookmarksRaw) {
    return cachedBookmarksValue;
  }
  cachedBookmarksRaw = raw;
  if (!raw) {
    cachedBookmarksValue = EMPTY_BOOKMARKS;
    return EMPTY_BOOKMARKS;
  }
  try {
    const parsed = BookmarkStoragePayloadSchema.safeParse(JSON.parse(raw));
    cachedBookmarksValue = parsed.success ? parsed.data : EMPTY_BOOKMARKS;
  } catch {
    cachedBookmarksValue = EMPTY_BOOKMARKS;
  }
  return cachedBookmarksValue;
}

function readPassesSnapshot(): readonly GuestActivityPass[] {
  if (typeof window === "undefined") {
    return EMPTY_PASSES;
  }
  const raw = readStorageItem(GUEST_PASSES_KEY);
  if (raw === cachedPassesRaw) {
    return cachedPassesValue;
  }
  cachedPassesRaw = raw;
  if (!raw) {
    cachedPassesValue = EMPTY_PASSES;
    return EMPTY_PASSES;
  }
  try {
    const parsed = GuestPassStoragePayloadSchema.safeParse(JSON.parse(raw));
    cachedPassesValue = parsed.success ? parsed.data : EMPTY_PASSES;
  } catch {
    cachedPassesValue = EMPTY_PASSES;
  }
  return cachedPassesValue;
}

function subscribePatientLocal(onStoreChange: () => void): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }
  const storageHandler = (event: StorageEvent) => {
    if (
      event.key === null ||
      event.key === BOOKMARKS_KEY ||
      event.key === GUEST_PASSES_KEY
    ) {
      onStoreChange();
    }
  };
  const localHandler = () => onStoreChange();
  window.addEventListener("storage", storageHandler);
  window.addEventListener(PATIENT_LOCAL_EVENT, localHandler);
  return () => {
    window.removeEventListener("storage", storageHandler);
    window.removeEventListener(PATIENT_LOCAL_EVENT, localHandler);
  };
}

function emitPatientLocalChange(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(PATIENT_LOCAL_EVENT));
  }
}

function persistBookmarks(items: readonly BookmarkItem[]): boolean {
  if (typeof window === "undefined") return false;
  const serialized = JSON.stringify(items);
  if (!writeStorageItem(BOOKMARKS_KEY, serialized)) {
    return false;
  }
  cachedBookmarksRaw = serialized;
  cachedBookmarksValue = items;
  emitPatientLocalChange();
  return true;
}

function persistPasses(passes: readonly GuestActivityPass[]): boolean {
  if (typeof window === "undefined") return false;
  const serialized = JSON.stringify(passes);
  if (!writeStorageItem(GUEST_PASSES_KEY, serialized)) {
    return false;
  }
  cachedPassesRaw = serialized;
  cachedPassesValue = passes;
  emitPatientLocalChange();
  return true;
}

/** Adds or removes a bookmarked provider/facility and notifies all mounted workspaces. */
export function toggleBookmark(
  entry: Omit<BookmarkItem, "savedAtIso">,
): boolean {
  const current = readBookmarksSnapshot();
  const exists = current.some((item) => item.id === entry.id);
  if (exists) {
    const persisted = persistBookmarks(
      current.filter((item) => item.id !== entry.id),
    );
    return !persisted;
  }
  const parsed = BookmarkItemSchema.safeParse({
    ...entry,
    savedAtIso: new Date().toISOString(),
  });
  if (!parsed.success) {
    return false;
  }
  return persistBookmarks([parsed.data, ...current].slice(0, 60));
}

/** Removes a specific bookmarked provider/facility by ID. */
export function removeBookmark(id: string): void {
  const current = readBookmarksSnapshot();
  if (!current.some((item) => item.id === id)) return;
  persistBookmarks(current.filter((item) => item.id !== id));
}

/** Subscribes reactively to saved bookmarks, optionally filtered by country code. */
export function useBookmarkedProviders(
  countryCode?: string,
): readonly BookmarkItem[] {
  const all = useSyncExternalStore(
    subscribePatientLocal,
    readBookmarksSnapshot,
    () => EMPTY_BOOKMARKS,
  );
  return useMemo(() => {
    if (!countryCode || countryCode === "ALL") return all;
    return all.filter((item) => item.countryCode === countryCode);
  }, [all, countryCode]);
}

/** Records a guest tracking pass (Fast Book ride alert or quick slot hold) locally. */
export function addGuestActivityPass(pass: GuestActivityPass): void {
  const parsed = GuestActivityPassSchema.safeParse(pass);
  if (!parsed.success) return;
  const current = readPassesSnapshot();
  persistPasses(
    [parsed.data, ...current.filter((item) => item.id !== parsed.data.id)].slice(
      0,
      25,
    ),
  );
}

/** Dismisses a saved guest activity pass by ID. */
export function removeGuestActivityPass(id: string): void {
  const current = readPassesSnapshot();
  if (!current.some((item) => item.id === id)) return;
  persistPasses(current.filter((item) => item.id !== id));
}

/** Subscribes reactively to guest booking and ride tracking passes. */
export function useGuestActivityPasses(
  countryCode?: string,
): readonly GuestActivityPass[] {
  const all = useSyncExternalStore(
    subscribePatientLocal,
    readPassesSnapshot,
    () => EMPTY_PASSES,
  );
  return useMemo(() => {
    if (!countryCode || countryCode === "ALL") return all;
    return all.filter((item) => item.countryCode === countryCode);
  }, [all, countryCode]);
}
