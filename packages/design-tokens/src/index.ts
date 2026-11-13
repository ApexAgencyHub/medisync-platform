export const clinicalTrustTokens = {
  brand: {
    name: "MediSync Global",
    tagline: "Multi-Jurisdiction Clinical & Emergency Coordination",
  },
  colors: {
    bgCanvas: "#F8FAFC",
    bgSurface: "#FFFFFF",
    bgSubtle: "#F1F5F9",
    inkPrimary: "#0F172A",
    inkSecondary: "#475569",
    inkMuted: "#64748B",
    brandPrimary: "#0D7377",
    brandPrimaryHover: "#09575A",
    brandSoft: "#CCFBF1",
    borderSubtle: "#E2E8F0",
    statusSuccess: "#059669",
    statusWarning: "#D97706",
    statusEmergency: "#DC2626",
  },
  radii: {
    sm: 6,
    md: 10,
    lg: 14,
    pill: 9999,
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
  },
  typography: {
    sans: "Plus Jakarta Sans",
    mono: "JetBrains Mono",
  },
} as const;

export type ClinicalTrustTokens = typeof clinicalTrustTokens;
