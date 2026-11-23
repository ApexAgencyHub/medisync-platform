import type {
  AuthResponse,
  AuthenticatedUser,
  LocaleCode,
  UserRole,
} from "@medisync/contracts";
import { clearStoredSession, writeStoredSession } from "./session-storage";
import { isPendingStaffVerification } from "../ui/VerificationGateNotice";

export const VISIT_NOTE_VIEWER_ROLES: ReadonlySet<UserRole> = new Set([
  "PATIENT",
  "CAREGIVER",
  "DOCTOR",
  "NURSE",
  "OPS_ADMIN",
]);

export const RX_VIEWER_ROLES: ReadonlySet<UserRole> = new Set([
  "PATIENT",
  "CAREGIVER",
  "DOCTOR",
  "PHARMACIST",
  "OPS_ADMIN",
]);

export const LAB_ORDER_VIEWER_ROLES: ReadonlySet<UserRole> = new Set([
  "PATIENT",
  "CAREGIVER",
  "DOCTOR",
  "NURSE",
  "LAB_TECH",
  "OPS_ADMIN",
]);

export const PATIENT_DIRECTORY_VIEWER_ROLES: ReadonlySet<UserRole> = new Set([
  "PATIENT",
  "CAREGIVER",
  "DOCTOR",
  "NURSE",
  "CLINIC_STAFF",
  "HOSPITAL_ADMIN",
  "LAB_TECH",
  "OPS_ADMIN",
]);

export const BOOKING_VIEWER_ROLES: ReadonlySet<UserRole> = new Set([
  "PATIENT",
  "CAREGIVER",
  "DOCTOR",
  "NURSE",
  "CLINIC_STAFF",
  "HOSPITAL_ADMIN",
  "OPS_ADMIN",
]);

export const BOOKING_CREATOR_ROLES: ReadonlySet<UserRole> = new Set([
  "PATIENT",
  "CAREGIVER",
  "CLINIC_STAFF",
  "HOSPITAL_ADMIN",
  "OPS_ADMIN",
]);

export const EHR_ACCESS_ROLES: ReadonlySet<UserRole> = new Set([
  "PATIENT",
  "CAREGIVER",
  "DOCTOR",
  "NURSE",
  "OPS_ADMIN",
]);

export const DISPATCH_CREATOR_ROLES: ReadonlySet<UserRole> = new Set([
  "PATIENT",
  "CAREGIVER",
  "CLINIC_STAFF",
  "HOSPITAL_ADMIN",
  "OPS_ADMIN",
]);

export const PHARMACY_ORDER_VIEWER_ROLES: ReadonlySet<UserRole> = new Set([
  "PATIENT",
  "CAREGIVER",
  "PHARMACIST",
  "HOSPITAL_ADMIN",
  "DRIVER",
  "OPS_ADMIN",
]);

export const ADMIN_GOVERNANCE_ROLES: ReadonlySet<UserRole> = new Set([
  "OPS_ADMIN",
]);

/**
 * Checks whether a role + verification state unlocks a capability gated by backend RBAC.
 */
export function hasRoleCapability(
  role: UserRole | null | undefined,
  isPending: boolean,
  allowedRoles?: ReadonlySet<UserRole>,
): boolean {
  if (!role || isPending) return false;
  if (!allowedRoles) return true;
  return allowedRoles.has(role);
}

export function isVerifiedAuthenticatedUser(
  user: AuthenticatedUser | null | undefined,
): boolean {
  return Boolean(user) && !isPendingStaffVerification(user);
}

function canUserAccess(
  user: AuthenticatedUser | null | undefined,
  allowedRoles?: ReadonlySet<UserRole>,
): boolean {
  return hasRoleCapability(
    user?.role,
    isPendingStaffVerification(user),
    allowedRoles,
  );
}

export function canReadVisitNotes(
  user: AuthenticatedUser | null | undefined,
): boolean {
  return canUserAccess(user, VISIT_NOTE_VIEWER_ROLES);
}

export function canReadPrescriptions(
  user: AuthenticatedUser | null | undefined,
): boolean {
  return canUserAccess(user, RX_VIEWER_ROLES);
}

export function canReadLabOrders(
  user: AuthenticatedUser | null | undefined,
): boolean {
  return canUserAccess(user, LAB_ORDER_VIEWER_ROLES);
}

export function canReadPatientDirectory(
  user: AuthenticatedUser | null | undefined,
): boolean {
  return canUserAccess(user, PATIENT_DIRECTORY_VIEWER_ROLES);
}

export function canReadAppointments(
  user: AuthenticatedUser | null | undefined,
): boolean {
  return canUserAccess(user, BOOKING_VIEWER_ROLES);
}

export function canCreateAppointment(
  user: AuthenticatedUser | null | undefined,
): boolean {
  return canUserAccess(user, BOOKING_CREATOR_ROLES);
}

export function canReadClinicalEhr(
  user: AuthenticatedUser | null | undefined,
): boolean {
  return canUserAccess(user, EHR_ACCESS_ROLES);
}

export function canReadDispatchFeed(
  user: AuthenticatedUser | null | undefined,
): boolean {
  return canUserAccess(user);
}

export function canCreateDispatch(
  user: AuthenticatedUser | null | undefined,
): boolean {
  return canUserAccess(user, DISPATCH_CREATOR_ROLES);
}

export function canReadPharmacyOrders(
  user: AuthenticatedUser | null | undefined,
): boolean {
  return canUserAccess(user, PHARMACY_ORDER_VIEWER_ROLES);
}

export function canManageAdminOps(
  user: AuthenticatedUser | null | undefined,
): boolean {
  return canUserAccess(user, ADMIN_GOVERNANCE_ROLES);
}

/** Public patient-facing routes exposed to guests, patients, and family caregivers. */
export const CONSUMER_MENU_ROUTES: readonly string[] = [
  "/",
  "/patient",
  "/profiles",
  "/map",
  "/booking",
  "/pharmacy",
  "/portal",
];

/** Canonical home workspace per authenticated user role and verification state. */
export function getPrimaryWorkspaceForUser(
  user: AuthenticatedUser | null | undefined,
  locale: LocaleCode = "en",
): { href: string; label: string } {
  if (!user) {
    return {
      href: "/",
      label:
        locale === "ar"
          ? "العودة لصفحة الرعاية الصحية"
          : locale === "fr"
            ? "Retour aux soins MediSync"
            : "Return to MediSync Patient Care",
    };
  }
  if (isPendingStaffVerification(user)) {
    return {
      href: "/pro",
      label:
        locale === "ar"
          ? "عرض حالة التحقق في بوابة المهنيين"
          : locale === "fr"
            ? "Voir la validation sur MediSync Pro"
            : "View Onboarding on MediSync Pro",
    };
  }
  switch (user.role) {
    case "DRIVER":
      return {
        href: "/driver",
        label:
          locale === "ar"
            ? "فتح مساحة عمل السائق"
            : locale === "fr"
              ? "Ouvrir l'espace Chauffeur"
              : "Open Driver Relay Workspace",
      };
    case "PHARMACIST":
      return {
        href: "/pharmacy",
        label:
          locale === "ar"
            ? "فتح مكتب الصيدلية"
            : locale === "fr"
              ? "Ouvrir l'officine Pharmacie"
              : "Open Pharmacy Desk",
      };
    case "OPS_ADMIN":
      return {
        href: "/admin",
        label:
          locale === "ar"
            ? "فتح مكتب الإدارة العامة"
            : locale === "fr"
              ? "Ouvrir le bureau Administration"
              : "Open Administration Desk",
      };
    case "HOSPITAL_ADMIN":
    case "CLINIC_STAFF":
      return {
        href: "/hospital",
        label:
          locale === "ar"
            ? "فتح مكتب استقبال المستشفى والعيادة"
            : locale === "fr"
              ? "Ouvrir l'accueil Hôpital & Clinique"
              : "Open Hospital & Clinic Desk",
      };
    case "LAB_TECH":
      return {
        href: "/lab",
        label:
          locale === "ar"
            ? "فتح مختبر التحاليل والأشعة"
            : locale === "fr"
              ? "Ouvrir le laboratoire d'analyses"
              : "Open Diagnostic Lab Workbench",
      };
    case "DOCTOR":
      return {
        href: "/clinical",
        label:
          locale === "ar"
            ? "فتح العيادة وجدول المواعيد"
            : locale === "fr"
              ? "Ouvrir l'espace Clinique & Agenda"
              : "Open Clinical & Calendar Workspace",
      };
    case "NURSE":
      return {
        href: "/nurse",
        label:
          locale === "ar"
            ? "فتح محطة التمريض والرعاية المنزلية"
            : locale === "fr"
              ? "Ouvrir le Poste Infirmier & Soins"
              : "Open Nursing & Home Care Station",
      };
    default:
      return {
        href: "/patient",
        label:
          locale === "ar"
            ? "فتح ملف الرعاية الخاص بي"
            : locale === "fr"
              ? "Ouvrir Mon Espace Santé"
              : "Open My Care Hub",
      };
  }
}

export function isConsumerUserOrGuest(
  user: AuthenticatedUser | null | undefined,
): boolean {
  return !user || user.role === "PATIENT" || user.role === "CAREGIVER";
}

function getPendingStaffRouteForRole(role: UserRole): string {
  switch (role) {
    case "DRIVER":
      return "/driver";
    case "LAB_TECH":
      return "/lab";
    case "DOCTOR":
      return "/clinical";
    case "NURSE":
      return "/nurse";
    case "CLINIC_STAFF":
    case "HOSPITAL_ADMIN":
      return "/hospital";
    case "PHARMACIST":
      return "/pharmacy";
    case "OPS_ADMIN":
      return "/admin";
    default:
      return "/patient";
  }
}

/**
 * Industry role-scoped menu visibility:
 * - Guests & patients only see consumer care routes (zero worker/admin portals in menu).
 * - Verified staff see only workspaces belonging to their profession.
 */
export function getAllowedMenuRoutes(
  user: AuthenticatedUser | null | undefined,
): ReadonlySet<string> {
  if (isConsumerUserOrGuest(user)) {
    return new Set(
      user ? [...CONSUMER_MENU_ROUTES, "/profile"] : CONSUMER_MENU_ROUTES,
    );
  }
  if (isPendingStaffVerification(user)) {
    return new Set([
      "/pro",
      "/profile",
      getPendingStaffRouteForRole(user!.role),
    ]);
  }
  switch (user!.role) {
    case "DRIVER":
      return new Set(["/driver", "/profile", "/pro"]);
    case "LAB_TECH":
      return new Set(["/lab", "/profile", "/pro"]);
    case "PHARMACIST":
      return new Set(["/pharmacy", "/profile", "/pro"]);
    case "DOCTOR":
      return new Set(["/clinical", "/profile", "/pro"]);
    case "NURSE":
      return new Set(["/nurse", "/profile", "/pro"]);
    case "CLINIC_STAFF":
    case "HOSPITAL_ADMIN":
      return new Set(["/hospital", "/profile", "/pro"]);
    case "OPS_ADMIN":
      return new Set(["/admin", "/profile", "/pro"]);
    default:
      return new Set(
        user ? [...CONSUMER_MENU_ROUTES, "/profile"] : CONSUMER_MENU_ROUTES,
      );
  }
}

export function isRoleAuthorizedForWorkspace(
  user: AuthenticatedUser | null | undefined,
  allowedRoles: readonly UserRole[],
): boolean {
  return Boolean(user && allowedRoles.includes(user.role));
}

/**
 * Refreshes cached user state from /v1/auth/me when a worker is awaiting admin approval
 * (or when forced on workspace reload) and clears expired 401 sessions cleanly.
 */
export async function syncPendingSessionStatus(
  apiBaseUrl: string,
  session: AuthResponse | null,
  options?: { force?: boolean },
): Promise<{
  status: "unchanged" | "updated" | "expired";
  session: AuthResponse | null;
}> {
  if (!session) {
    return { status: "unchanged", session: null };
  }
  if (!options?.force && !isPendingStaffVerification(session.user)) {
    return { status: "unchanged", session };
  }

  try {
    const response = await fetch(`${apiBaseUrl}/v1/auth/me`, {
      credentials: "include",
      headers: { Authorization: `Bearer ${session.token}` },
      cache: "no-store",
    });

    if (response.status === 401) {
      clearStoredSession();
      return { status: "expired", session: null };
    }

    if (response.status === 403) {
      const errBody = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;
      if (errBody?.error === "ACCOUNT_SUSPENDED") {
        clearStoredSession();
        return { status: "expired", session: null };
      }
      return { status: "unchanged", session };
    }

    if (!response.ok) {
      return { status: "unchanged", session };
    }

    const payload = (await response.json()) as { user?: AuthenticatedUser };
    const refreshedUser = payload?.user;
    if (!refreshedUser || !refreshedUser.id) {
      return { status: "unchanged", session };
    }

    const prev = session.user;
    const changed =
      refreshedUser.accountStatus !== prev.accountStatus ||
      refreshedUser.credentialVerified !== prev.credentialVerified ||
      refreshedUser.role !== prev.role ||
      refreshedUser.facilityId !== prev.facilityId ||
      refreshedUser.countryCode !== prev.countryCode ||
      refreshedUser.fullName !== prev.fullName ||
      refreshedUser.phone !== prev.phone ||
      refreshedUser.emailVerified !== prev.emailVerified ||
      refreshedUser.phoneVerified !== prev.phoneVerified ||
      refreshedUser.avatarUrl !== prev.avatarUrl;

    if (!changed) {
      return { status: "unchanged", session };
    }

    const updatedSession: AuthResponse = {
      token: session.token,
      user: refreshedUser,
    };
    writeStoredSession(updatedSession);
    return { status: "updated", session: updatedSession };
  } catch {
    return { status: "unchanged", session };
  }
}
