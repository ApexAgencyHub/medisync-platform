"use client";

import { useEffect, useRef, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { useLocale } from "@/shared/i18n/locale-store";

declare global {
  interface Window {
    google?: {
      accounts?: {
        id?: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential?: string }) => void;
          }) => void;
          renderButton: (
            parent: HTMLElement,
            options: {
              theme?: "outline" | "filled_blue" | "filled_black";
              size?: "large" | "medium" | "small";
              text?: "signin_with" | "signup_with" | "continue_with";
              shape?: "rectangular" | "pill";
              width?: number;
            },
          ) => void;
        };
      };
    };
  }
}

export interface GoogleSignInButtonProps {
  disabled?: boolean;
  onCredential: (idToken: string) => Promise<void> | void;
  onUnconfiguredNotice?: (message: string) => void;
}

/**
 * Renders an official Google Identity Services button when
 * NEXT_PUBLIC_GOOGLE_CLIENT_ID is configured, or an explicit fail-closed
 * configuration notice when running offline without GCP OAuth credentials.
 */
export function GoogleSignInButton({
  disabled = false,
  onCredential,
  onUnconfiguredNotice,
}: GoogleSignInButtonProps) {
  const { locale } = useLocale();
  const googleCopy =
    locale === "ar"
      ? {
          aria: "المتابعة عبر حساب جوجل",
          loading: "جاري تحميل خدمة تسجيل الدخول بجوجل…",
          unconfigured:
            "يتطلب تسجيل الدخول بجوجل ضبط معرف OAuth في إعدادات الخادم. استعمل رقم الهاتف أو البريد الإلكتروني أعلاه للدخول الفوري.",
          cta: "المتابعة عبر جوجل (للمرضى والمرافقين)",
          envHintPrefix: "قم بإعداد",
          envHintAnd: "و",
          envHintSuffix: "لتفعيل الدخول المباشر بجوجل.",
        }
      : locale === "fr"
        ? {
            aria: "Continuer avec Google",
            loading: "Chargement de la vérification Google…",
            unconfigured:
              "La connexion Google nécessite NEXT_PUBLIC_GOOGLE_CLIENT_ID et GOOGLE_CLIENT_ID en production. Utilisez votre téléphone ou e-mail ci-dessus pour un accès immédiat.",
            cta: "Continuer avec Google (Patients & Aidants)",
            envHintPrefix: "Configurez",
            envHintAnd: "et",
            envHintSuffix: "pour activer OAuth en direct.",
          }
        : {
            aria: "Continue with Google",
            loading: "Loading Google Identity verification…",
            unconfigured:
              "Google Sign-In requires NEXT_PUBLIC_GOOGLE_CLIENT_ID and GOOGLE_CLIENT_ID to be set in deployment env. Use Phone Number or Email right above for instant patient access.",
            cta: "Continue with Google (Patient & Caregiver)",
            envHintPrefix: "Configure",
            envHintAnd: "&",
            envHintSuffix: "for live OAuth.",
          };
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID?.trim() ?? "";
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [gsiReady, setGsiReady] = useState(false);

  useEffect(() => {
    if (!clientId) return;
    let cancelled = false;

    const mountButton = () => {
      if (cancelled || !containerRef.current || !window.google?.accounts?.id) {
        return;
      }
      containerRef.current.innerHTML = "";
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: (response) => {
          if (response.credential) {
            void onCredential(response.credential);
          }
        },
      });
      window.google.accounts.id.renderButton(containerRef.current, {
        theme: "outline",
        size: "large",
        text: "continue_with",
        shape: "rectangular",
        width: 340,
      });
      setGsiReady(true);
    };

    if (window.google?.accounts?.id) {
      mountButton();
      return () => {
        cancelled = true;
      };
    }

    const existing = document.querySelector<HTMLScriptElement>(
      'script[src="https://accounts.google.com/gsi/client"]',
    );
    if (existing) {
      existing.addEventListener("load", mountButton);
      return () => {
        cancelled = true;
        existing.removeEventListener("load", mountButton);
      };
    }

    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.addEventListener("load", mountButton);
    document.head.appendChild(script);

    return () => {
      cancelled = true;
      script.removeEventListener("load", mountButton);
    };
  }, [clientId, onCredential]);

  if (clientId) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
        <div
          ref={containerRef}
          aria-label={googleCopy.aria}
          className={`flex min-h-11 items-center justify-center ${
            disabled ? "pointer-events-none opacity-60" : ""
          }`}
        />
        {!gsiReady ? (
          <p className="mt-2 text-center text-xs text-slate-600">
            {googleCopy.loading}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-[#F3F8FD] border border-[#D7E4F2] p-4">
      <button
        type="button"
        disabled={disabled}
        onClick={() => onUnconfiguredNotice?.(googleCopy.unconfigured)}
        className="flex w-full items-center justify-center gap-3 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 shadow-xs transition hover:bg-emerald-50/40 disabled:opacity-50"
      >
        <svg
          className="h-5 w-5 shrink-0"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            fill="#4285F4"
            d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
          />
          <path
            fill="#34A853"
            d="M12 24c3.3 0 6.08-1.09 8.1-2.96l-3.88-3.05c-1.1.74-2.5 1.18-4.22 1.18-3.24 0-5.99-2.19-6.97-5.14H1.02v3.14C3.03 21.18 7.21 24 12 24Z"
          />
          <path
            fill="#FBBC05"
            d="M5.03 14.03c-.25-.74-.39-1.54-.39-2.36 0-.82.14-1.62.39-2.36V6.17H1.02A11.98 11.98 0 0 0 0 11.67c0 1.94.46 3.77 1.02 5.5l4.01-3.14Z"
          />
          <path
            fill="#EA4335"
            d="M12 4.75c1.8 0 3.41.62 4.68 1.83l3.51-3.51C18.08 1.19 15.3 0 12 0 7.21 0 3.03 2.82 1.02 6.83l4.01 3.14C6.01 6.94 8.76 4.75 12 4.75Z"
          />
        </svg>
        <span>{googleCopy.cta}</span>
      </button>
      <p className="mt-2 flex items-center justify-center gap-1.5 text-center text-[11px] text-slate-600">
        <ShieldCheck className="h-3.5 w-3.5 text-[#0066CC]" aria-hidden="true" />
        <span>
          {googleCopy.envHintPrefix}{" "}
          <code className="font-mono">GOOGLE_CLIENT_ID</code>{" "}
          {googleCopy.envHintAnd}{" "}
          <code className="font-mono">NEXT_PUBLIC_GOOGLE_CLIENT_ID</code>{" "}
          {googleCopy.envHintSuffix}
        </span>
      </p>
    </div>
  );
}
