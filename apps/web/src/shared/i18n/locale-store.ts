"use client";

import { useEffect, useSyncExternalStore } from "react";
import type { LocaleCode } from "@medisync/contracts";

const LOCALE_STORAGE_KEY = "medisync.locale.v1";
const LOCALE_EVENT = "medisync:locale-change";

let currentLocaleCache: LocaleCode = "en";
let initializedFromStorage = false;

const TRANSLATIONS: Record<LocaleCode, Record<string, string>> = {
  en: {
    "nav.overview": "Overview",
    "nav.map": "Live Map",
    "nav.booking": "Booking",
    "nav.clinical": "Clinical",
    "nav.pharmacy": "Pharmacy",
    "nav.admin": "Admin",
    "nav.portal": "Portal",
    "pharma.heading": "Online Pharmacy Catalog & Courier Checkout",
    "pharma.subtitle":
      "Browse country-licensed pharmacies, add OTC & prescription items, verify Rx links, pay securely, and dispatch live couriers.",
    "pharma.searchPlaceholder": "Search medications, SKU, or active ingredient...",
    "pharma.addToCart": "Add to Cart",
    "pharma.cartTitle": "Shopping Cart & Checkout",
    "pharma.placeOrder": "Place Order & Pay Now",
    "pharma.emptyCart": "Add OTC or Rx medications from the catalog to start checkout.",
    "pharma.ordersTitle": "Orders & Printable Receipts",
    "portal.recoveryTab": "Verify & Reset",
  },
  fr: {
    "nav.overview": "Aperçu",
    "nav.map": "Carte Live",
    "nav.booking": "Rendez-vous",
    "nav.clinical": "Clinique",
    "nav.pharmacy": "Pharmacie",
    "nav.admin": "Admin",
    "nav.portal": "Portail",
    "pharma.heading": "Pharmacie en Ligne & Livraison Express",
    "pharma.subtitle":
      "Parcourez les officines agréées, commandez sans ou avec ordonnance, payez en ligne et suivez le coursier.",
    "pharma.searchPlaceholder": "Rechercher un médicament, SKU ou principe actif...",
    "pharma.addToCart": "Ajouter",
    "pharma.cartTitle": "Panier & Paiement",
    "pharma.placeOrder": "Commander & Payer",
    "pharma.emptyCart": "Ajoutez des produits de l'officine pour passer commande.",
    "pharma.ordersTitle": "Commandes & Reçus Imprimables",
    "portal.recoveryTab": "Vérifier & Réinit.",
  },
  ar: {
    "nav.overview": "نظرة عامة",
    "nav.map": "الخريطة الحية",
    "nav.booking": "الحجوزات",
    "nav.clinical": "السجل السريري",
    "nav.pharmacy": "الصيدلية",
    "nav.admin": "الإدارة",
    "nav.portal": "البوابة",
    "pharma.heading": "الصيدلية الإلكترونية والدفع والتوصيل الفوري",
    "pharma.subtitle":
      "تصفح الصيدليات المعتمدة، أضف الأدوية والمستلزمات الطبية، اربط الوصفة الرقمية وأكمل الدفع بأمان.",
    "pharma.searchPlaceholder": "ابحث عن دواء أو رمز المنتج...",
    "pharma.addToCart": "إضافة للسلة",
    "pharma.cartTitle": "سلة المشتريات والدفع",
    "pharma.placeOrder": "تأكيد الطلب والدفع",
    "pharma.emptyCart": "أضف أدوية أو مستلزمات طبية للبدء في الطلب.",
    "pharma.ordersTitle": "الطلبات وإيصالات الدفع",
    "portal.recoveryTab": "التحقق والاستعادة",
  },
};

function readInitialClientLocale(): LocaleCode {
  if (typeof window === "undefined") return "en";
  if (!initializedFromStorage) {
    initializedFromStorage = true;
    try {
      const saved = window.localStorage.getItem(LOCALE_STORAGE_KEY);
      if (saved === "en" || saved === "fr" || saved === "ar") {
        currentLocaleCache = saved;
      }
    } catch {
      currentLocaleCache = "en";
    }
  }
  return currentLocaleCache;
}

function subscribeLocale(callback: () => void): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }
  const handler = () => callback();
  window.addEventListener(LOCALE_EVENT, handler);
  return () => window.removeEventListener(LOCALE_EVENT, handler);
}

function getServerLocaleSnapshot(): LocaleCode {
  return "en";
}

export function setAppLocale(next: LocaleCode): void {
  currentLocaleCache = next;
  initializedFromStorage = true;
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(LOCALE_STORAGE_KEY, next);
    } catch {
      // Ignore storage quota errors
    }
    window.dispatchEvent(new Event(LOCALE_EVENT));
  }
}

export function useLocale(): {
  locale: LocaleCode;
  setLocale: (next: LocaleCode) => void;
  t: (key: string) => string;
  isRtl: boolean;
} {
  const locale = useSyncExternalStore(
    subscribeLocale,
    readInitialClientLocale,
    getServerLocaleSnapshot,
  );

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = locale;
      document.documentElement.dir = locale === "ar" ? "rtl" : "ltr";
    }
  }, [locale]);

  return {
    locale,
    setLocale: setAppLocale,
    t: (key: string) => TRANSLATIONS[locale][key] ?? TRANSLATIONS.en[key] ?? key,
    isRtl: locale === "ar",
  };
}
