import { CountryPackSchema, type CountryPack } from "@medisync/contracts";

const RAW_COUNTRY_PACKS: readonly CountryPack[] = [
  {
    code: "INTL",
    name: "International Sovereign Baseline",
    defaultLocale: "en",
    supportedLocales: ["en", "fr", "ar", "es"],
    direction: "ltr",
    currencyCode: "USD",
    timezone: "UTC",
    emergencyHotlines: { ambulance: "112", generalEmergency: "112" },
    measurementSystem: "metric",
    licenseNumberPattern: "^[A-Z0-9-]{6,24}$",
    dataResidencyRegion: "sovereign-local",
    allowRxCourierDelivery: true,
  },
  {
    code: "MA",
    name: "Morocco",
    defaultLocale: "ar-MA",
    supportedLocales: ["ar-MA", "fr-MA", "en"],
    direction: "rtl",
    currencyCode: "MAD",
    timezone: "Africa/Casablanca",
    emergencyHotlines: { ambulance: "141", generalEmergency: "15" },
    measurementSystem: "metric",
    licenseNumberPattern: "^MA-[A-Z]{2,4}-[0-9]{4,8}$",
    dataResidencyRegion: "ma-casablanca",
    allowRxCourierDelivery: false,
    pharmacyLawReference:
      "Moroccan Law 17-04 (Code du Medicament et de la Pharmacie)",
    dataPrivacyLawReference: "CNDP Law 09-08",
  },
  {
    code: "FR",
    name: "France",
    defaultLocale: "fr-FR",
    supportedLocales: ["fr-FR", "en"],
    direction: "ltr",
    currencyCode: "EUR",
    timezone: "Europe/Paris",
    emergencyHotlines: { ambulance: "15", generalEmergency: "112" },
    measurementSystem: "metric",
    licenseNumberPattern: "^FR-[0-9]{9,11}$",
    dataResidencyRegion: "eu-paris",
    allowRxCourierDelivery: true,
  },
  {
    code: "US",
    name: "United States",
    defaultLocale: "en-US",
    supportedLocales: ["en-US", "es-US"],
    direction: "ltr",
    currencyCode: "USD",
    timezone: "America/New_York",
    emergencyHotlines: { ambulance: "911", generalEmergency: "911" },
    measurementSystem: "imperial",
    licenseNumberPattern: "^US-[A-Z]{2}-[0-9]{5,10}$",
    dataResidencyRegion: "us-east",
    allowRxCourierDelivery: true,
  },
];

const PACK_MAP = new Map<string, CountryPack>(
  RAW_COUNTRY_PACKS.map((pack) => {
    const parsed = CountryPackSchema.parse(pack);
    return [parsed.code, parsed];
  }),
);

export function listCountryPacks(): readonly CountryPack[] {
  return Array.from(PACK_MAP.values());
}

export function resolveCountryPack(code: string): CountryPack {
  const normalized = code.trim().toUpperCase();
  return PACK_MAP.get(normalized) ?? PACK_MAP.get("INTL")!;
}

export function validateFacilityLicense(
  countryCode: string,
  licenseNumber: string,
): boolean {
  const pack = resolveCountryPack(countryCode);
  const pattern = new RegExp(pack.licenseNumberPattern);
  return pattern.test(licenseNumber.trim().toUpperCase());
}
