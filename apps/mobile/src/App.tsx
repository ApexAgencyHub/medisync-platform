import { useRef, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  CreateDispatchRequestSchema,
  CreateDisputeSchema,
  type AuthenticatedUser,
  type DispatchUrgency,
  type DisputeCategory,
  type VisitMode,
} from "@medisync/contracts";
import { resolveCountryPack } from "@medisync/country-packs";
import { mobileTheme } from "./theme";
import {
  AdminOpsScreen,
  BookingScreen,
  ClinicalScreen,
  MapDispatchScreen,
  type MobileTabId,
} from "./screens/SliceTabScreens";
import { PharmacyScreen } from "./screens/PharmacyScreen";
import {
  NativeClinicalPanel,
  NativeMapDriverPanel,
} from "./screens/NativeCapabilitiesPanel";
import { resolveMobileApiBaseUrl } from "./services/native-adapters";

export interface MobileShellProps {
  countryCode?: string;
  apiBaseUrl?: string;
  initialUser?: AuthenticatedUser | null;
  authToken?: string | null;
}

const MOBILE_TABS: ReadonlyArray<{ id: MobileTabId; label: string }> = [
  { id: "map", label: "Map" },
  { id: "booking", label: "Booking" },
  { id: "clinical", label: "Clinical" },
  { id: "pharmacy", label: "Pharmacy" },
  { id: "admin", label: "Admin" },
];

export function MobileAppShell({
  countryCode = "MA",
  apiBaseUrl = resolveMobileApiBaseUrl(),
  initialUser = null,
  authToken = null,
}: MobileShellProps) {
  const [activeTab, setActiveTab] = useState<MobileTabId>("map");

  const [urgency, setUrgency] = useState<DispatchUrgency>("URGENT");
  const [pickupAddress, setPickupAddress] = useState("");
  const [visitMode, setVisitMode] = useState<VisitMode>("IN_PERSON");
  const [licenseProbe, setLicenseProbe] = useState("");
  const [disputeCategory, setDisputeCategory] =
    useState<DisputeCategory>("DISPATCH_DELAY");
  const [disputeSubject, setDisputeSubject] = useState("");
  const [statusBanner, setStatusBanner] = useState<string | null>(null);
  const dispatchSubmitLockRef = useRef(false);

  const activePack = resolveCountryPack(countryCode);

  async function submitValidatedDispatch() {
    if (dispatchSubmitLockRef.current) return;
    dispatchSubmitLockRef.current = true;
    try {
      const parsed = CreateDispatchRequestSchema.safeParse({
        pickupLat: 33.5731,
        pickupLng: -7.5898,
        pickupAddress,
        urgency,
      });
      if (!parsed.success) {
        setStatusBanner("Enter a pickup address (minimum 4 characters).");
        return;
      }

      if (!authToken) {
        setStatusBanner(
          `Dispatch contract validated for ${activePack.code} (${urgency}); configure authToken to transmit to ${apiBaseUrl}.`,
        );
        return;
      }

      try {
        const response = await fetch(`${apiBaseUrl}/v1/dispatch/requests`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify(parsed.data),
        });
        setStatusBanner(
          response.ok
            ? "Emergency dispatch request queued via API."
            : response.status === 409
              ? "An identical active dispatch request is already queued."
              : `Dispatch rejected (${response.status}).`,
        );
      } catch {
        setStatusBanner(`Network unreachable at ${apiBaseUrl}.`);
      }
    } finally {
      dispatchSubmitLockRef.current = false;
    }
  }

  async function submitValidatedDispute() {
    const parsed = CreateDisputeSchema.safeParse({
      category: disputeCategory,
      subject: disputeSubject,
      description: `Submitted from MediSync mobile shell under ${activePack.code}.`,
    });
    if (!parsed.success) {
      setStatusBanner("Dispute subject must be at least 3 characters.");
      return;
    }

    if (!authToken) {
      setStatusBanner(
        `Dispute payload validated (${disputeCategory}); configure authToken to post to ${apiBaseUrl}.`,
      );
      return;
    }

    try {
      const response = await fetch(`${apiBaseUrl}/v1/disputes`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify(parsed.data),
      });
      setStatusBanner(
        response.ok
          ? "Dispute escalated to central admin desk."
          : `Dispute rejected (${response.status}).`,
      );
    } catch {
      setStatusBanner(`Network unreachable at ${apiBaseUrl}.`);
    }
  }

  return (
    <ScrollView
      style={styles.canvas}
      contentContainerStyle={styles.scrollContent}
    >
      <View style={styles.headerCard}>
        <Text style={styles.brandEyebrow}>MEDISYNC MOROCCO · CARE RADAR</Text>
        <Text style={styles.title}>Live Map &amp; Mobile Care</Text>
        <Text style={styles.subtitle}>
          Care Network: {activePack.name} ({activePack.currencyCode}) · Emergency:{" "}
          {activePack.emergencyHotlines.ambulance}
        </Text>
      </View>

      <View style={styles.tabBar}>
        {MOBILE_TABS.map((tab) => {
          const active = tab.id === activeTab;
          return (
            <Pressable
              key={tab.id}
              onPress={() => setActiveTab(tab.id)}
              style={[styles.tabButton, active && styles.tabButtonActive]}
            >
              <Text
                style={[styles.tabLabel, active && styles.tabLabelActive]}
              >
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {statusBanner ? (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>{statusBanner}</Text>
        </View>
      ) : null}

      {activeTab === "map" ? (
        <MapDispatchScreen
          pack={activePack}
          user={initialUser}
          urgency={urgency}
          onUrgencyChange={setUrgency}
          pickupAddress={pickupAddress}
          onPickupAddressChange={setPickupAddress}
          onSubmitDispatch={() => {
            void submitValidatedDispatch();
          }}
        />
      ) : null}

      {activeTab === "booking" ? (
        <BookingScreen
          pack={activePack}
          user={initialUser}
          visitMode={visitMode}
          onVisitModeChange={setVisitMode}
        />
      ) : null}

      {activeTab === "map" ? (
        <NativeMapDriverPanel pack={activePack} user={initialUser} />
      ) : null}

      {activeTab === "pharmacy" ? (
        <PharmacyScreen pack={activePack} user={initialUser} />
      ) : null}

      {activeTab === "clinical" ? (
        <>
          <ClinicalScreen pack={activePack} user={initialUser} />
          <NativeClinicalPanel pack={activePack} user={initialUser} />
        </>
      ) : null}

      {activeTab === "admin" ? (
        <AdminOpsScreen
          pack={activePack}
          user={initialUser}
          licenseProbe={licenseProbe}
          onLicenseProbeChange={setLicenseProbe}
          disputeCategory={disputeCategory}
          onDisputeCategoryChange={setDisputeCategory}
          disputeSubject={disputeSubject}
          onDisputeSubjectChange={setDisputeSubject}
          onSubmitDispute={() => {
            void submitValidatedDispute();
          }}
        />
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  canvas: {
    flex: 1,
    backgroundColor: mobileTheme.colors.bgCanvas,
  },
  scrollContent: {
    padding: mobileTheme.spacing.md,
    gap: mobileTheme.spacing.md,
  },
  headerCard: {
    backgroundColor: mobileTheme.colors.bgSurface,
    borderRadius: mobileTheme.radii.lg,
    borderWidth: 1,
    borderColor: mobileTheme.colors.borderSubtle,
    padding: mobileTheme.spacing.md,
    gap: mobileTheme.spacing.xs,
  },
  brandEyebrow: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.8,
    color: mobileTheme.colors.brandPrimary,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: mobileTheme.colors.inkPrimary,
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 18,
    color: mobileTheme.colors.inkSecondary,
  },
  tabBar: {
    flexDirection: "row",
    gap: mobileTheme.spacing.xs,
    backgroundColor: mobileTheme.colors.bgSurface,
    borderRadius: mobileTheme.radii.md,
    borderWidth: 1,
    borderColor: mobileTheme.colors.borderSubtle,
    padding: mobileTheme.spacing.xs,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: mobileTheme.radii.sm,
  },
  tabButtonActive: {
    backgroundColor: mobileTheme.colors.brandPrimary,
  },
  tabLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: mobileTheme.colors.inkSecondary,
  },
  tabLabelActive: {
    color: mobileTheme.colors.bgSurface,
  },
  banner: {
    borderRadius: mobileTheme.radii.md,
    borderWidth: 1,
    borderColor: mobileTheme.colors.brandPrimary,
    backgroundColor: mobileTheme.colors.brandSoft,
    padding: mobileTheme.spacing.sm,
  },
  bannerText: {
    fontSize: 12,
    fontWeight: "600",
    color: mobileTheme.colors.inkPrimary,
  },
});

export default MobileAppShell;
