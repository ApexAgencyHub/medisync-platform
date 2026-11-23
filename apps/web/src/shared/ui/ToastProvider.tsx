"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AlertCircle, AlertTriangle, CheckCircle2, Info, X } from "lucide-react";

export type ToastTone = "success" | "error" | "warning" | "info";

export interface ToastInput {
  tone?: ToastTone;
  message: string;
  durationMs?: number;
}

interface ToastItem {
  id: string;
  tone: ToastTone;
  message: string;
  durationMs: number;
  closing: boolean;
}

interface ToastContextValue {
  showToast: (input: ToastInput) => string;
  dismissToast: (id: string) => void;
  clearToasts: () => void;
}

const DEFAULT_DURATION_MS: Record<ToastTone, number> = {
  success: 4000,
  info: 4000,
  warning: 5500,
  error: 6000,
};

const MAX_VISIBLE_TOASTS = 2;
const EXIT_ANIMATION_MS = 200;

const TONE_STYLES: Record<
  ToastTone,
  { card: string; iconWrap: string; iconColor: string; bar: string }
> = {
  success: {
    card: "border-[#B2E5DC] bg-white text-[#0F243E]",
    iconWrap: "bg-[#E6F7F4] text-[#0F9D88] border border-[#B2E5DC]",
    iconColor: "text-[#0F9D88]",
    bar: "bg-[#0F9D88]",
  },
  error: {
    card: "border-rose-200 bg-white text-[#0F243E]",
    iconWrap: "bg-rose-50 text-[#DC2626] border border-rose-200",
    iconColor: "text-[#DC2626]",
    bar: "bg-[#DC2626]",
  },
  warning: {
    card: "border-amber-200 bg-white text-[#0F243E]",
    iconWrap: "bg-amber-50 text-amber-700 border border-amber-200",
    iconColor: "text-amber-700",
    bar: "bg-amber-600",
  },
  info: {
    card: "border-[#BFDBFE] bg-white text-[#0F243E]",
    iconWrap: "bg-[#EBF4FF] text-[#0066CC] border border-[#BFDBFE]",
    iconColor: "text-[#0066CC]",
    bar: "bg-[#0066CC]",
  },
};

const ToastContext = createContext<ToastContextValue>({
  showToast: () => "",
  dismissToast: () => undefined,
  clearToasts: () => undefined,
});

export function useToast(): ToastContextValue {
  return useContext(ToastContext);
}

export function useToastSetter() {
  const { showToast } = useToast();
  return useCallback(
    (next: { tone: ToastTone; text: string } | null) => {
      if (!next?.text.trim()) return;
      showToast({ tone: next.tone, message: next.text });
    },
    [showToast],
  );
}

function ToastCard({
  toast,
  onDismiss,
}: {
  toast: ToastItem;
  onDismiss: (id: string) => void;
}) {
  const [paused, setPaused] = useState(false);
  const remainingRef = useRef(toast.durationMs);
  const startedAtRef = useRef(0);

  useEffect(() => {
    remainingRef.current = toast.durationMs;
  }, [toast.durationMs, toast.id]);

  useEffect(() => {
    if (toast.closing || paused) return;

    startedAtRef.current = Date.now();
    const timer = window.setTimeout(() => {
      onDismiss(toast.id);
    }, Math.max(150, remainingRef.current));

    return () => {
      window.clearTimeout(timer);
      const elapsed = Date.now() - startedAtRef.current;
      remainingRef.current = Math.max(0, remainingRef.current - elapsed);
    };
  }, [toast.id, toast.closing, paused, onDismiss]);

  const style = TONE_STYLES[toast.tone];
  const Icon =
    toast.tone === "success"
      ? CheckCircle2
      : toast.tone === "error"
        ? AlertCircle
        : toast.tone === "warning"
          ? AlertTriangle
          : Info;

  return (
    <div
      role={toast.tone === "error" ? "alert" : "status"}
      aria-live={toast.tone === "error" ? "assertive" : "polite"}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      className={`ms-toast-card pointer-events-auto relative overflow-hidden rounded-xl border p-3.5 shadow-[0_12px_28px_-8px_rgba(10,25,47,0.14)] transition-all duration-200 ${
        style.card
      } ${
        toast.closing
          ? "translate-y-1 scale-[0.98] opacity-0"
          : "translate-y-0 scale-100 opacity-100"
      }`}
    >
      <div className="flex items-start gap-2.5">
        <span
          className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-xl ${style.iconWrap}`}
        >
          <Icon className={`h-3.5 w-3.5 ${style.iconColor}`} aria-hidden="true" />
        </span>
        <p className="min-w-0 flex-1 pt-0.5 text-xs font-medium leading-relaxed text-[#0F243E] break-words">
          <bdi dir="auto">{toast.message}</bdi>
        </p>
        <button
          type="button"
          aria-label="Dismiss notification"
          onClick={() => onDismiss(toast.id)}
          className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-xl text-[#6E8298] transition-colors hover:bg-[#E8F1FA] hover:text-[#0F243E] active:scale-95"
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-[2.5px] bg-[#E8F1FA]"
      >
        <div
          key={`${toast.id}-${toast.durationMs}`}
          style={{ animationDuration: `${toast.durationMs}ms` }}
          className={`ms-toast-progress h-full w-full ${style.bar}`}
        />
      </div>
    </div>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const seqRef = useRef(0);
  const exitTimersRef = useRef<Map<string, number>>(new Map());

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) =>
      prev.map((item) => (item.id === id ? { ...item, closing: true } : item)),
    );
    if (exitTimersRef.current.has(id)) return;
    const timer = window.setTimeout(() => {
      exitTimersRef.current.delete(id);
      setToasts((prev) => prev.filter((item) => item.id !== id));
    }, EXIT_ANIMATION_MS);
    exitTimersRef.current.set(id, timer);
  }, []);

  const clearToasts = useCallback(() => {
    for (const timer of exitTimersRef.current.values()) {
      window.clearTimeout(timer);
    }
    exitTimersRef.current.clear();
    setToasts([]);
  }, []);

  const showToast = useCallback((input: ToastInput): string => {
    const tone: ToastTone = input.tone ?? "info";
    const message = input.message.trim();
    if (!message) return "";
    const durationMs = input.durationMs ?? DEFAULT_DURATION_MS[tone];
    seqRef.current += 1;
    const nextId = `toast-${seqRef.current}`;

    setToasts((prev) => {
      const existing = prev.find(
        (t) => !t.closing && t.tone === tone && t.message === message,
      );
      if (existing) {
        return prev.map((t) =>
          t.id === existing.id
            ? { ...t, id: nextId, durationMs, closing: false }
            : t,
        );
      }
      const next: ToastItem = {
        id: nextId,
        tone,
        message,
        durationMs,
        closing: false,
      };
      return [...prev, next].slice(-MAX_VISIBLE_TOASTS);
    });

    return nextId;
  }, []);

  useEffect(() => {
    const timers = exitTimersRef.current;
    return () => {
      for (const timer of timers.values()) {
        window.clearTimeout(timer);
      }
      timers.clear();
    };
  }, []);

  const value = useMemo<ToastContextValue>(
    () => ({ showToast, dismissToast, clearToasts }),
    [showToast, dismissToast, clearToasts],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toasts.length > 0 ? (
        <div
          aria-label="Notifications"
          className="pointer-events-none fixed bottom-4 left-1/2 z-[180] flex w-[min(380px,calc(100vw-24px))] -translate-x-1/2 flex-col-reverse gap-2"
        >
          {toasts.map((toast) => (
            <ToastCard key={toast.id} toast={toast} onDismiss={dismissToast} />
          ))}
        </div>
      ) : null}
    </ToastContext.Provider>
  );
}
