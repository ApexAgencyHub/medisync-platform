"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  getPrimaryWorkspaceForUser,
  isConsumerUserOrGuest,
} from "@/shared/auth/role-capabilities";
import {
  SESSION_CHANGE_EVENT,
  readStoredSession,
} from "@/shared/auth/session-storage";
import { isPendingStaffVerification } from "@/shared/ui/VerificationGateNotice";

/**
 * Automatically routes verified non-consumer staff and admins away from the
 * consumer landing page `/` directly into their dedicated role dashboard.
 */
export function ConsumerHomeRedirect() {
  const router = useRouter();

  useEffect(() => {
    const syncRedirect = () => {
      const user = readStoredSession()?.user ?? null;
      if (
        !user ||
        isConsumerUserOrGuest(user) ||
        isPendingStaffVerification(user)
      ) {
        return;
      }
      router.replace(getPrimaryWorkspaceForUser(user).href);
    };

    syncRedirect();
    window.addEventListener(SESSION_CHANGE_EVENT, syncRedirect);
    return () => {
      window.removeEventListener(SESSION_CHANGE_EVENT, syncRedirect);
    };
  }, [router]);

  return null;
}
