import { z } from "zod";

export const TextDirectionSchema = z.enum(["ltr", "rtl"]);

export const CountryPackSchema = z.object({
  code: z.string().regex(/^[A-Z]{2,4}$/),
  name: z.string().min(2),
  defaultLocale: z.string().min(2),
  supportedLocales: z.array(z.string().min(2)).min(1),
  direction: TextDirectionSchema,
  currencyCode: z.string().length(3),
  timezone: z.string().min(3),
  emergencyHotlines: z.object({
    ambulance: z.string().min(2),
    generalEmergency: z.string().min(2),
  }),
  measurementSystem: z.enum(["metric", "imperial"]),
  licenseNumberPattern: z.string().min(2),
  dataResidencyRegion: z.string().min(2),
  allowRxCourierDelivery: z.boolean().default(true),
  pharmacyLawReference: z.string().optional(),
  dataPrivacyLawReference: z.string().optional(),
});

export type CountryPack = z.infer<typeof CountryPackSchema>;
