import { StyleSheet, Text, TextInput, Pressable, View } from "react-native";
import {
  ALLOWED_MEDIA_MIME_TYPES,
  AppointmentStatusSchema,
  DispatchUrgencySchema,
  DisputeCategorySchema,
  LabUrgencySchema,
  MAX_CLINICAL_UPLOAD_BYTES,
  UserRoleSchema,
  VisitModeSchema,
  type AuthenticatedUser,
  type CountryPack,
  type DispatchUrgency,
  type DisputeCategory,
  type VisitMode,
} from "@medisync/contracts";
import { validateFacilityLicense } from "@medisync/country-packs";
import { mobileTheme } from "../theme";

export type MobileTabId = "map" | "booking" | "clinical" | "pharmacy" | "admin";

interface SharedTabProps {
  pack: CountryPack;
  user: AuthenticatedUser | null;
}

export function MapDispatchScreen({
  pack,
  urgency,
  onUrgencyChange,
  pickupAddress,
  onPickupAddressChange,
  onSubmitDispatch,
}: SharedTabProps & {
  urgency: DispatchUrgency;
  onUrgencyChange: (next: DispatchUrgency) => void;
  pickupAddress: string;
  onPickupAddressChange: (next: string) => void;
  onSubmitDispatch: () => void;
}) {
  return (
    <View style={styles.card}>
      <Text style={styles.sectionEyebrow}>SLICE 2 · POSTGIS + REDIS GEO</Text>
      <Text style={styles.cardTitle}>Emergency & Transport Dispatch</Text>
      <Text style={styles.bodyText}>
        Emergency dispatch hotline for {pack.name}:{" "}
        <Text style={styles.emergencyText}>
          {pack.emergencyHotlines.ambulance}
        </Text>
      </Text>

      <Text style={styles.fieldLabel}>Urgency Tier</Text>
      <View style={styles.pillRow}>
        {DispatchUrgencySchema.options.map((option) => {
          const active = option === urgency;
          return (
            <Pressable
              key={option}
              onPress={() => onUrgencyChange(option)}
              style={[styles.pill, active && styles.pillActive]}
            >
              <Text style={[styles.pillText, active && styles.pillTextActive]}>
                {option}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.fieldLabel}>Pickup Address / Landmark</Text>
      <TextInput
        value={pickupAddress}
        onChangeText={onPickupAddressChange}
        placeholder="Boulevard Anfa, Emergency Gate B"
        placeholderTextColor={mobileTheme.colors.inkMuted}
        style={styles.input}
      />

      <Pressable onPress={onSubmitDispatch} style={styles.primaryButton}>
        <Text style={styles.primaryButtonText}>Validate & Queue Dispatch</Text>
      </Pressable>
    </View>
  );
}

export function BookingScreen({
  pack,
  visitMode,
  onVisitModeChange,
}: SharedTabProps & {
  visitMode: VisitMode;
  onVisitModeChange: (next: VisitMode) => void;
}) {
  return (
    <View style={styles.card}>
      <Text style={styles.sectionEyebrow}>SLICE 3 · ATOMIC BOOKING LOCKS</Text>
      <Text style={styles.cardTitle}>Multi-Clinic Shifts & Slots</Text>
      <Text style={styles.bodyText}>
        Tariff Currency:{" "}
        <Text style={styles.monoStrong}>{pack.currencyCode}</Text> · Active
        Appointment Lifecycle:{" "}
        {AppointmentStatusSchema.options.slice(0, 3).join(" -> ")}
      </Text>

      <Text style={styles.fieldLabel}>Visit Mode Filter</Text>
      <View style={styles.pillRow}>
        {VisitModeSchema.options.map((mode) => {
          const active = mode === visitMode;
          return (
            <Pressable
              key={mode}
              onPress={() => onVisitModeChange(mode)}
              style={[styles.pill, active && styles.pillActive]}
            >
              <Text style={[styles.pillText, active && styles.pillTextActive]}>
                {mode}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.infoBox}>
        <Text style={styles.infoBoxTitle}>Double-Book & Cross-Clinic Guard</Text>
        <Text style={styles.bodyText}>
          Slot selection uses PostgreSQL exclusion checks plus unique doctor
          slot locking across clinics in {pack.code}.
        </Text>
      </View>
    </View>
  );
}

export function ClinicalScreen({ pack }: SharedTabProps) {
  const maxMb = Math.round(MAX_CLINICAL_UPLOAD_BYTES / (1024 * 1024));
  return (
    <View style={styles.card}>
      <Text style={styles.sectionEyebrow}>
        SLICE 4 · SOAP, HMAC QR & LABS
      </Text>
      <Text style={styles.cardTitle}>Clinical & Pharmacy Operations</Text>
      <Text style={styles.bodyText}>
        Jurisdiction {pack.name} enforces cryptographic QR token verification and
        direct AWS SigV4 uploads capped at{" "}
        <Text style={styles.monoStrong}>{maxMb} MB</Text>.
      </Text>

      <View style={styles.infoBox}>
        <Text style={styles.infoBoxTitle}>Permitted Diagnostic MIME Types</Text>
        <Text style={styles.monoText}>
          {ALLOWED_MEDIA_MIME_TYPES.join(" · ")}
        </Text>
      </View>

      <View style={styles.infoBox}>
        <Text style={styles.infoBoxTitle}>Diagnostic Urgency Channels</Text>
        <Text style={styles.monoText}>
          {LabUrgencySchema.options.join(" | ")}
        </Text>
      </View>
    </View>
  );
}

export function AdminOpsScreen({
  pack,
  licenseProbe,
  onLicenseProbeChange,
  disputeCategory,
  onDisputeCategoryChange,
  disputeSubject,
  onDisputeSubjectChange,
  onSubmitDispute,
}: SharedTabProps & {
  licenseProbe: string;
  onLicenseProbeChange: (next: string) => void;
  disputeCategory: DisputeCategory;
  onDisputeCategoryChange: (next: DisputeCategory) => void;
  disputeSubject: string;
  onDisputeSubjectChange: (next: string) => void;
  onSubmitDispute: () => void;
}) {
  const licenseValid =
    licenseProbe.trim().length > 0 &&
    validateFacilityLicense(pack.code, licenseProbe);

  return (
    <View style={styles.card}>
      <Text style={styles.sectionEyebrow}>SLICE 5 · SOVEREIGN GOVERNANCE</Text>
      <Text style={styles.cardTitle}>Operations & Compliance Desk</Text>
      <Text style={styles.bodyText}>
        RBAC Roles Active: {UserRoleSchema.options.length} · Regex:{" "}
        <Text style={styles.monoText}>{pack.licenseNumberPattern}</Text>
      </Text>

      <Text style={styles.fieldLabel}>Facility License Validation Probe</Text>
      <TextInput
        value={licenseProbe}
        onChangeText={onLicenseProbeChange}
        placeholder="MA-CLIN-90812"
        placeholderTextColor={mobileTheme.colors.inkMuted}
        style={styles.input}
      />
      <Text
        style={[
          styles.validationText,
          licenseValid ? styles.validationOk : styles.validationWarn,
        ]}
      >
        {licenseProbe.trim().length === 0
          ? "Enter a facility license identifier to verify against active CountryPack."
          : licenseValid
            ? `Valid pattern for ${pack.code}`
            : `Does not match pattern for ${pack.code}`}
      </Text>

      <Text style={styles.fieldLabel}>Dispute Escalation Category</Text>
      <View style={styles.pillRow}>
        {DisputeCategorySchema.options.map((cat) => {
          const active = cat === disputeCategory;
          return (
            <Pressable
              key={cat}
              onPress={() => onDisputeCategoryChange(cat)}
              style={[styles.pill, active && styles.pillActive]}
            >
              <Text style={[styles.pillText, active && styles.pillTextActive]}>
                {cat}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.fieldLabel}>Incident / Dispute Subject</Text>
      <TextInput
        value={disputeSubject}
        onChangeText={onDisputeSubjectChange}
        placeholder="Describe SLA, dispatch, or compliance escalation"
        placeholderTextColor={mobileTheme.colors.inkMuted}
        style={styles.input}
      />

      <Pressable onPress={onSubmitDispute} style={styles.primaryButton}>
        <Text style={styles.primaryButtonText}>Submit Governance Dispute</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: mobileTheme.colors.bgSurface,
    borderRadius: mobileTheme.radii.lg,
    borderWidth: 1,
    borderColor: mobileTheme.colors.borderSubtle,
    padding: mobileTheme.spacing.md,
    gap: mobileTheme.spacing.sm,
  },
  sectionEyebrow: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.8,
    color: mobileTheme.colors.brandPrimary,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: mobileTheme.colors.inkPrimary,
  },
  bodyText: {
    fontSize: 13,
    lineHeight: 19,
    color: mobileTheme.colors.inkSecondary,
  },
  emergencyText: {
    fontWeight: "700",
    color: mobileTheme.colors.statusEmergency,
  },
  monoStrong: {
    fontWeight: "700",
    color: mobileTheme.colors.inkPrimary,
  },
  monoText: {
    fontSize: 12,
    color: mobileTheme.colors.inkPrimary,
  },
  fieldLabel: {
    marginTop: mobileTheme.spacing.xs,
    fontSize: 12,
    fontWeight: "600",
    color: mobileTheme.colors.inkPrimary,
  },
  pillRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: mobileTheme.spacing.xs,
  },
  pill: {
    borderWidth: 1,
    borderColor: mobileTheme.colors.borderSubtle,
    backgroundColor: mobileTheme.colors.bgSubtle,
    borderRadius: mobileTheme.radii.sm,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  pillActive: {
    borderColor: mobileTheme.colors.brandPrimary,
    backgroundColor: mobileTheme.colors.brandPrimary,
  },
  pillText: {
    fontSize: 11,
    fontWeight: "600",
    color: mobileTheme.colors.inkSecondary,
  },
  pillTextActive: {
    color: mobileTheme.colors.bgSurface,
  },
  input: {
    borderWidth: 1,
    borderColor: mobileTheme.colors.borderSubtle,
    backgroundColor: mobileTheme.colors.bgCanvas,
    borderRadius: mobileTheme.radii.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: mobileTheme.colors.inkPrimary,
  },
  primaryButton: {
    marginTop: mobileTheme.spacing.xs,
    backgroundColor: mobileTheme.colors.brandPrimary,
    borderRadius: mobileTheme.radii.md,
    paddingVertical: 12,
    alignItems: "center",
  },
  primaryButtonText: {
    fontSize: 14,
    fontWeight: "700",
    color: mobileTheme.colors.bgSurface,
  },
  infoBox: {
    borderRadius: mobileTheme.radii.md,
    borderWidth: 1,
    borderColor: mobileTheme.colors.borderSubtle,
    backgroundColor: mobileTheme.colors.bgSubtle,
    padding: mobileTheme.spacing.sm,
    gap: 4,
  },
  infoBoxTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: mobileTheme.colors.inkPrimary,
  },
  validationText: {
    fontSize: 12,
    fontWeight: "600",
  },
  validationOk: {
    color: mobileTheme.colors.statusSuccess,
  },
  validationWarn: {
    color: mobileTheme.colors.statusWarning,
  },
});
