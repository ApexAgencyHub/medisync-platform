import { StyleSheet, Text, View } from "react-native";
import { UserRoleSchema } from "@medisync/contracts";
import { resolveCountryPack } from "@medisync/country-packs";
import { mobileTheme } from "./theme";

export interface MobileShellProps {
  countryCode?: string;
}

export function MobileAppShell({ countryCode = "INTL" }: MobileShellProps) {
  const pack = resolveCountryPack(countryCode);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>MediSync Global</Text>
      <Text style={styles.subtitle}>
        Jurisdiction: {pack.name} ({pack.currencyCode}) · Emergency:{" "}
        {pack.emergencyHotlines.ambulance}
      </Text>
      <Text style={styles.meta}>
        Shared Roles: {UserRoleSchema.options.length} · Direction:{" "}
        {pack.direction.toUpperCase()}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: mobileTheme.colors.bgCanvas,
    padding: mobileTheme.spacing.lg,
    justifyContent: "center",
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: mobileTheme.colors.inkPrimary,
    marginBottom: mobileTheme.spacing.sm,
  },
  subtitle: {
    fontSize: 15,
    color: mobileTheme.colors.brandPrimary,
    marginBottom: mobileTheme.spacing.xs,
  },
  meta: {
    fontSize: 13,
    color: mobileTheme.colors.inkSecondary,
  },
});
