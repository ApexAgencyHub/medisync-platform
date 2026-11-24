"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { AuthenticatedUser } from "@medisync/contracts";
import {
  Ambulance,
  Building2,
  CalendarCheck2,
  ChevronRight,
  FlaskConical,
  Globe,
  HeartHandshake,
  HeartPulse,
  Home,
  Hospital,
  LogOut,
  Map as MapIcon,
  Menu,
  Pill,
  ShieldCheck,
  Stethoscope,
  User,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { resolveCountryPack } from "@medisync/country-packs";
import { resolveEffectiveCountryCode } from "../config/deployment";
import { BrandMark } from "./BrandMark";
import { EntityAvatar } from "./EntityAvatar";
import { isPendingStaffVerification } from "./VerificationGateNotice";
import { LocaleTogglePill } from "../i18n/LocaleTogglePill";
import { useLocale } from "../i18n/locale-store";
import { formatRoleLabel } from "../i18n/human-labels";
import {
  getAllowedMenuRoutes,
  getPrimaryWorkspaceForUser,
  isConsumerUserOrGuest,
} from "../auth/role-capabilities";
import {
  readStoredSession,
  revokeClientSession,
  SESSION_CHANGE_EVENT,
} from "../auth/session-storage";

export type AppRouteKey =
  | "/"
  | "/patient"
  | "/profiles"
  | "/profile"
  | "/map"
  | "/driver"
  | "/hospital"
  | "/booking"
  | "/clinical"
  | "/nurse"
  | "/lab"
  | "/pharmacy"
  | "/admin"
  | "/portal"
  | "/pro";

export interface OsNavItem {
  href: AppRouteKey;
  code: string;
  labelKey: string;
  subtitleKey: string;
  icon: typeof Home;
}

export const ATLAS_NAV_ITEMS: readonly OsNavItem[] = [
  { href: "/", code: "00", labelKey: "nav.overview", subtitleKey: "navSub./", icon: Home },
  { href: "/map", code: "01", labelKey: "nav.map", subtitleKey: "navSub./map", icon: MapIcon },
  {
    href: "/booking",
    code: "02",
    labelKey: "nav.booking",
    subtitleKey: "navSub./booking",
    icon: CalendarCheck2,
  },
  {
    href: "/pharmacy",
    code: "03",
    labelKey: "nav.pharmacy",
    subtitleKey: "navSub./pharmacy",
    icon: Pill,
  },
  {
    href: "/patient",
    code: "04",
    labelKey: "nav.patient",
    subtitleKey: "navSub./patient",
    icon: HeartHandshake,
  },
  {
    href: "/profiles",
    code: "05",
    labelKey: "nav.profiles",
    subtitleKey: "navSub./profiles",
    icon: Users,
  },
  {
    href: "/driver",
    code: "D1",
    labelKey: "nav.driver",
    subtitleKey: "navSub./driver",
    icon: Ambulance,
  },
  {
    href: "/clinical",
    code: "M1",
    labelKey: "nav.clinical",
    subtitleKey: "navSub./clinical",
    icon: Stethoscope,
  },
  {
    href: "/nurse",
    code: "N1",
    labelKey: "nav.nurse",
    subtitleKey: "navSub./nurse",
    icon: HeartPulse,
  },
  {
    href: "/hospital",
    code: "H1",
    labelKey: "nav.hospital",
    subtitleKey: "navSub./hospital",
    icon: Hospital,
  },
  {
    href: "/lab",
    code: "L1",
    labelKey: "nav.lab",
    subtitleKey: "navSub./lab",
    icon: FlaskConical,
  },
  {
    href: "/admin",
    code: "A1",
    labelKey: "nav.admin",
    subtitleKey: "navSub./admin",
    icon: ShieldCheck,
  },
  {
    href: "/portal",
    code: "ID",
    labelKey: "nav.portal",
    subtitleKey: "navSub./portal",
    icon: Building2,
  },
  {
    href: "/pro",
    code: "PR",
    labelKey: "nav.pro",
    subtitleKey: "navSub./pro",
    icon: ShieldCheck,
  },
  {
    href: "/profile",
    code: "AC",
    labelKey: "nav.profile",
    subtitleKey: "navSub./profile",
    icon: User,
  },
];

const ROUTE_MEDICAL_LABEL: Record<
  "en" | "fr" | "ar",
  Record<AppRouteKey, string>
> = {
  en: {
    "/": "Morocco Healthcare Network",
    "/patient": "Patient Health Hub",
    "/profiles": "Verified Care Directory",
    "/profile": "My Medical Account",
    "/map": "Live Care Map & Dispatch",
    "/driver": "Medical Transport Console",
    "/hospital": "Hospital Reception Desk",
    "/booking": "Doctor Appointments",
    "/clinical": "Physician Workspace",
    "/nurse": "Nursing Care Station",
    "/lab": "Diagnostic Laboratory",
    "/pharmacy": "24/7 Duty Pharmacy",
    "/admin": "Clinical Operations & Compliance",
    "/portal": "Patient Sign In",
    "/pro": "Healthcare Professionals",
  },
  fr: {
    "/": "Réseau de Santé Maroc",
    "/patient": "Espace Santé Patient",
    "/profiles": "Annuaire Médical Vérifié",
    "/profile": "Mon Compte Médical",
    "/map": "Carte des Soins en Direct",
    "/driver": "Transport Sanitaire",
    "/hospital": "Accueil Hospitalier",
    "/booking": "Rendez-vous Médicaux",
    "/clinical": "Espace Médecin",
    "/nurse": "Soins Infirmiers",
    "/lab": "Laboratoire d'Analyses",
    "/pharmacy": "Pharmacies de Garde 24/7",
    "/admin": "Conformité & Opérations",
    "/portal": "Connexion Patient",
    "/pro": "Professionnels de Santé",
  },
  ar: {
    "/": "شبكة الرعاية الصحية بالمغرب",
    "/patient": "بوابة صحة المريض",
    "/profiles": "دليل الأطباء والمرافق",
    "/profile": "حسابي الصحي",
    "/map": "خريطة الرعاية المباشرة",
    "/driver": "النقل الطبي والإسعاف",
    "/hospital": "استقبال المستشفى",
    "/booking": "مواعيد الأطباء",
    "/clinical": "عيادة الطبيب",
    "/nurse": "محطة التمريض",
    "/lab": "مختبر التحاليل",
    "/pharmacy": "صيدليات الحراسة 24/7",
    "/admin": "الإدارة والامتثال الطبي",
    "/portal": "دخول المرضى",
    "/pro": "المهنيون الصحيون",
  },
};

const CONSUMER_CARE_ROUTES: ReadonlySet<AppRouteKey> = new Set([
  "/",
  "/map",
  "/booking",
  "/pharmacy",
]);

function DrawerNavRow({
  item,
  isActive,
  onNavigate,
}: {
  item: OsNavItem;
  isActive: boolean;
  onNavigate: () => void;
}) {
  const { t } = useLocale();
  const Icon = item.icon;
  const label = t(item.labelKey);

  return (
    <Link
      href={item.href}
      aria-label={label}
      onClick={onNavigate}
      aria-current={isActive ? "page" : undefined}
      className={
        isActive
          ? "group flex min-h-[46px] items-center gap-3 rounded-xl border border-[#BFDBFE] bg-[#EBF4FF] px-3 py-2 text-start"
          : "group flex min-h-[46px] items-center gap-3 rounded-xl border border-transparent px-3 py-2 text-start transition-colors hover:border-[#D7E4F2] hover:bg-[#F3F8FD]"
      }
    >
      <span
        className={
          isActive
            ? "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#0066CC] text-white shadow-xs"
            : "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#D7E4F2] bg-white text-[#4A627D] group-hover:border-[#BFDBFE] group-hover:text-[#0066CC]"
        }
      >
        <Icon className="h-4 w-4" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span
          className={
            isActive
              ? "block truncate text-sm font-semibold text-[#0052A3]"
              : "block truncate text-sm font-medium text-[#0F243E]"
          }
        >
          {label}
        </span>
        <span className="block truncate text-[11.5px] leading-tight text-[#6B829D]">
          {t(item.subtitleKey)}
        </span>
      </span>
      <ChevronRight
        className={`h-4 w-4 shrink-0 rtl:rotate-180 ${
          isActive ? "text-[#0066CC]" : "text-[#B7CDE4] group-hover:text-[#0066CC]"
        }`}
        aria-hidden="true"
      />
    </Link>
  );
}

function DrawerAccountStrip({
  sessionUser,
  onNavigate,
}: {
  sessionUser: AuthenticatedUser | null;
  onNavigate: () => void;
}) {
  const { locale, t } = useLocale();

  if (!sessionUser) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-[#D7E4F2] bg-[#F3F8FD] px-3.5 py-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#D7E4F2] bg-white text-[#0066CC]">
            <User className="h-4 w-4" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold text-[#0F243E]">
              {t("menu.guestTitle")}
            </p>
            <p className="truncate text-[11px] text-[#6B829D]">
              {t("menu.guestSubtitle")}
            </p>
          </div>
        </div>
        <Link
          href="/portal"
          onClick={onNavigate}
          className="shrink-0 rounded-xl bg-[#0066CC] px-3.5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-[#0052A3]"
        >
          {t("menu.signInCta")}
        </Link>
      </div>
    );
  }

  const pendingStaff = isPendingStaffVerification(sessionUser);

  return (
    <Link
      href="/profile"
      onClick={onNavigate}
      className="group flex items-center justify-between gap-3 rounded-2xl border border-[#D7E4F2] bg-[#F3F8FD] px-3.5 py-3 transition-colors hover:border-[#BFDBFE] hover:bg-white"
    >
      <div className="flex min-w-0 items-center gap-2.5">
        <EntityAvatar
          name={sessionUser.fullName}
          role={sessionUser.role}
          avatarUrl={sessionUser.avatarUrl}
          size="xs"
        />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-[#0F243E]">
            <bdi dir="auto">{sessionUser.fullName}</bdi>
          </p>
          <p className="flex items-center gap-1.5 truncate text-[11px] text-[#6B829D]">
            <span className="truncate font-medium text-[#4A627D]">
              {formatRoleLabel(sessionUser.role, locale)}
            </span>
            <span aria-hidden="true">·</span>
            <span
              className={
                pendingStaff
                  ? "font-medium text-amber-700"
                  : "font-medium text-[#0066CC]"
              }
            >
              {pendingStaff ? t("menu.staffPending") : t("menu.manageAccount")}
            </span>
          </p>
        </div>
      </div>
      <ChevronRight
        className="h-4 w-4 shrink-0 text-[#87A0BC] rtl:rotate-180"
        aria-hidden="true"
      />
    </Link>
  );
}

interface AppHeaderProps {
  activeRoute: AppRouteKey;
  statusPill?: string;
}

export function AppHeader({ activeRoute, statusPill }: AppHeaderProps) {
  const { locale, t } = useLocale();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sessionUser, setSessionUser] = useState<AuthenticatedUser | null>(
    null,
  );

  useEffect(() => {
    if (typeof document === "undefined") return;
    const navKeyMap: Record<AppRouteKey, string> = {
      "/": "home.title",
      "/patient": "patient.heading",
      "/profiles": "profiles.heading",
      "/profile": "profile.heading",
      "/map": "map.heading",
      "/booking": "booking.heading",
      "/pharmacy": "pharma.heading",
      "/portal": "portal.heading",
      "/pro": "pro.heading",
      "/clinical": "clinical.heading",
      "/nurse": "nurse.heading",
      "/hospital": "hospital.heading",
      "/lab": "lab.heading",
      "/driver": "nav.driver",
      "/admin": "admin.heading",
    };
    if (activeRoute === "/pharmacy" && sessionUser?.role === "PHARMACIST") {
      document.title =
        locale === "fr"
          ? "Comptoir Pharmacie & Stock — MediSync Global"
          : locale === "ar"
            ? "مكتب الصيدلي والمخزون — MediSync Global"
            : "Pharmacist Dispense & Inventory Desk — MediSync Global";
      return;
    }
    const localized = t(navKeyMap[activeRoute]);
    if (localized && localized !== navKeyMap[activeRoute]) {
      document.title = `${localized} — MediSync Global`;
    }
  }, [activeRoute, locale, sessionUser?.role, t]);

  useEffect(() => {
    const syncSession = () => {
      setSessionUser(readStoredSession()?.user ?? null);
    };
    syncSession();
    window.addEventListener(SESSION_CHANGE_EVENT, syncSession);
    window.addEventListener("storage", syncSession);
    return () => {
      window.removeEventListener(SESSION_CHANGE_EVENT, syncSession);
      window.removeEventListener("storage", syncSession);
    };
  }, []);

  useEffect(() => {
    if (!sidebarOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSidebarOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [sidebarOpen]);

  const allowedRoutes = getAllowedMenuRoutes(sessionUser);
  const visibleNavItems = ATLAS_NAV_ITEMS.filter((item) =>
    allowedRoutes.has(item.href),
  );
  const showConsumerRecruitment = isConsumerUserOrGuest(sessionUser);
  const brandHomeHref = showConsumerRecruitment
    ? "/"
    : getPrimaryWorkspaceForUser(sessionUser).href;
  const consumerCareItems = visibleNavItems.filter((item) =>
    CONSUMER_CARE_ROUTES.has(item.href),
  );
  const consumerAccountItems = visibleNavItems.filter(
    (item) => !CONSUMER_CARE_ROUTES.has(item.href),
  );

  const routeMedicalTitle =
    (ROUTE_MEDICAL_LABEL[locale] ?? ROUTE_MEDICAL_LABEL.en)[activeRoute];
  const emergencyHotline = resolveCountryPack(
    resolveEffectiveCountryCode(sessionUser?.countryCode),
  ).emergencyHotlines.ambulance;
  const emergencyBadgeLabel =
    locale === "fr"
      ? `Urgences ${emergencyHotline}`
      : locale === "ar"
        ? `إسعاف ${emergencyHotline}`
        : `24/7 Emergency ${emergencyHotline}`;

  return (
    <>
      <header className="sticky top-0 z-[45] w-full shrink-0 border-b border-[#D7E4F2] bg-white/95 text-[#0F243E] shadow-[0_2px_12px_-6px_rgba(0,102,204,0.08)] backdrop-blur-md">
        <div className="flex h-14 items-center justify-between gap-2.5 px-3 sm:px-5 xl:h-16 xl:gap-3 xl:px-6">
          <Link href={brandHomeHref} className="min-w-0 shrink-0">
            <BrandMark />
          </Link>

          {/* Clean Medical Status Pill (pure status metadata, zero nav/lang controls) */}
          <div
            aria-hidden="true"
            className="hidden items-center gap-2 whitespace-nowrap rounded-full border border-[#D7E4F2] bg-[#F3F8FD] px-3 py-1 text-[11.5px] font-medium text-[#4A627D] lg:flex xl:gap-2.5 xl:px-4 xl:py-1.5 xl:text-xs"
          >
            <span className="inline-flex items-center gap-1.5 font-semibold text-[#0F243E]">
              <HeartPulse className="h-3.5 w-3.5 text-[#0066CC]" />
              <span>{routeMedicalTitle}</span>
            </span>
            <span className="text-[#B7CDE4]">·</span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-2 py-0.5 text-[10.5px] font-semibold text-[#DC2626] ring-1 ring-rose-200 xl:px-2.5 xl:text-[11px]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#DC2626]" />
              <span>{emergencyBadgeLabel}</span>
            </span>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {sessionUser ? (
              <div className="hidden items-center gap-1 rounded-full border border-[#D7E4F2] bg-[#F3F8FD] ps-2.5 pe-1 py-0.5 text-[11.5px] font-medium text-[#0F243E] sm:inline-flex xl:ps-3 xl:text-xs">
                <Link
                  href="/profile"
                  className="inline-flex items-center gap-1.5 py-0.5 hover:text-[#0066CC]"
                >
                  <span
                    aria-hidden="true"
                    className={`h-2 w-2 rounded-full ${
                      isPendingStaffVerification(sessionUser)
                        ? "bg-amber-500"
                        : "bg-[#0F9D88]"
                    }`}
                  />
                  <span className="max-w-[115px] truncate font-semibold xl:max-w-[150px]">
                    <bdi dir="auto">{sessionUser.fullName}</bdi>
                  </span>
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    revokeClientSession();
                    setSessionUser(null);
                  }}
                  aria-label="Sign out"
                  title="Sign out"
                  className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[#556E89] transition-colors hover:bg-rose-50 hover:text-[#DC2626] active:scale-95 xl:h-7 xl:w-7"
                >
                  <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </div>
            ) : null}

            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              aria-label={t("menu.open")}
              aria-expanded={sidebarOpen}
              className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl border border-[#CBDDF0] bg-white px-3 text-xs font-semibold text-[#0F243E] shadow-2xs transition-colors hover:border-[#0066CC] hover:bg-[#F3F8FD] active:scale-[0.98] xl:h-10 xl:gap-2 xl:px-3.5"
            >
              <Menu className="h-4 w-4 shrink-0 text-[#0066CC]" aria-hidden="true" />
              <span className="hidden min-[360px]:inline">{t("menu.title")}</span>
            </button>
          </div>
        </div>
      </header>

      {sidebarOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t("menu.title")}
          className="ms-backdrop-in fixed inset-0 z-[70] flex justify-end bg-[#0F243E]/25 backdrop-blur-[2px]"
          onClick={() => setSidebarOpen(false)}
        >
          <aside
            className="ms-drawer-in flex h-dvh w-[368px] max-w-[92vw] flex-col border-s border-[#D7E4F2] bg-white text-[#0F243E] shadow-[-16px_0_40px_-12px_rgba(15,36,62,0.16)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="shrink-0 space-y-3 border-b border-[#D7E4F2] px-4 py-4">
              <div className="flex items-center justify-between gap-2">
                <BrandMark />
                <button
                  type="button"
                  onClick={() => setSidebarOpen(false)}
                  aria-label={t("menu.close")}
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#D7E4F2] bg-[#F3F8FD] text-[#4A627D] hover:border-[#0066CC] hover:bg-white hover:text-[#0F243E]"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>

              <DrawerAccountStrip
                sessionUser={sessionUser}
                onNavigate={() => setSidebarOpen(false)}
              />

              {statusPill ? (
                <p className="rounded-full border border-[#BFDBFE] bg-[#EBF4FF] px-3 py-1 text-center text-[11px] font-semibold text-[#0052A3]">
                  {t(statusPill)}
                </p>
              ) : null}
            </div>

            <nav
              aria-label="Sidebar Workspace Navigation"
              className="min-h-0 flex-1 space-y-4 overflow-y-auto px-3 py-3.5 [scrollbar-width:thin]"
            >
              {showConsumerRecruitment ? (
                <>
                  <section className="space-y-1">
                    <p className="px-3 pb-1 text-[11px] font-semibold text-[#6B829D]">
                      {t("menu.sectionCare")}
                    </p>
                    <div className="space-y-1">
                      {consumerCareItems.map((item) => (
                        <DrawerNavRow
                          key={item.href}
                          item={item}
                          isActive={item.href === activeRoute}
                          onNavigate={() => setSidebarOpen(false)}
                        />
                      ))}
                    </div>
                  </section>

                  <section className="space-y-1 border-t border-[#E8F1FA] pt-3">
                    <p className="px-3 pb-1 text-[11px] font-semibold text-[#6B829D]">
                      {t("menu.sectionAccount")}
                    </p>
                    <div className="space-y-1">
                      {consumerAccountItems.map((item) => (
                        <DrawerNavRow
                          key={item.href}
                          item={item}
                          isActive={item.href === activeRoute}
                          onNavigate={() => setSidebarOpen(false)}
                        />
                      ))}
                    </div>
                  </section>
                </>
              ) : (
                <section className="space-y-1">
                  <p className="px-3 pb-1 text-[11px] font-semibold text-[#6B829D]">
                    {sessionUser
                      ? formatRoleLabel(sessionUser.role, locale)
                      : t("menu.navigation")}
                  </p>
                  <div className="space-y-1">
                    {visibleNavItems.map((item) => (
                      <DrawerNavRow
                        key={item.href}
                        item={item}
                        isActive={item.href === activeRoute}
                        onNavigate={() => setSidebarOpen(false)}
                      />
                    ))}
                  </div>
                </section>
              )}
            </nav>

            <div className="shrink-0 space-y-3 border-t border-[#D7E4F2] bg-[#F3F8FD] px-4 py-4">
              <div className="space-y-1.5">
                <p className="flex items-center gap-1.5 px-0.5 text-[11px] font-semibold text-[#4A627D]">
                  <Globe className="h-3.5 w-3.5 text-[#0066CC]" aria-hidden="true" />
                  <span>{t("menu.language")}</span>
                </p>
                <LocaleTogglePill />
              </div>

              {showConsumerRecruitment ? (
                <div className="space-y-2">
                  {sessionUser ? (
                    <button
                      type="button"
                      onClick={() => {
                        revokeClientSession();
                        setSessionUser(null);
                        setSidebarOpen(false);
                      }}
                      className="flex min-h-[40px] w-full items-center justify-center gap-2 rounded-xl border border-rose-200 bg-white px-3 py-2 text-xs font-semibold text-[#DC2626] hover:bg-rose-50 active:scale-[0.98]"
                    >
                      <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>
                        {locale === "fr"
                          ? "Se déconnecter"
                          : locale === "ar"
                            ? "تسجيل الخروج"
                            : "Sign Out"}
                      </span>
                    </button>
                  ) : null}
                  <Link
                    href="/pro"
                    onClick={() => setSidebarOpen(false)}
                    className="group flex items-center justify-between gap-2.5 rounded-xl border border-[#D7E4F2] bg-white px-3 py-2.5 transition-colors hover:border-[#0066CC]"
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#0066CC] text-white">
                        <UserPlus className="h-4 w-4" aria-hidden="true" />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-xs font-semibold text-[#0F243E]">
                          {t("menu.partnerTitle")}
                        </p>
                        <p className="truncate text-[11px] text-[#6B829D]">
                          {t("menu.partnerSubtitle")}
                        </p>
                      </div>
                    </div>
                    <ChevronRight
                      className="h-4 w-4 shrink-0 text-[#87A0BC] rtl:rotate-180"
                      aria-hidden="true"
                    />
                  </Link>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    revokeClientSession();
                    setSessionUser(null);
                    setSidebarOpen(false);
                  }}
                  className="flex min-h-[40px] w-full items-center justify-center gap-2 rounded-xl border border-rose-200 bg-white px-3 py-2 text-xs font-semibold text-[#DC2626] hover:bg-rose-50 active:scale-[0.98]"
                >
                  <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>{t("menu.signOutStaff")}</span>
                </button>
              )}
            </div>
          </aside>
        </div>
      ) : null}
    </>
  );
}
