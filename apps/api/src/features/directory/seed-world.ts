import crypto from "node:crypto";
import type { Pool } from "pg";
import type { Redis } from "ioredis";
import type { FacilityKind, UserRole } from "@medisync/contracts";
import { hashPassword } from "../foundation/index.js";
import { signPrescriptionQr } from "../clinical-pharmacy-labs/index.js";
import { upsertDriverLocation } from "../maps-dispatch/index.js";
import { seedDefaultPharmacyProducts } from "../pharmacy-commerce/index.js";
import {
  bumpCacheGeneration,
  DIRECTORY_CACHE_GEN_KEY,
} from "../../shared/redis/cache.js";
import { SEEDED_DEMO_PASSWORD } from "./pg-store.js";

interface SeedFacilitySpec {
  countryCode: string;
  city: string;
  kind: FacilityKind;
  name: string;
  licenseNumber: string;
  lat: number;
  lng: number;
  address: string;
  phone: string;
  is247: boolean;
  acceptsEmergency: boolean;
  specialties: string[];
}

interface SeedUserSpec {
  email: string;
  fullName: string;
  role: UserRole;
  countryCode: string;
  facilityLicense?: string;
  doctorProfile?: {
    specialty: string;
    licenseNumber: string;
    consultationFeeMinor: number;
    bio: string;
  };
}

const SEED_FACILITIES: readonly SeedFacilitySpec[] = [
  // Morocco (MA - Casablanca Metro)
  {
    countryCode: "MA",
    city: "Casablanca",
    kind: "HOSPITAL",
    name: "CHU Ibn Rochd Emergency Hub",
    licenseNumber: "MA-HOSP-901001",
    lat: 33.5835,
    lng: -7.6212,
    address: "1 Rue des Hôpitaux, Casablanca",
    phone: "+212-522-48-20-20",
    is247: true,
    acceptsEmergency: true,
    specialties: ["Emergency", "Trauma", "Cardiology", "Neurology"],
  },
  {
    countryCode: "MA",
    city: "Casablanca",
    kind: "CLINIC",
    name: "Clinique Anfa Cardiology & Care",
    licenseNumber: "MA-CLIN-901002",
    lat: 33.5912,
    lng: -7.6410,
    address: "240 Boulevard d'Anfa, Casablanca",
    phone: "+212-522-39-14-14",
    is247: false,
    acceptsEmergency: false,
    specialties: ["Cardiology", "Internal Medicine", "Pediatrics"],
  },
  {
    countryCode: "MA",
    city: "Casablanca",
    kind: "PHARMACY",
    name: "Pharmacie Maarif 24/7",
    licenseNumber: "MA-PHRM-901003",
    lat: 33.5818,
    lng: -7.6348,
    address: "45 Boulevard Bir Anzarane, Maarif, Casablanca",
    phone: "+212-522-98-11-22",
    is247: true,
    acceptsEmergency: true,
    specialties: ["24/7 Night Guard", "Prescription Dispensing", "Cold Chain"],
  },
  {
    countryCode: "MA",
    city: "Casablanca",
    kind: "DIAGNOSTIC_LAB",
    name: "Labo BioCasablanca Imagerie",
    licenseNumber: "MA-LAB-901004",
    lat: 33.5750,
    lng: -7.6120,
    address: "18 Boulevard Abdelmoumen, Casablanca",
    phone: "+212-522-27-55-40",
    is247: false,
    acceptsEmergency: true,
    specialties: ["Hematology", "MRI & CT", "Microbiology"],
  },

  // Morocco (MA - Rabat Agdal & Hassan)
  {
    countryCode: "MA",
    city: "Rabat",
    kind: "HOSPITAL",
    name: "CHU Ibn Sina Rabat",
    licenseNumber: "MA-HOSP-902001",
    lat: 33.9978,
    lng: -6.8505,
    address: "Avenue Bettoumi, Souissi, Rabat",
    phone: "+212-537-67-64-64",
    is247: true,
    acceptsEmergency: true,
    specialties: ["Emergency", "Cardiology", "Surgery", "Pediatrics"],
  },
  {
    countryCode: "MA",
    city: "Rabat",
    kind: "CLINIC",
    name: "Clinique Agdal Spécialités",
    licenseNumber: "MA-CLIN-902002",
    lat: 34.0005,
    lng: -6.8462,
    address: "42 Avenue Fal Ould Oumeir, Agdal, Rabat",
    phone: "+212-537-77-18-20",
    is247: false,
    acceptsEmergency: false,
    specialties: ["Internal Medicine", "Dermatology", "Pediatrics"],
  },
  {
    countryCode: "MA",
    city: "Rabat",
    kind: "PHARMACY",
    name: "Pharmacie Hassan 24/7",
    licenseNumber: "MA-PHRM-902003",
    lat: 34.0209,
    lng: -6.8352,
    address: "14 Avenue Mohammed V, Hassan, Rabat",
    phone: "+212-537-70-44-10",
    is247: true,
    acceptsEmergency: true,
    specialties: ["24/7 Night Guard", "Prescription Dispensing", "Cold Chain"],
  },
  {
    countryCode: "MA",
    city: "Rabat",
    kind: "DIAGNOSTIC_LAB",
    name: "Labo BioRabat Diagnostics",
    licenseNumber: "MA-LAB-902004",
    lat: 34.0068,
    lng: -6.8495,
    address: "88 Avenue de France, Agdal, Rabat",
    phone: "+212-537-68-33-90",
    is247: false,
    acceptsEmergency: true,
    specialties: ["Clinical Pathology", "MRI & CT", "Immunology"],
  },

  // Morocco (MA - Marrakech Guéliz & Médina)
  {
    countryCode: "MA",
    city: "Marrakech",
    kind: "HOSPITAL",
    name: "CHU Mohammed VI Marrakech",
    licenseNumber: "MA-HOSP-903001",
    lat: 31.6442,
    lng: -8.0054,
    address: "Avenue Ibn Sina, Amerchich, Marrakech",
    phone: "+212-524-30-07-00",
    is247: true,
    acceptsEmergency: true,
    specialties: ["Emergency", "Trauma", "Cardiology", "Obstetrics"],
  },
  {
    countryCode: "MA",
    city: "Marrakech",
    kind: "CLINIC",
    name: "Clinique Internationale de Guéliz",
    licenseNumber: "MA-CLIN-903002",
    lat: 31.6335,
    lng: -8.0124,
    address: "74 Boulevard Zerktouni, Guéliz, Marrakech",
    phone: "+212-524-43-12-90",
    is247: false,
    acceptsEmergency: false,
    specialties: ["General Practice", "Cardiology", "Orthopedics"],
  },
  {
    countryCode: "MA",
    city: "Marrakech",
    kind: "PHARMACY",
    name: "Pharmacie Guéliz Garde 24/7",
    licenseNumber: "MA-PHRM-903003",
    lat: 31.6318,
    lng: -8.0091,
    address: "21 Avenue Mohammed V, Guéliz, Marrakech",
    phone: "+212-524-44-22-18",
    is247: true,
    acceptsEmergency: true,
    specialties: ["24/7 Night Guard", "Prescription Dispensing", "Cold Chain"],
  },
  {
    countryCode: "MA",
    city: "Marrakech",
    kind: "DIAGNOSTIC_LAB",
    name: "Labo BioAtlas Marrakech",
    licenseNumber: "MA-LAB-903004",
    lat: 31.6272,
    lng: -8.0038,
    address: "15 Rue de la Liberté, Guéliz, Marrakech",
    phone: "+212-524-42-81-55",
    is247: false,
    acceptsEmergency: false,
    specialties: ["Hematology", "Biochemistry", "Ultrasound"],
  },

  // Morocco (MA - Tangier Bay & Centre)
  {
    countryCode: "MA",
    city: "Tangier",
    kind: "HOSPITAL",
    name: "CHU Mohammed VI Tanger",
    licenseNumber: "MA-HOSP-904001",
    lat: 35.7595,
    lng: -5.8210,
    address: "Route de Rabat, Tanger",
    phone: "+212-539-39-40-50",
    is247: true,
    acceptsEmergency: true,
    specialties: ["Emergency", "Trauma", "Cardiology", "ICU"],
  },
  {
    countryCode: "MA",
    city: "Tangier",
    kind: "CLINIC",
    name: "Clinique Détroit Santé",
    licenseNumber: "MA-CLIN-904002",
    lat: 35.7742,
    lng: -5.8095,
    address: "32 Boulevard Pasteur, Tanger",
    phone: "+212-539-94-11-30",
    is247: false,
    acceptsEmergency: false,
    specialties: ["Internal Medicine", "Pediatrics", "Ophthalmology"],
  },
  {
    countryCode: "MA",
    city: "Tangier",
    kind: "PHARMACY",
    name: "Pharmacie Pasteur 24/7",
    licenseNumber: "MA-PHRM-904003",
    lat: 35.7785,
    lng: -5.8128,
    address: "10 Boulevard Mohammed V, Tanger",
    phone: "+212-539-93-22-45",
    is247: true,
    acceptsEmergency: true,
    specialties: ["24/7 Night Guard", "Prescription Dispensing", "Cold Chain"],
  },
  {
    countryCode: "MA",
    city: "Tangier",
    kind: "DIAGNOSTIC_LAB",
    name: "Labo Nord Biologie Tanger",
    licenseNumber: "MA-LAB-904004",
    lat: 35.7675,
    lng: -5.8020,
    address: "55 Avenue Moulay Youssef, Tanger",
    phone: "+212-539-32-19-80",
    is247: false,
    acceptsEmergency: false,
    specialties: ["Microbiology", "Biochemistry", "Radiology"],
  },

  // Morocco (MA - Fès Ville Nouvelle)
  {
    countryCode: "MA",
    city: "Fès",
    kind: "HOSPITAL",
    name: "CHU Hassan II Fès",
    licenseNumber: "MA-HOSP-905001",
    lat: 34.0098,
    lng: -4.9965,
    address: "Route Sidi Harazem, Fès",
    phone: "+212-535-61-90-53",
    is247: true,
    acceptsEmergency: true,
    specialties: ["Emergency", "Neurology", "Cardiology", "Surgery"],
  },
  {
    countryCode: "MA",
    city: "Fès",
    kind: "CLINIC",
    name: "Clinique Atlas Fès",
    licenseNumber: "MA-CLIN-905002",
    lat: 34.0365,
    lng: -5.0025,
    address: "19 Avenue Hassan II, Ville Nouvelle, Fès",
    phone: "+212-535-62-44-12",
    is247: false,
    acceptsEmergency: false,
    specialties: ["General Practice", "Endocrinology", "Pediatrics"],
  },
  {
    countryCode: "MA",
    city: "Fès",
    kind: "PHARMACY",
    name: "Pharmacie Ville Nouvelle 24/7",
    licenseNumber: "MA-PHRM-905003",
    lat: 34.0398,
    lng: -5.0008,
    address: "64 Boulevard Mohammed V, Fès",
    phone: "+212-535-65-17-90",
    is247: true,
    acceptsEmergency: true,
    specialties: ["24/7 Night Guard", "Prescription Dispensing", "Cold Chain"],
  },
  {
    countryCode: "MA",
    city: "Fès",
    kind: "DIAGNOSTIC_LAB",
    name: "Labo Saïss Analyses Fès",
    licenseNumber: "MA-LAB-905004",
    lat: 34.0322,
    lng: -5.0082,
    address: "8 Rue d'Espagne, Ville Nouvelle, Fès",
    phone: "+212-535-94-08-60",
    is247: false,
    acceptsEmergency: false,
    specialties: ["Hematology", "Hormonology", "MRI & CT"],
  },

  // Morocco (MA - Agadir Centre & Bay)
  {
    countryCode: "MA",
    city: "Agadir",
    kind: "HOSPITAL",
    name: "CHR Hassan II Agadir",
    licenseNumber: "MA-HOSP-906001",
    lat: 30.4225,
    lng: -9.5912,
    address: "Avenue Hassan II, Agadir",
    phone: "+212-528-84-14-77",
    is247: true,
    acceptsEmergency: true,
    specialties: ["Emergency", "Trauma", "Internal Medicine", "Pediatrics"],
  },
  {
    countryCode: "MA",
    city: "Agadir",
    kind: "CLINIC",
    name: "Clinique Souss Spécialités",
    licenseNumber: "MA-CLIN-906002",
    lat: 30.4158,
    lng: -9.5992,
    address: "28 Boulevard Mohammed V, Agadir",
    phone: "+212-528-82-30-40",
    is247: false,
    acceptsEmergency: false,
    specialties: ["Cardiology", "Dermatology", "General Practice"],
  },
  {
    countryCode: "MA",
    city: "Agadir",
    kind: "PHARMACY",
    name: "Pharmacie Baie d'Agadir 24/7",
    licenseNumber: "MA-PHRM-906003",
    lat: 30.4192,
    lng: -9.6025,
    address: "11 Avenue du Prince Moulay Abdallah, Agadir",
    phone: "+212-528-84-55-12",
    is247: true,
    acceptsEmergency: true,
    specialties: ["24/7 Night Guard", "Prescription Dispensing", "Cold Chain"],
  },
  {
    countryCode: "MA",
    city: "Agadir",
    kind: "DIAGNOSTIC_LAB",
    name: "Labo BioSouss Agadir",
    licenseNumber: "MA-LAB-906004",
    lat: 30.4112,
    lng: -9.5880,
    address: "40 Avenue des FAR, Agadir",
    phone: "+212-528-82-91-20",
    is247: false,
    acceptsEmergency: false,
    specialties: ["Clinical Pathology", "Biochemistry", "Ultrasound"],
  },

  // International (INTL - Geneva Medical District)
  {
    countryCode: "INTL",
    city: "Geneva",
    kind: "HOSPITAL",
    name: "Geneva University Emergency Center",
    licenseNumber: "INTL-HOSP-101001",
    lat: 46.1932,
    lng: 6.1489,
    address: "Rue Gabrielle-Perret-Gentil 4, Geneva",
    phone: "+41-22-372-3311",
    is247: true,
    acceptsEmergency: true,
    specialties: ["Emergency", "ICU", "Surgery"],
  },
  {
    countryCode: "INTL",
    city: "Geneva",
    kind: "CLINIC",
    name: "Geneva Sovereign Polyclinic",
    licenseNumber: "INTL-CLIN-101002",
    lat: 46.1905,
    lng: 6.1560,
    address: "Avenue de Champel 20, Geneva",
    phone: "+41-22-839-5500",
    is247: false,
    acceptsEmergency: false,
    specialties: ["Internal Medicine", "Telehealth", "Preventive Care"],
  },
  {
    countryCode: "INTL",
    city: "Geneva",
    kind: "PHARMACY",
    name: "Pharmacie du Léman 24/7",
    licenseNumber: "INTL-PHRM-101003",
    lat: 46.2082,
    lng: 6.1445,
    address: "Rue du Mont-Blanc 12, Geneva",
    phone: "+41-22-732-1190",
    is247: true,
    acceptsEmergency: false,
    specialties: ["24/7 Pharmacy", "Compounding", "Home Courier"],
  },
  {
    countryCode: "INTL",
    city: "Geneva",
    kind: "DIAGNOSTIC_LAB",
    name: "BioGen Diagnostics Lab",
    licenseNumber: "INTL-LABS-101004",
    lat: 46.2015,
    lng: 6.1350,
    address: "Boulevard Helvétique 32, Geneva",
    phone: "+41-22-818-4400",
    is247: false,
    acceptsEmergency: false,
    specialties: ["PCR", "Imaging", "Clinical Pathology"],
  },

  // France (FR - Paris AP-HP Core)
  {
    countryCode: "FR",
    city: "Paris",
    kind: "HOSPITAL",
    name: "Hôpital Cochin AP-HP",
    licenseNumber: "FR-750100001",
    lat: 48.8377,
    lng: 2.3401,
    address: "27 Rue du Faubourg Saint-Jacques, Paris",
    phone: "+33-1-58-41-41-41",
    is247: true,
    acceptsEmergency: true,
    specialties: ["Urgences", "Cardiologie", "Radiologie"],
  },
  {
    countryCode: "FR",
    city: "Paris",
    kind: "CLINIC",
    name: "Centre Médical Saint-Germain",
    licenseNumber: "FR-750100002",
    lat: 48.8540,
    lng: 2.3328,
    address: "112 Boulevard Saint-Germain, Paris",
    phone: "+33-1-42-22-88-10",
    is247: false,
    acceptsEmergency: false,
    specialties: ["Médecine Générale", "Dermatologie"],
  },
  {
    countryCode: "FR",
    city: "Paris",
    kind: "PHARMACY",
    name: "Pharmacie Monge Garde 24/7",
    licenseNumber: "FR-750100003",
    lat: 48.8422,
    lng: 2.3522,
    address: "78 Rue Monge, Paris",
    phone: "+33-1-43-31-39-44",
    is247: true,
    acceptsEmergency: true,
    specialties: ["Garde Nuit", "Ordonnances QR"],
  },
  {
    countryCode: "FR",
    city: "Paris",
    kind: "DIAGNOSTIC_LAB",
    name: "Laboratoire BioParis",
    licenseNumber: "FR-750100004",
    lat: 48.8620,
    lng: 2.3590,
    address: "15 Rue de Turbigo, Paris",
    phone: "+33-1-40-26-71-00",
    is247: false,
    acceptsEmergency: false,
    specialties: ["Biologie Médicale", "Sérologie"],
  },

  // United States (US - Manhattan Clinical Corridor)
  {
    countryCode: "US",
    city: "New York",
    kind: "HOSPITAL",
    name: "Manhattan Heart & Trauma Center",
    licenseNumber: "US-NY-880101",
    lat: 40.7644,
    lng: -73.9547,
    address: "525 East 68th Street, New York, NY",
    phone: "+1-212-746-5454",
    is247: true,
    acceptsEmergency: true,
    specialties: ["Emergency Trauma", "Cardiology", "Oncology"],
  },
  {
    countryCode: "US",
    city: "New York",
    kind: "CLINIC",
    name: "SoHo Family Medical Clinic",
    licenseNumber: "US-NY-880102",
    lat: 40.7233,
    lng: -74.0005,
    address: "420 Broome Street, New York, NY",
    phone: "+1-212-555-0182",
    is247: false,
    acceptsEmergency: false,
    specialties: ["Family Medicine", "Pediatrics", "Telehealth"],
  },
  {
    countryCode: "US",
    city: "New York",
    kind: "PHARMACY",
    name: "Hudson 24h Pharmacy",
    licenseNumber: "US-NY-880103",
    lat: 40.7350,
    lng: -74.0020,
    address: "305 Hudson Street, New York, NY",
    phone: "+1-212-555-0144",
    is247: true,
    acceptsEmergency: false,
    specialties: ["24h Fulfillment", "Specialty Rx"],
  },
  {
    countryCode: "US",
    city: "New York",
    kind: "DIAGNOSTIC_LAB",
    name: "Empire Diagnostic Labs",
    licenseNumber: "US-NY-880104",
    lat: 40.7527,
    lng: -73.9772,
    address: "89 East 42nd Street, New York, NY",
    phone: "+1-212-555-0199",
    is247: false,
    acceptsEmergency: false,
    specialties: ["Imaging", "Comprehensive Panels"],
  },
];

const SEED_USERS: readonly SeedUserSpec[] = [
  {
    email: "ops.admin@medisync.global",
    fullName: "Ministry Oversight Admin",
    role: "OPS_ADMIN",
    countryCode: "INTL",
  },
  // MA Personas
  {
    email: "patient.ma@medisync.global",
    fullName: "Youssef El Amrani",
    role: "PATIENT",
    countryCode: "MA",
  },
  {
    email: "doctor.ma@medisync.global",
    fullName: "Dr. Salma Benali",
    role: "DOCTOR",
    countryCode: "MA",
    facilityLicense: "MA-CLIN-901002",
    doctorProfile: {
      specialty: "Cardiology",
      licenseNumber: "MA-MD-77412",
      consultationFeeMinor: 35000,
      bio: "Interventional cardiologist in Casablanca providing clinic and video consultations.",
    },
  },
  {
    email: "nurse.ma@medisync.global",
    fullName: "Rachid Amrani",
    role: "NURSE",
    countryCode: "MA",
    facilityLicense: "MA-HOSP-901001",
    doctorProfile: {
      specialty: "Home Nursing & Infirmiers",
      licenseNumber: "MA-INF-55201",
      consultationFeeMinor: 18000,
      bio: "Registered state infirmier specializing in post-op dressings, IV care, and home vitals in Casablanca.",
    },
  },
  {
    email: "hospital.ma@medisync.global",
    fullName: "Amina Alami",
    role: "HOSPITAL_ADMIN",
    countryCode: "MA",
    facilityLicense: "MA-HOSP-901001",
  },
  {
    email: "pharmacist.ma@medisync.global",
    fullName: "Dr. Nadia Tazi",
    role: "PHARMACIST",
    countryCode: "MA",
    facilityLicense: "MA-PHRM-901003",
  },
  {
    email: "lab.ma@medisync.global",
    fullName: "Karim Bennani",
    role: "LAB_TECH",
    countryCode: "MA",
    facilityLicense: "MA-LAB-901004",
  },
  {
    email: "driver.ma@medisync.global",
    fullName: "Hassan Chraibi",
    role: "DRIVER",
    countryCode: "MA",
    facilityLicense: "MA-HOSP-901001",
  },
  {
    email: "courier.ma@medisync.global",
    fullName: "Karim Tazi",
    role: "DRIVER",
    countryCode: "MA",
    facilityLicense: "MA-CLIN-901002",
  },
  // MA Regional Staff — Rabat
  {
    email: "doctor.rabat.ma@medisync.global",
    fullName: "Dr. Mehdi El Fassi",
    role: "DOCTOR",
    countryCode: "MA",
    facilityLicense: "MA-CLIN-902002",
    doctorProfile: {
      specialty: "Internal Medicine",
      licenseNumber: "MA-MD-78201",
      consultationFeeMinor: 30000,
      bio: "Internal medicine specialist in Rabat Agdal offering in-clinic and encrypted video follow-ups.",
    },
  },
  {
    email: "nurse.rabat.ma@medisync.global",
    fullName: "Khadija Benjelloun",
    role: "NURSE",
    countryCode: "MA",
    facilityLicense: "MA-HOSP-902001",
    doctorProfile: {
      specialty: "Home Nursing & Infirmiers",
      licenseNumber: "MA-INF-56201",
      consultationFeeMinor: 17000,
      bio: "State-registered infirmier providing home wound care, injections, and post-surgical monitoring across Rabat.",
    },
  },
  {
    email: "driver.rabat.ma@medisync.global",
    fullName: "Omar Berrada",
    role: "DRIVER",
    countryCode: "MA",
    facilityLicense: "MA-HOSP-902001",
  },
  // MA Regional Staff — Marrakech
  {
    email: "doctor.marrakech.ma@medisync.global",
    fullName: "Dr. Imane Chafik",
    role: "DOCTOR",
    countryCode: "MA",
    facilityLicense: "MA-CLIN-903002",
    doctorProfile: {
      specialty: "Pediatrics",
      licenseNumber: "MA-MD-78301",
      consultationFeeMinor: 30000,
      bio: "Pediatrician in Guéliz, Marrakech delivering newborn care, vaccinations, and family teleconsultations.",
    },
  },
  {
    email: "nurse.marrakech.ma@medisync.global",
    fullName: "Tarik Mansouri",
    role: "NURSE",
    countryCode: "MA",
    facilityLicense: "MA-HOSP-903001",
    doctorProfile: {
      specialty: "Home Nursing & Infirmiers",
      licenseNumber: "MA-INF-56301",
      consultationFeeMinor: 16000,
      bio: "Licensed home-care nurse serving Marrakech Guéliz and Médina for IV infusions and vitals checks.",
    },
  },
  {
    email: "driver.marrakech.ma@medisync.global",
    fullName: "Yassine El Idrissi",
    role: "DRIVER",
    countryCode: "MA",
    facilityLicense: "MA-HOSP-903001",
  },
  // MA Regional Staff — Tangier
  {
    email: "doctor.tangier.ma@medisync.global",
    fullName: "Dr. Anas Bakkali",
    role: "DOCTOR",
    countryCode: "MA",
    facilityLicense: "MA-CLIN-904002",
    doctorProfile: {
      specialty: "Ophthalmology",
      licenseNumber: "MA-MD-78401",
      consultationFeeMinor: 35000,
      bio: "Ophthalmologist at Clinique Détroit Santé in Tangier providing eye exams and post-op video reviews.",
    },
  },
  {
    email: "nurse.tangier.ma@medisync.global",
    fullName: "Sanaa El Khattabi",
    role: "NURSE",
    countryCode: "MA",
    facilityLicense: "MA-HOSP-904001",
    doctorProfile: {
      specialty: "Home Nursing & Infirmiers",
      licenseNumber: "MA-INF-56401",
      consultationFeeMinor: 17000,
      bio: "Registered state infirmier covering Tangier Bay and city center for diabetic care and home dressings.",
    },
  },
  {
    email: "driver.tangier.ma@medisync.global",
    fullName: "Nabil Ziani",
    role: "DRIVER",
    countryCode: "MA",
    facilityLicense: "MA-HOSP-904001",
  },
  // MA Regional Staff — Fès
  {
    email: "doctor.fes.ma@medisync.global",
    fullName: "Dr. Zineb Lahlou",
    role: "DOCTOR",
    countryCode: "MA",
    facilityLicense: "MA-CLIN-905002",
    doctorProfile: {
      specialty: "General Medicine",
      licenseNumber: "MA-MD-78501",
      consultationFeeMinor: 25000,
      bio: "Family and general medicine physician in Fès Ville Nouvelle providing clinic visits and telehealth.",
    },
  },
  {
    email: "nurse.fes.ma@medisync.global",
    fullName: "Hamza Squalli",
    role: "NURSE",
    countryCode: "MA",
    facilityLicense: "MA-HOSP-905001",
    doctorProfile: {
      specialty: "Home Nursing & Infirmiers",
      licenseNumber: "MA-INF-56501",
      consultationFeeMinor: 15000,
      bio: "State infirmier based at CHU Hassan II Fès providing home geriatric follow-ups and injections.",
    },
  },
  {
    email: "driver.fes.ma@medisync.global",
    fullName: "Driss Benkirane",
    role: "DRIVER",
    countryCode: "MA",
    facilityLicense: "MA-HOSP-905001",
  },
  // MA Regional Staff — Agadir
  {
    email: "doctor.agadir.ma@medisync.global",
    fullName: "Dr. Meryem Ouhssaine",
    role: "DOCTOR",
    countryCode: "MA",
    facilityLicense: "MA-CLIN-906002",
    doctorProfile: {
      specialty: "Dermatology",
      licenseNumber: "MA-MD-78601",
      consultationFeeMinor: 30000,
      bio: "Dermatologist at Clinique Souss Spécialités in Agadir offering clinic care and teledermatology.",
    },
  },
  {
    email: "nurse.agadir.ma@medisync.global",
    fullName: "Badr Aït Ali",
    role: "NURSE",
    countryCode: "MA",
    facilityLicense: "MA-HOSP-906001",
    doctorProfile: {
      specialty: "Home Nursing & Infirmiers",
      licenseNumber: "MA-INF-56601",
      consultationFeeMinor: 16000,
      bio: "Registered home-care nurse serving Agadir Centre and Souss for post-op care and vital checks.",
    },
  },
  {
    email: "driver.agadir.ma@medisync.global",
    fullName: "Said Bouzidi",
    role: "DRIVER",
    countryCode: "MA",
    facilityLicense: "MA-HOSP-906001",
  },
  // INTL Personas
  {
    email: "patient.intl@medisync.global",
    fullName: "Claire Moreau",
    role: "PATIENT",
    countryCode: "INTL",
  },
  {
    email: "doctor.intl@medisync.global",
    fullName: "Dr. Lukas Weber",
    role: "DOCTOR",
    countryCode: "INTL",
    facilityLicense: "INTL-CLIN-101002",
    doctorProfile: {
      specialty: "Internal Medicine",
      licenseNumber: "CH-MD-30112",
      consultationFeeMinor: 18000,
      bio: "Senior internist coordinating Swiss & cross-border acute follow-ups.",
    },
  },
  {
    email: "nurse.intl@medisync.global",
    fullName: "Céline Girard",
    role: "NURSE",
    countryCode: "INTL",
    facilityLicense: "INTL-HOSP-101001",
    doctorProfile: {
      specialty: "Home Nursing & Infirmiers",
      licenseNumber: "CH-INF-88410",
      consultationFeeMinor: 12000,
      bio: "Community care infirmier providing wound care, injections, and geriatric follow-up across Geneva.",
    },
  },
  {
    email: "pharmacist.intl@medisync.global",
    fullName: "Sophie Laurent",
    role: "PHARMACIST",
    countryCode: "INTL",
    facilityLicense: "INTL-PHRM-101003",
  },
  {
    email: "lab.intl@medisync.global",
    fullName: "Marc Dubois",
    role: "LAB_TECH",
    countryCode: "INTL",
    facilityLicense: "INTL-LABS-101004",
  },
  {
    email: "driver.intl@medisync.global",
    fullName: "Thomas Keller",
    role: "DRIVER",
    countryCode: "INTL",
    facilityLicense: "INTL-HOSP-101001",
  },
  // FR & US Doctors for CountryPack completeness
  {
    email: "doctor.fr@medisync.global",
    fullName: "Dr. Camille Lefèvre",
    role: "DOCTOR",
    countryCode: "FR",
    facilityLicense: "FR-750100002",
    doctorProfile: {
      specialty: "Médecine Générale",
      licenseNumber: "FR-1010928371",
      consultationFeeMinor: 3000,
      bio: "Médecin généraliste conventionné secteur 1 à Saint-Germain.",
    },
  },
  {
    email: "doctor.us@medisync.global",
    fullName: "Dr. Maya Patel",
    role: "DOCTOR",
    countryCode: "US",
    facilityLicense: "US-NY-880102",
    doctorProfile: {
      specialty: "Family Medicine",
      licenseNumber: "US-NY-449012",
      consultationFeeMinor: 15000,
      bio: "Board-certified family physician offering same-day SoHo & telehealth visits.",
    },
  },
];

export interface SeedWorldResult {
  facilitiesSeeded: number;
  usersSeeded: number;
  schedulesSeeded: number;
  driversPinged: number;
  prescriptionsSeeded: number;
}

export async function seedRealisticWorld(
  pool: Pool,
  redis: Redis,
  authSecret: string,
): Promise<SeedWorldResult> {
  const passwordHash = await hashPassword(SEEDED_DEMO_PASSWORD);
  const userIdsByEmail = new Map<string, string>();
  const facilityIdsByLicense = new Map<string, string>();

  // 1. Seed bootstrap owner / Ops Admin first
  const opsSpec = SEED_USERS[0]!;
  const opsRes = await pool.query<{ id: string }>(
    `INSERT INTO users (
       email, password_hash, full_name, role, country_code, account_status, credential_verified
     )
     VALUES ($1, $2, $3, $4, $5, 'ACTIVE', TRUE)
     ON CONFLICT (email) DO UPDATE SET
       full_name = EXCLUDED.full_name,
       credential_verified = TRUE
     RETURNING id`,
    [
      opsSpec.email,
      passwordHash,
      opsSpec.fullName,
      opsSpec.role,
      opsSpec.countryCode,
    ],
  );
  const opsId = opsRes.rows[0]!.id;
  userIdsByEmail.set(opsSpec.email, opsId);

  // 2. Seed all VERIFIED facilities across Morocco (6 metro hubs) + INTL, FR, US
  for (const fac of SEED_FACILITIES) {
    const res = await pool.query<{ id: string }>(
      `INSERT INTO facilities (
         country_code,
         city,
         kind,
         name,
         license_number,
         verification_status,
         location,
         lat,
         lng,
         address,
         owner_user_id,
         phone,
         is_24_7,
         accepts_emergency,
         specialties,
         open_status
       )
       VALUES (
         $1, $2, $3, $4, $5, 'VERIFIED',
         ST_SetSRID(ST_MakePoint($7, $6), 4326)::geography,
         $6, $7, $8, $9, $10, $11, $12, $13::text[], 'OPEN'
       )
       ON CONFLICT (country_code, license_number) DO UPDATE SET
         verification_status = 'VERIFIED',
         open_status = 'OPEN',
         city = EXCLUDED.city,
         name = EXCLUDED.name,
         phone = EXCLUDED.phone,
         specialties = EXCLUDED.specialties
       RETURNING id`,
      [
        fac.countryCode,
        fac.city,
        fac.kind,
        fac.name,
        fac.licenseNumber,
        fac.lat,
        fac.lng,
        fac.address,
        opsId,
        fac.phone,
        fac.is247,
        fac.acceptsEmergency,
        fac.specialties,
      ],
    );
    facilityIdsByLicense.set(fac.licenseNumber, res.rows[0]!.id);
  }

  // 3. Seed Users & Doctor Profiles
  let schedulesSeeded = 0;
  for (const spec of SEED_USERS.slice(1)) {
    const facilityId = spec.facilityLicense
      ? (facilityIdsByLicense.get(spec.facilityLicense) ?? null)
      : null;

    const isProviderOrStaff =
      spec.role !== "PATIENT" && spec.role !== "CAREGIVER";

    const uRes = await pool.query<{ id: string }>(
      `INSERT INTO users (
         email, password_hash, full_name, role, country_code, facility_id,
         account_status, credential_verified
       )
       VALUES ($1, $2, $3, $4, $5, $6, 'ACTIVE', $7)
       ON CONFLICT (email) DO UPDATE SET
         full_name = EXCLUDED.full_name,
         role = EXCLUDED.role,
         facility_id = COALESCE(users.facility_id, EXCLUDED.facility_id),
         credential_verified = EXCLUDED.credential_verified
       RETURNING id`,
      [
        spec.email,
        passwordHash,
        spec.fullName,
        spec.role,
        spec.countryCode,
        facilityId,
        isProviderOrStaff,
      ],
    );
    const userId = uRes.rows[0]!.id;
    userIdsByEmail.set(spec.email, userId);

    if (spec.doctorProfile) {
      const isHomeNursing = /nursing|infirmier|nurse/i.test(
        spec.doctorProfile.specialty,
      );
      await pool.query(
        `INSERT INTO doctor_profiles (
           doctor_user_id, country_code, specialty, license_number,
           consultation_fee_minor, bio, telehealth_enabled, home_visit_enabled
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (doctor_user_id) DO UPDATE SET
           specialty = EXCLUDED.specialty,
           consultation_fee_minor = EXCLUDED.consultation_fee_minor,
           telehealth_enabled = EXCLUDED.telehealth_enabled,
           home_visit_enabled = EXCLUDED.home_visit_enabled`,
        [
          userId,
          spec.countryCode,
          spec.doctorProfile.specialty,
          spec.doctorProfile.licenseNumber,
          spec.doctorProfile.consultationFeeMinor,
          spec.doctorProfile.bio,
          !isHomeNursing,
          isHomeNursing,
        ],
      );

      if (facilityId) {
        // Ensure recurring weekday slots exist: home nurses run HOME_VISIT; doctors alternate clinic & telehealth
        for (const dayOfWeek of [1, 2, 3, 4, 5]) {
          const scheduleVisitMode = isHomeNursing
            ? "HOME_VISIT"
            : dayOfWeek % 2 === 0
              ? "TELEHEALTH"
              : "IN_PERSON";
          const existingSched = await pool.query<{ id: string; visitMode: string }>(
            `SELECT id, visit_mode AS "visitMode" FROM doctor_schedules
             WHERE doctor_user_id = $1 AND facility_id = $2 AND day_of_week = $3 AND start_time_utc = '09:00'
             LIMIT 1`,
            [userId, facilityId, dayOfWeek],
          );
          if (existingSched.rowCount === 0) {
            await pool.query(
              `INSERT INTO doctor_schedules (
                 country_code, doctor_user_id, facility_id, day_of_week,
                 start_time_utc, end_time_utc, slot_duration_minutes, visit_mode, is_active
               )
               VALUES ($1, $2, $3, $4, '09:00', '12:00', 30, $5, TRUE)`,
              [
                spec.countryCode,
                userId,
                facilityId,
                dayOfWeek,
                scheduleVisitMode,
              ],
            );
            schedulesSeeded += 1;
          } else if (
            isHomeNursing &&
            existingSched.rows[0]?.visitMode !== "HOME_VISIT"
          ) {
            await pool.query(
              `UPDATE doctor_schedules SET visit_mode = 'HOME_VISIT' WHERE id = $1`,
              [existingSched.rows[0]!.id],
            );
          }
        }
      }
    }
  }

  // 4. Seed Live Redis Geo ambulance pings for MA & INTL
  let driversPinged = 0;
  const driverLocations = [
    {
      email: "driver.ma@medisync.global",
      countryCode: "MA",
      lat: 33.5865,
      lng: -7.6285,
      status: "AVAILABLE" as const,
      headingDeg: 115,
    },
    {
      email: "courier.ma@medisync.global",
      countryCode: "MA",
      lat: 33.5918,
      lng: -7.6402,
      status: "AVAILABLE" as const,
      headingDeg: 240,
    },
    {
      email: "driver.rabat.ma@medisync.global",
      countryCode: "MA",
      lat: 34.0012,
      lng: -6.8475,
      status: "AVAILABLE" as const,
      headingDeg: 90,
    },
    {
      email: "driver.marrakech.ma@medisync.global",
      countryCode: "MA",
      lat: 31.6365,
      lng: -8.0085,
      status: "AVAILABLE" as const,
      headingDeg: 180,
    },
    {
      email: "driver.tangier.ma@medisync.global",
      countryCode: "MA",
      lat: 35.7688,
      lng: -5.8145,
      status: "AVAILABLE" as const,
      headingDeg: 315,
    },
    {
      email: "driver.fes.ma@medisync.global",
      countryCode: "MA",
      lat: 34.028,
      lng: -5.0015,
      status: "AVAILABLE" as const,
      headingDeg: 60,
    },
    {
      email: "driver.agadir.ma@medisync.global",
      countryCode: "MA",
      lat: 30.4185,
      lng: -9.596,
      status: "AVAILABLE" as const,
      headingDeg: 210,
    },
    {
      email: "driver.intl@medisync.global",
      countryCode: "INTL",
      lat: 46.1975,
      lng: 6.1502,
      status: "AVAILABLE" as const,
      headingDeg: 45,
    },
  ];
  for (const drv of driverLocations) {
    const driverId = userIdsByEmail.get(drv.email);
    if (driverId) {
      await upsertDriverLocation(redis, {
        driverId,
        countryCode: drv.countryCode,
        lat: drv.lat,
        lng: drv.lng,
        status: drv.status,
        headingDeg: drv.headingDeg,
      });
      driversPinged += 1;
    }
  }

  // 5. Seed Sample Clinical Note, Signed QR Prescription & Lab Order for MA & INTL if none exist yet
  let prescriptionsSeeded = 0;
  const clinicalPairs = [
    {
      countryCode: "MA",
      patientEmail: "patient.ma@medisync.global",
      doctorEmail: "doctor.ma@medisync.global",
      clinicLicense: "MA-CLIN-901002",
      labLicense: "MA-LAB-901004",
      medication: "Amlodipine",
      dosage: "5 mg",
      panelName: "Lipid & Troponin Cardiac Panel",
    },
    {
      countryCode: "INTL",
      patientEmail: "patient.intl@medisync.global",
      doctorEmail: "doctor.intl@medisync.global",
      clinicLicense: "INTL-CLIN-101002",
      labLicense: "INTL-LABS-101004",
      medication: "Amoxicillin",
      dosage: "500 mg",
      panelName: "Complete Blood Count (CBC)",
    },
  ];

  for (const pair of clinicalPairs) {
    const patientId = userIdsByEmail.get(pair.patientEmail);
    const doctorId = userIdsByEmail.get(pair.doctorEmail);
    const clinicId = facilityIdsByLicense.get(pair.clinicLicense);
    const labId = facilityIdsByLicense.get(pair.labLicense);
    if (!patientId || !doctorId || !clinicId || !labId) continue;

    const nonce = crypto
      .createHash("sha256")
      .update(`${pair.countryCode}:${pair.patientEmail}:seed-v1`)
      .digest("hex")
      .slice(0, 24);
    const existingRx = await pool.query<{ id: string }>(
      `SELECT id FROM prescriptions WHERE qr_nonce = $1 LIMIT 1`,
      [nonce],
    );
    const rxId = existingRx.rows[0]?.id ?? crypto.randomUUID();
    const signed = signPrescriptionQr(
      {
        rxId,
        countryCode: pair.countryCode,
        patientUserId: patientId,
        doctorUserId: doctorId,
        nonce,
      },
      authSecret,
    );

    if (existingRx.rowCount === 0) {
      await pool.query(
        `INSERT INTO visit_notes (
           country_code, patient_user_id, doctor_user_id, facility_id,
           icd10_codes, subjective, objective, assessment, plan
         )
         VALUES ($1, $2, $3, $4, ARRAY['I10'], 'Mild exertional fatigue.', 'BP 132/82 mmHg, HR 72 bpm.', 'Controlled hypertension follow-up.', 'Continue therapy and complete routine blood panel.')`,
        [pair.countryCode, patientId, doctorId, clinicId],
      );

      await pool.query(
        `INSERT INTO prescriptions (
           id, country_code, patient_user_id, doctor_user_id, facility_id,
           medications, notes, qr_nonce, qr_token, qr_signature, status
         )
         VALUES ($1, $2, $3, $4, $5, $6::jsonb, 'Seeded initial e-prescription ready for QR pharmacy scan.', $7, $8, $9, 'ISSUED')`,
        [
          rxId,
          pair.countryCode,
          patientId,
          doctorId,
          clinicId,
          JSON.stringify([
            {
              name: pair.medication,
              dosage: pair.dosage,
              frequency: "Once daily",
              durationDays: 14,
            },
          ]),
          nonce,
          signed.qrToken,
          signed.qrSignature,
        ],
      );
      prescriptionsSeeded += 1;
    } else {
      await pool.query(
        `UPDATE prescriptions SET qr_token = $2, qr_signature = $3 WHERE id = $1`,
        [rxId, signed.qrToken, signed.qrSignature],
      );
    }

    const existingLab = await pool.query<{ id: string }>(
      `SELECT id FROM lab_orders WHERE patient_user_id = $1 AND facility_id = $2 LIMIT 1`,
      [patientId, labId],
    );
    if (existingLab.rowCount === 0) {
      await pool.query(
        `INSERT INTO lab_orders (
           country_code, patient_user_id, ordered_by_doctor_id, facility_id, panel_name, urgency, status
         )
         VALUES ($1, $2, $3, $4, $5, 'ROUTINE', 'ORDERED')`,
        [pair.countryCode, patientId, doctorId, labId, pair.panelName],
      );
    }

    // Ensure the seeded doctor has active upcoming CONFIRMED Clinic + Video appointments for live clinical testing
    const activeUpcoming = await pool.query<{ id: string }>(
      `SELECT id FROM appointments
       WHERE doctor_user_id = $1
         AND status IN ('CONFIRMED', 'CHECKED_IN')
         AND slot_start_at >= NOW() - INTERVAL '1 day'
       LIMIT 1`,
      [doctorId],
    );
    if (activeUpcoming.rowCount === 0) {
      const targetDay = new Date();
      targetDay.setUTCHours(0, 0, 0, 0);
      while (targetDay.getUTCDay() === 0 || targetDay.getUTCDay() === 6) {
        targetDay.setUTCDate(targetDay.getUTCDate() + 1);
      }
      const clinicStart = new Date(targetDay);
      clinicStart.setUTCHours(9, 30, 0, 0);
      const clinicEnd = new Date(targetDay);
      clinicEnd.setUTCHours(10, 0, 0, 0);
      const videoStart = new Date(targetDay);
      videoStart.setUTCHours(10, 30, 0, 0);
      const videoEnd = new Date(targetDay);
      videoEnd.setUTCHours(11, 0, 0, 0);

      const schedRow = await pool.query<{ id: string }>(
        `SELECT id FROM doctor_schedules
         WHERE doctor_user_id = $1 AND facility_id = $2 AND is_active = TRUE
         ORDER BY (CASE WHEN day_of_week = $3 THEN 0 ELSE 1 END), day_of_week ASC
         LIMIT 1`,
        [doctorId, clinicId, targetDay.getUTCDay()],
      );
      const schedId = schedRow.rows[0]?.id ?? null;

      if (schedId) {
        await pool.query(
          `INSERT INTO appointments (
             country_code, patient_user_id, booked_by_user_id, doctor_user_id, facility_id, schedule_id,
             slot_start_at, slot_end_at, visit_mode, status, reason
           )
           VALUES
             ($1, $2, $2, $3, $4, $5, $6::timestamptz, $7::timestamptz, 'IN_PERSON', 'CONFIRMED', 'Hypertension & ECG follow-up'),
             ($1, $2, $2, $3, $4, $5, $8::timestamptz, $9::timestamptz, 'TELEHEALTH', 'CONFIRMED', 'Medication & lab result review')
           ON CONFLICT DO NOTHING`,
          [
            pair.countryCode,
            patientId,
            doctorId,
            clinicId,
            schedId,
            clinicStart.toISOString(),
            clinicEnd.toISOString(),
            videoStart.toISOString(),
            videoEnd.toISOString(),
          ],
        );
      }
    }
  }

  await seedDefaultPharmacyProducts(pool);
  await seedDefaultMedicalServices(pool, facilityIdsByLicense, opsId);
  await bumpCacheGeneration(redis, DIRECTORY_CACHE_GEN_KEY);

  return {
    facilitiesSeeded: SEED_FACILITIES.length,
    usersSeeded: SEED_USERS.length,
    schedulesSeeded,
    driversPinged,
    prescriptionsSeeded,
  };
}

async function seedDefaultMedicalServices(
  pool: Pool,
  facilityIdsByLicense: ReadonlyMap<string, string>,
  actorUserId: string,
): Promise<void> {
  const defaultServices = [
    {
      facilityLicense: "MA-CLIN-901002",
      countryCode: "MA",
      category: "CONSULTATION",
      serviceCode: "MA-CARD-001",
      name: "Cardiology Consultation & ECG",
      description: "Comprehensive cardiovascular consult with 12-lead ECG.",
      specialty: "Cardiology",
      priceMinor: 35000,
      currencyCode: "MAD",
      durationMinutes: 30,
      homeServiceAvailable: false,
      telehealthAvailable: true,
    },
    {
      facilityLicense: "MA-CLIN-901002",
      countryCode: "MA",
      category: "TELEHEALTH",
      serviceCode: "MA-TELE-002",
      name: "HD Video Physician Teleconsultation",
      description: "Encrypted remote doctor consultation with e-prescription.",
      specialty: "General Practice",
      priceMinor: 25000,
      currencyCode: "MAD",
      durationMinutes: 20,
      homeServiceAvailable: false,
      telehealthAvailable: true,
    },
    {
      facilityLicense: "MA-LAB-901004",
      countryCode: "MA",
      category: "LAB_TEST",
      serviceCode: "MA-LABS-003",
      name: "Complete Blood, Lipid & HbA1c Panel",
      description: "Same-day venous draw in lab or at home with digital PDF report.",
      specialty: "Clinical Pathology",
      priceMinor: 22000,
      currencyCode: "MAD",
      durationMinutes: 15,
      homeServiceAvailable: true,
      telehealthAvailable: false,
    },
    {
      facilityLicense: "MA-LAB-901004",
      countryCode: "MA",
      category: "IMAGING",
      serviceCode: "MA-IMAG-004",
      name: "Cardiac Doppler Echocardiogram",
      description: "High-resolution Doppler ultrasound performed by a radiologist.",
      specialty: "Radiology",
      priceMinor: 65000,
      currencyCode: "MAD",
      durationMinutes: 35,
      homeServiceAvailable: false,
      telehealthAvailable: false,
    },
    {
      facilityLicense: "MA-HOSP-901001",
      countryCode: "MA",
      category: "HOME_CARE",
      serviceCode: "MA-HOME-005",
      name: "State Nurse Home Care & Wound Visit",
      description: "At-home nursing care, post-op dressing, and vitals monitoring.",
      specialty: "Home Nursing",
      priceMinor: 30000,
      currencyCode: "MAD",
      durationMinutes: 45,
      homeServiceAvailable: true,
      telehealthAvailable: false,
    },
    {
      facilityLicense: "MA-HOSP-901001",
      countryCode: "MA",
      category: "AMBULANCE",
      serviceCode: "MA-EMSC-006",
      name: "BLS Rapid Emergency Medical Transport",
      description: "24/7 ambulance transfer with continuous paramedic telemetry.",
      specialty: "Emergency",
      priceMinor: 45000,
      currencyCode: "MAD",
      durationMinutes: 40,
      homeServiceAvailable: true,
      telehealthAvailable: false,
    },
    {
      facilityLicense: "MA-PHRM-901003",
      countryCode: "MA",
      category: "PHARMACY_SERVICE",
      serviceCode: "MA-PHRM-007",
      name: "Express Cold-Chain Medication Delivery",
      description: "Temperature-controlled home delivery for verified e-prescriptions.",
      specialty: "Pharmacy",
      priceMinor: 5000,
      currencyCode: "MAD",
      durationMinutes: 30,
      homeServiceAvailable: true,
      telehealthAvailable: false,
    },
    {
      facilityLicense: "MA-CLIN-902002",
      countryCode: "MA",
      category: "CONSULTATION",
      serviceCode: "MA-RBA-001",
      name: "Rabat Internal Medicine & Preventive Checkup",
      description: "Comprehensive internal medicine consult in Agdal, Rabat with digital summary.",
      specialty: "Internal Medicine",
      priceMinor: 30000,
      currencyCode: "MAD",
      durationMinutes: 30,
      homeServiceAvailable: false,
      telehealthAvailable: true,
    },
    {
      facilityLicense: "MA-CLIN-903002",
      countryCode: "MA",
      category: "CONSULTATION",
      serviceCode: "MA-RAK-001",
      name: "Marrakech Pediatric Consultation & Growth Review",
      description: "Specialist pediatric consultation in Guéliz with video follow-up option.",
      specialty: "Pediatrics",
      priceMinor: 30000,
      currencyCode: "MAD",
      durationMinutes: 30,
      homeServiceAvailable: false,
      telehealthAvailable: true,
    },
    {
      facilityLicense: "MA-CLIN-904002",
      countryCode: "MA",
      category: "CONSULTATION",
      serviceCode: "MA-TNG-001",
      name: "Tangier Ophthalmology & Visual Acuity Exam",
      description: "Complete eye exam and anterior segment screening on Boulevard Pasteur.",
      specialty: "Ophthalmology",
      priceMinor: 35000,
      currencyCode: "MAD",
      durationMinutes: 30,
      homeServiceAvailable: false,
      telehealthAvailable: true,
    },
    {
      facilityLicense: "MA-CLIN-905002",
      countryCode: "MA",
      category: "CONSULTATION",
      serviceCode: "MA-FEZ-001",
      name: "Fès Family & General Medicine Consultation",
      description: "Primary care evaluation, chronic care tracking, and teleconsultation in Ville Nouvelle.",
      specialty: "General Medicine",
      priceMinor: 25000,
      currencyCode: "MAD",
      durationMinutes: 25,
      homeServiceAvailable: false,
      telehealthAvailable: true,
    },
    {
      facilityLicense: "MA-CLIN-906002",
      countryCode: "MA",
      category: "CONSULTATION",
      serviceCode: "MA-AGA-001",
      name: "Agadir Clinical Dermatology & Dermoscopy",
      description: "Skin exam, allergy evaluation, and teledermatology follow-up in Agadir.",
      specialty: "Dermatology",
      priceMinor: 30000,
      currencyCode: "MAD",
      durationMinutes: 30,
      homeServiceAvailable: false,
      telehealthAvailable: true,
    },
    {
      facilityLicense: "INTL-CLIN-101002",
      countryCode: "INTL",
      category: "CONSULTATION",
      serviceCode: "INTL-MED-101",
      name: "Executive Internal Medicine Consult",
      description: "Bilingual internal medicine evaluation and preventative care plan.",
      specialty: "Internal Medicine",
      priceMinor: 18000,
      currencyCode: "CHF",
      durationMinutes: 40,
      homeServiceAvailable: false,
      telehealthAvailable: true,
    },
    {
      facilityLicense: "INTL-LABS-101004",
      countryCode: "INTL",
      category: "LAB_TEST",
      serviceCode: "INTL-LAB-102",
      name: "Comprehensive Molecular Biomarker Panel",
      description: "Full metabolic, thyroid, and inflammatory panel with home nurse option.",
      specialty: "Diagnostics",
      priceMinor: 21000,
      currencyCode: "CHF",
      durationMinutes: 20,
      homeServiceAvailable: true,
      telehealthAvailable: false,
    },
    {
      facilityLicense: "INTL-HOSP-101001",
      countryCode: "INTL",
      category: "AMBULANCE",
      serviceCode: "INTL-EMS-103",
      name: "Mobile ICU Paramedic Dispatch",
      description: "Cross-canton emergency stabilization and critical care transport.",
      specialty: "Emergency",
      priceMinor: 42000,
      currencyCode: "CHF",
      durationMinutes: 45,
      homeServiceAvailable: true,
      telehealthAvailable: false,
    },
  ] as const;

  for (const svc of defaultServices) {
    const facilityId = facilityIdsByLicense.get(svc.facilityLicense);
    if (!facilityId) continue;

    await pool.query(
      `INSERT INTO medical_services (
         country_code, facility_id, category, service_code, name, description,
         specialty, price_minor, currency_code, duration_minutes,
         home_service_available, telehealth_available, is_active, created_by_user_id
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, TRUE, $13)
       ON CONFLICT (facility_id, service_code) DO NOTHING`,
      [
        svc.countryCode,
        facilityId,
        svc.category,
        svc.serviceCode,
        svc.name,
        svc.description,
        svc.specialty,
        svc.priceMinor,
        svc.currencyCode,
        svc.durationMinutes,
        svc.homeServiceAvailable,
        svc.telehealthAvailable,
        actorUserId,
      ],
    );
  }
}
