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

interface RegionalMoroccoHubSeed {
  codeNum: number;
  slug: string;
  city: string;
  lat: number;
  lng: number;
  phonePrefix: string;
  hospitalName: string;
  hospitalAddress: string;
  clinicName: string;
  clinicAddress: string;
  pharmacyName: string;
  pharmacyAddress: string;
  labName: string;
  labAddress: string;
  doctor?: {
    fullName: string;
    specialty: string;
    feeMinor: number;
  };
  driver?: {
    fullName: string;
  };
}

const REGIONAL_MOROCCO_HUBS: readonly RegionalMoroccoHubSeed[] = [
  {
    codeNum: 907,
    slug: "mohammedia",
    city: "Mohammedia",
    lat: 33.6866,
    lng: -7.3829,
    phonePrefix: "+212-523-32",
    hospitalName: "CHP Moulay Abdellah Mohammedia",
    hospitalAddress: "Boulevard Hassan II, Mohammedia",
    clinicName: "Clinique du Parc Mohammedia",
    clinicAddress: "18 Boulevard des FAR, Le Parc, Mohammedia",
    pharmacyName: "Pharmacie du Parc 24/7 Mohammedia",
    pharmacyAddress: "42 Boulevard Mohammed V, Mohammedia",
    labName: "Labo BioFédala Mohammedia",
    labAddress: "9 Rue de Fès, Mohammedia",
    doctor: { fullName: "Dr. Hicham Berrada", specialty: "Cardiology", feeMinor: 30000 },
    driver: { fullName: "Abdellah Fikri" },
  },
  {
    codeNum: 908,
    slug: "el-jadida",
    city: "El Jadida",
    lat: 33.2316,
    lng: -8.5007,
    phonePrefix: "+212-523-34",
    hospitalName: "CHP Mohammed V El Jadida",
    hospitalAddress: "Avenue des Nations Unies, El Jadida",
    clinicName: "Clinique Doukkala El Jadida",
    clinicAddress: "25 Boulevard Mohammed VI, Plateau, El Jadida",
    pharmacyName: "Pharmacie Plateau 24/7 El Jadida",
    pharmacyAddress: "12 Avenue Mohammed V, El Jadida",
    labName: "Labo BioDoukkala El Jadida",
    labAddress: "7 Rue d'Oujda, El Jadida",
    doctor: { fullName: "Dr. Sanaa El Idrissi", specialty: "Pediatrics", feeMinor: 28000 },
    driver: { fullName: "Mourad Chakir" },
  },
  {
    codeNum: 909,
    slug: "settat",
    city: "Settat",
    lat: 33.001,
    lng: -7.6166,
    phonePrefix: "+212-523-40",
    hospitalName: "CHR Hassan II Settat",
    hospitalAddress: "Route de Casablanca, Settat",
    clinicName: "Clinique Chaouia Spécialités",
    clinicAddress: "30 Boulevard Mohammed V, Settat",
    pharmacyName: "Pharmacie Chaouia Garde 24/7",
    pharmacyAddress: "14 Place de l'Indépendance, Settat",
    labName: "Labo Analyses Chaouia Settat",
    labAddress: "6 Avenue des FAR, Settat",
    doctor: { fullName: "Dr. Adil Rahmani", specialty: "General Medicine", feeMinor: 25000 },
    driver: { fullName: "Redouane Saidi" },
  },
  {
    codeNum: 910,
    slug: "berrechid",
    city: "Berrechid",
    lat: 33.2655,
    lng: -7.5875,
    phonePrefix: "+212-522-32",
    hospitalName: "CHP Berrechid Urgences",
    hospitalAddress: "Avenue Mohammed V, Berrechid",
    clinicName: "Polyclinique Berrechid Santé",
    clinicAddress: "22 Boulevard Hassan II, Berrechid",
    pharmacyName: "Pharmacie Al Amal 24/7 Berrechid",
    pharmacyAddress: "5 Avenue Zerktouni, Berrechid",
    labName: "Labo BioBerrechid",
    labAddress: "11 Rue de la Liberté, Berrechid",
  },
  {
    codeNum: 911,
    slug: "sale",
    city: "Salé",
    lat: 34.0531,
    lng: -6.7985,
    phonePrefix: "+212-537-86",
    hospitalName: "CHP Prince Moulay Abdellah Salé",
    hospitalAddress: "Route de Kénitra, Tabriquet, Salé",
    clinicName: "Clinique Bouregreg Salé",
    clinicAddress: "48 Avenue Mohammed V, Bettana, Salé",
    pharmacyName: "Pharmacie Tabriquet 24/7 Salé",
    pharmacyAddress: "16 Avenue Moulay Ismail, Salé",
    labName: "Labo BioSalé Analyses",
    labAddress: "20 Avenue des FAR, Sala Al Jadida, Salé",
    doctor: { fullName: "Dr. Kawtar Benhima", specialty: "Gynecology", feeMinor: 30000 },
    driver: { fullName: "Noureddine Zaki" },
  },
  {
    codeNum: 912,
    slug: "temara",
    city: "Témara",
    lat: 33.9267,
    lng: -6.9122,
    phonePrefix: "+212-537-60",
    hospitalName: "CHP Sidi Lahcen Témara",
    hospitalAddress: "Avenue Hassan II, Témara",
    clinicName: "Clinique Harhoura & Témara",
    clinicAddress: "35 Avenue Mohammed V, Wifak, Témara",
    pharmacyName: "Pharmacie Al Wifak 24/7 Témara",
    pharmacyAddress: "9 Boulevard Hassan II, Témara",
    labName: "Labo Diagnostics Témara",
    labAddress: "14 Rue Tariq Ibn Ziad, Témara",
    doctor: { fullName: "Dr. Younes Lmrabet", specialty: "Internal Medicine", feeMinor: 30000 },
    driver: { fullName: "Fouad El Kouri" },
  },
  {
    codeNum: 913,
    slug: "kenitra",
    city: "Kénitra",
    lat: 34.261,
    lng: -6.5802,
    phonePrefix: "+212-537-37",
    hospitalName: "CHR El Idrissi Kénitra",
    hospitalAddress: "Avenue Mohammed Diouri, Kénitra",
    clinicName: "Clinique Sebou Spécialités Kénitra",
    clinicAddress: "54 Avenue Mohammed V, Ville Haute, Kénitra",
    pharmacyName: "Pharmacie Ville Haute 24/7 Kénitra",
    pharmacyAddress: "19 Avenue Hassan II, Mimosa, Kénitra",
    labName: "Labo BioGharb Kénitra",
    labAddress: "8 Rue Maamora, Kénitra",
    doctor: { fullName: "Dr. Lamiae Alaoui", specialty: "Dermatology", feeMinor: 30000 },
    driver: { fullName: "Rachid Gharbaoui" },
  },
  {
    codeNum: 914,
    slug: "tetouan",
    city: "Tétouan",
    lat: 35.5785,
    lng: -5.3684,
    phonePrefix: "+212-539-97",
    hospitalName: "CHR Saniat Rmel Tétouan",
    hospitalAddress: "Avenue des FAR, Tétouan",
    clinicName: "Clinique Al Andalous Tétouan",
    clinicAddress: "24 Boulevard Mohammed V, Ensanche, Tétouan",
    pharmacyName: "Pharmacie Ensanche 24/7 Tétouan",
    pharmacyAddress: "11 Place Moulay El Mehdi, Tétouan",
    labName: "Labo BioNord Tétouan",
    labAddress: "16 Avenue Hassan II, Wilaya, Tétouan",
    doctor: { fullName: "Dr. Tarek Chaoui", specialty: "Orthopedics", feeMinor: 32000 },
    driver: { fullName: "Bilal El Amri" },
  },
  {
    codeNum: 915,
    slug: "al-hoceima",
    city: "Al Hoceïma",
    lat: 35.2517,
    lng: -3.9372,
    phonePrefix: "+212-539-98",
    hospitalName: "CHR Mohammed VI Al Hoceïma",
    hospitalAddress: "Avenue Tariq Ibn Ziad, Al Hoceïma",
    clinicName: "Clinique du Rif Al Hoceïma",
    clinicAddress: "15 Boulevard Mohammed V, Mirador, Al Hoceïma",
    pharmacyName: "Pharmacie Mirador 24/7 Al Hoceïma",
    pharmacyAddress: "6 Place Mohammed VI, Al Hoceïma",
    labName: "Labo Rif Biologie Al Hoceïma",
    labAddress: "22 Avenue Hassan II, Al Hoceïma",
    doctor: { fullName: "Dr. Nabila Khattabi", specialty: "General Medicine", feeMinor: 25000 },
    driver: { fullName: "Samir Riffi" },
  },
  {
    codeNum: 916,
    slug: "chefchaouen",
    city: "Chefchaouen",
    lat: 35.1688,
    lng: -5.2636,
    phonePrefix: "+212-539-98",
    hospitalName: "CHP Mohammed V Chefchaouen",
    hospitalAddress: "Avenue Hassan II, Chefchaouen",
    clinicName: "Centre Médical Rif Bleu Chefchaouen",
    clinicAddress: "14 Avenue Mohammed V, Chefchaouen",
    pharmacyName: "Pharmacie Outa El Hammam 24/7",
    pharmacyAddress: "3 Avenue Al Massira, Chefchaouen",
    labName: "Labo Analyses Chefchaouen",
    labAddress: "9 Boulevard Allal Ben Abdellah, Chefchaouen",
  },
  {
    codeNum: 917,
    slug: "larache",
    city: "Larache",
    lat: 35.1932,
    lng: -6.1557,
    phonePrefix: "+212-539-91",
    hospitalName: "CHP Lalla Meryem Larache",
    hospitalAddress: "Avenue Mohammed V, Larache",
    clinicName: "Clinique Loukkos Larache",
    clinicAddress: "27 Boulevard Moulay Ismail, Larache",
    pharmacyName: "Pharmacie Lixus 24/7 Larache",
    pharmacyAddress: "10 Place de la Libération, Larache",
    labName: "Labo BioLoukkos Larache",
    labAddress: "4 Rue Tarik Ibn Ziad, Larache",
  },
  {
    codeNum: 918,
    slug: "meknes",
    city: "Meknès",
    lat: 33.8935,
    lng: -5.5473,
    phonePrefix: "+212-535-52",
    hospitalName: "CHR Mohammed V Meknès",
    hospitalAddress: "Avenue des FAR, Hamria, Meknès",
    clinicName: "Clinique Ismaïlia Meknès",
    clinicAddress: "38 Avenue Mohammed V, Hamria, Meknès",
    pharmacyName: "Pharmacie Hamria 24/7 Meknès",
    pharmacyAddress: "17 Boulevard Allal Ben Abdellah, Meknès",
    labName: "Labo BioIsmaïlia Meknès",
    labAddress: "12 Rue de Paris, Belle Vue, Meknès",
    doctor: { fullName: "Dr. Othmane Filali", specialty: "Cardiology", feeMinor: 30000 },
    driver: { fullName: "Mustapha El Mouden" },
  },
  {
    codeNum: 919,
    slug: "taza",
    city: "Taza",
    lat: 34.213,
    lng: -4.0103,
    phonePrefix: "+212-535-67",
    hospitalName: "CHP Ibn Baja Taza",
    hospitalAddress: "Avenue Mohammed V, Taza",
    clinicName: "Clinique Al Qods Taza",
    clinicAddress: "19 Avenue Hassan II, Taza Bas, Taza",
    pharmacyName: "Pharmacie Taza Garde 24/7",
    pharmacyAddress: "8 Place de l'Indépendance, Taza",
    labName: "Labo BioTaza",
    labAddress: "14 Rue Al Massira, Taza",
  },
  {
    codeNum: 920,
    slug: "ifrane",
    city: "Ifrane",
    lat: 33.5228,
    lng: -5.111,
    phonePrefix: "+212-535-56",
    hospitalName: "CHP 20 Août Ifrane",
    hospitalAddress: "Avenue Hassan II, Ifrane",
    clinicName: "Centre Médical Moyen Atlas Ifrane",
    clinicAddress: "7 Avenue Mohammed V, Ifrane",
    pharmacyName: "Pharmacie des Cèdres 24/7 Ifrane",
    pharmacyAddress: "4 Place du Lion, Ifrane",
    labName: "Labo Atlas Analyses Ifrane",
    labAddress: "12 Rue de la Marche Verte, Ifrane",
  },
  {
    codeNum: 921,
    slug: "oujda",
    city: "Oujda",
    lat: 34.6814,
    lng: -1.9086,
    phonePrefix: "+212-536-53",
    hospitalName: "CHU Mohammed VI Oujda",
    hospitalAddress: "Route de Sidi Maafa, Oujda",
    clinicName: "Clinique Al Farabi Oujda",
    clinicAddress: "45 Boulevard Mohammed V, Oujda",
    pharmacyName: "Pharmacie Angad 24/7 Oujda",
    pharmacyAddress: "21 Boulevard Derfoufi, Centre Ville, Oujda",
    labName: "Labo BioOriental Oujda",
    labAddress: "16 Rue de Marrakech, Lazaret, Oujda",
    doctor: { fullName: "Dr. Soufiane Bekkali", specialty: "Internal Medicine", feeMinor: 28000 },
    driver: { fullName: "Khalid Oujdi" },
  },
  {
    codeNum: 922,
    slug: "nador",
    city: "Nador",
    lat: 35.1681,
    lng: -2.9335,
    phonePrefix: "+212-536-60",
    hospitalName: "CHP Hassani Nador",
    hospitalAddress: "Boulevard des FAR, Nador",
    clinicName: "Clinique Marchica Nador",
    clinicAddress: "29 Avenue Mohammed V, Nador",
    pharmacyName: "Pharmacie Marchica 24/7 Nador",
    pharmacyAddress: "14 Boulevard Hassan II, Nador",
    labName: "Labo BioNador Analyses",
    labAddress: "8 Avenue Youssef Ibn Tachfine, Nador",
    doctor: { fullName: "Dr. Farah Benali", specialty: "Pediatrics", feeMinor: 28000 },
    driver: { fullName: "Mimoun Azizi" },
  },
  {
    codeNum: 923,
    slug: "berkane",
    city: "Berkane",
    lat: 34.92,
    lng: -2.32,
    phonePrefix: "+212-536-61",
    hospitalName: "CHP Ed-Darak Berkane",
    hospitalAddress: "Boulevard Mohammed V, Berkane",
    clinicName: "Clinique Triffa Berkane",
    clinicAddress: "18 Avenue Hassan II, Berkane",
    pharmacyName: "Pharmacie Al Fath 24/7 Berkane",
    pharmacyAddress: "6 Avenue Al Massira, Berkane",
    labName: "Labo BioBerkane",
    labAddress: "11 Rue de Oujda, Berkane",
  },
  {
    codeNum: 924,
    slug: "beni-mellal",
    city: "Béni Mellal",
    lat: 32.3373,
    lng: -6.3498,
    phonePrefix: "+212-523-48",
    hospitalName: "CHR Béni Mellal Urgences",
    hospitalAddress: "Boulevard Mohammed V, Béni Mellal",
    clinicName: "Clinique Aïn Asserdoun Béni Mellal",
    clinicAddress: "32 Avenue Hassan II, Béni Mellal",
    pharmacyName: "Pharmacie Tadla 24/7 Béni Mellal",
    pharmacyAddress: "15 Place Al Massira, Béni Mellal",
    labName: "Labo BioTadla Béni Mellal",
    labAddress: "9 Boulevard Beyrouth, Béni Mellal",
    doctor: { fullName: "Dr. Amine Tadlaoui", specialty: "Orthopedics", feeMinor: 28000 },
    driver: { fullName: "Brahim Nassiri" },
  },
  {
    codeNum: 925,
    slug: "khouribga",
    city: "Khouribga",
    lat: 32.8811,
    lng: -6.9063,
    phonePrefix: "+212-523-49",
    hospitalName: "CHP Hassan II Khouribga",
    hospitalAddress: "Avenue Mohammed V, Khouribga",
    clinicName: "Clinique El Qods Khouribga",
    clinicAddress: "24 Boulevard Moulay Youssef, Khouribga",
    pharmacyName: "Pharmacie El Qods 24/7 Khouribga",
    pharmacyAddress: "10 Rue de Casablanca, Khouribga",
    labName: "Labo BioKhouribga",
    labAddress: "18 Avenue des FAR, Khouribga",
    doctor: { fullName: "Dr. Nadia Choukri", specialty: "General Medicine", feeMinor: 25000 },
    driver: { fullName: "Aziz El Mlih" },
  },
  {
    codeNum: 926,
    slug: "safi",
    city: "Safi",
    lat: 32.2994,
    lng: -9.2372,
    phonePrefix: "+212-524-46",
    hospitalName: "CHR Mohammed V Safi",
    hospitalAddress: "Avenue Kennedy, Plateau, Safi",
    clinicName: "Clinique Abda Spécialités Safi",
    clinicAddress: "26 Boulevard Mohammed V, Safi",
    pharmacyName: "Pharmacie Plateau 24/7 Safi",
    pharmacyAddress: "12 Avenue Hassan II, Safi",
    labName: "Labo BioAbda Safi",
    labAddress: "7 Rue de Rabat, Ville Nouvelle, Safi",
    doctor: { fullName: "Dr. Karim Abdaoui", specialty: "Cardiology", feeMinor: 30000 },
    driver: { fullName: "Mohamed Safioui" },
  },
  {
    codeNum: 927,
    slug: "essaouira",
    city: "Essaouira",
    lat: 31.5085,
    lng: -9.7595,
    phonePrefix: "+212-524-47",
    hospitalName: "CHP Sidi Mohammed Ben Abdellah Essaouira",
    hospitalAddress: "Avenue Al Aqaba, Essaouira",
    clinicName: "Clinique Mogador Essaouira",
    clinicAddress: "19 Avenue Mohammed V, Essaouira",
    pharmacyName: "Pharmacie Mogador 24/7 Essaouira",
    pharmacyAddress: "8 Avenue de l'Istiqlal, Essaouira",
    labName: "Labo BioMogador Essaouira",
    labAddress: "15 Boulevard Mohammed VI, Essaouira",
    doctor: { fullName: "Dr. Salwa El Harrak", specialty: "Dermatology", feeMinor: 28000 },
    driver: { fullName: "Youssef Souiri" },
  },
  {
    codeNum: 928,
    slug: "benguerir",
    city: "Benguérir",
    lat: 32.2359,
    lng: -7.9538,
    phonePrefix: "+212-524-31",
    hospitalName: "CHP Rehamna Benguérir",
    hospitalAddress: "Avenue Mohammed VI, Benguérir",
    clinicName: "Centre Médical Ville Verte Benguérir",
    clinicAddress: "Lot Ville Verte Mohammed VI, Benguérir",
    pharmacyName: "Pharmacie Rehamna 24/7 Benguérir",
    pharmacyAddress: "11 Avenue Mohammed V, Benguérir",
    labName: "Labo BioRehamna Benguérir",
    labAddress: "5 Boulevard Hassan II, Benguérir",
  },
  {
    codeNum: 929,
    slug: "taroudant",
    city: "Taroudant",
    lat: 30.4703,
    lng: -8.877,
    phonePrefix: "+212-528-85",
    hospitalName: "CHP Mokhtar Soussi Taroudant",
    hospitalAddress: "Avenue Mohammed V, Taroudant",
    clinicName: "Clinique Souss Taroudant",
    clinicAddress: "14 Place Assarag, Taroudant",
    pharmacyName: "Pharmacie Assarag 24/7 Taroudant",
    pharmacyAddress: "7 Avenue Bir Anzarane, Taroudant",
    labName: "Labo BioTaroudant",
    labAddress: "19 Avenue Hassan II, Taroudant",
    doctor: { fullName: "Dr. Lahcen Soussi", specialty: "General Medicine", feeMinor: 25000 },
    driver: { fullName: "Hassan Ouhmad" },
  },
  {
    codeNum: 930,
    slug: "tiznit",
    city: "Tiznit",
    lat: 29.6974,
    lng: -9.7316,
    phonePrefix: "+212-528-86",
    hospitalName: "CHP Hassan I Tiznit",
    hospitalAddress: "Avenue Mohammed V, Tiznit",
    clinicName: "Polyclinique Tiznit Santé",
    clinicAddress: "16 Boulevard Hassan II, Tiznit",
    pharmacyName: "Pharmacie El Mechouar 24/7 Tiznit",
    pharmacyAddress: "4 Place El Mechouar, Tiznit",
    labName: "Labo BioTiznit",
    labAddress: "9 Avenue Bir Anzarane, Tiznit",
  },
  {
    codeNum: 931,
    slug: "ouarzazate",
    city: "Ouarzazate",
    lat: 30.9335,
    lng: -6.937,
    phonePrefix: "+212-524-88",
    hospitalName: "CHP Sidi Hssain Bennaceur Ouarzazate",
    hospitalAddress: "Avenue Mohammed V, Ouarzazate",
    clinicName: "Clinique Drâa Ouarzazate",
    clinicAddress: "22 Boulevard Mohammed VI, Ouarzazate",
    pharmacyName: "Pharmacie Drâa 24/7 Ouarzazate",
    pharmacyAddress: "10 Avenue Moulay Rachid, Ouarzazate",
    labName: "Labo BioDrâa Ouarzazate",
    labAddress: "6 Rue Al Massira, Tabounte, Ouarzazate",
    doctor: { fullName: "Dr. Rachida Ait Benali", specialty: "Pediatrics", feeMinor: 26000 },
    driver: { fullName: "Mohamed Draoui" },
  },
  {
    codeNum: 932,
    slug: "errachidia",
    city: "Errachidia",
    lat: 31.9314,
    lng: -4.4244,
    phonePrefix: "+212-535-57",
    hospitalName: "CHR Moulay Ali Chérif Errachidia",
    hospitalAddress: "Avenue Moulay Ali Chérif, Errachidia",
    clinicName: "Clinique Tafilalet Errachidia",
    clinicAddress: "18 Boulevard Mohammed V, Errachidia",
    pharmacyName: "Pharmacie Tafilalet 24/7 Errachidia",
    pharmacyAddress: "9 Place Hassan II, Errachidia",
    labName: "Labo BioTafilalet Errachidia",
    labAddress: "14 Avenue des FAR, Errachidia",
    doctor: { fullName: "Dr. Idriss Filali", specialty: "Internal Medicine", feeMinor: 26000 },
    driver: { fullName: "Youssef Zizi" },
  },
  {
    codeNum: 933,
    slug: "guelmim",
    city: "Guelmim",
    lat: 28.987,
    lng: -10.0574,
    phonePrefix: "+212-528-87",
    hospitalName: "CHR Guelmim Urgences",
    hospitalAddress: "Avenue Mohammed VI, Guelmim",
    clinicName: "Clinique Oued Noun Guelmim",
    clinicAddress: "25 Boulevard Hassan II, Guelmim",
    pharmacyName: "Pharmacie Oued Noun 24/7 Guelmim",
    pharmacyAddress: "12 Avenue Mohammed V, Guelmim",
    labName: "Labo BioGuelmim",
    labAddress: "7 Rue Al Qods, Guelmim",
    doctor: { fullName: "Dr. Mbarka El Ouali", specialty: "General Medicine", feeMinor: 25000 },
    driver: { fullName: "Ali Barka" },
  },
  {
    codeNum: 934,
    slug: "laayoune",
    city: "Laâyoune",
    lat: 27.1536,
    lng: -13.2033,
    phonePrefix: "+212-528-89",
    hospitalName: "CHR Moulay Hassan Ben El Mehdi Laâyoune",
    hospitalAddress: "Boulevard Mekka, Laâyoune",
    clinicName: "Clinique Sakia El Hamra Laâyoune",
    clinicAddress: "30 Avenue Mohammed V, Laâyoune",
    pharmacyName: "Pharmacie Al Wahda 24/7 Laâyoune",
    pharmacyAddress: "14 Boulevard Smara, Laâyoune",
    labName: "Labo BioSahara Laâyoune",
    labAddress: "8 Avenue Kairouan, Laâyoune",
    doctor: { fullName: "Dr. Mariam Maalainine", specialty: "Cardiology", feeMinor: 30000 },
    driver: { fullName: "Sidi Mohamed Khatri" },
  },
  {
    codeNum: 935,
    slug: "dakhla",
    city: "Dakhla",
    lat: 23.6848,
    lng: -15.957,
    phonePrefix: "+212-528-93",
    hospitalName: "CHR Hassan II Dakhla",
    hospitalAddress: "Avenue Al Walae, Dakhla",
    clinicName: "Clinique Baie de Dakhla",
    clinicAddress: "19 Boulevard Mohammed V, Dakhla",
    pharmacyName: "Pharmacie Oued Ed-Dahab 24/7 Dakhla",
    pharmacyAddress: "11 Avenue Al Massira, Hay Salam, Dakhla",
    labName: "Labo BioDakhla Analyses",
    labAddress: "5 Boulevard Hassan II, Dakhla",
    doctor: { fullName: "Dr. Hamza El Ouafi", specialty: "Internal Medicine", feeMinor: 30000 },
    driver: { fullName: "Brahim Dakhlaoui" },
  },
];

const EXPANDED_MOROCCO_FACILITIES: readonly SeedFacilitySpec[] =
  REGIONAL_MOROCCO_HUBS.flatMap((hub) => [
    {
      countryCode: "MA",
      city: hub.city,
      kind: "HOSPITAL" as const,
      name: hub.hospitalName,
      licenseNumber: `MA-HOSP-${hub.codeNum}001`,
      lat: Number((hub.lat + 0.0042).toFixed(4)),
      lng: Number((hub.lng - 0.0038).toFixed(4)),
      address: hub.hospitalAddress,
      phone: `${hub.phonePrefix}-10-01`,
      is247: true,
      acceptsEmergency: true,
      specialties: ["Emergency", "Internal Medicine", "Surgery", "Pediatrics"],
    },
    {
      countryCode: "MA",
      city: hub.city,
      kind: "CLINIC" as const,
      name: hub.clinicName,
      licenseNumber: `MA-CLIN-${hub.codeNum}002`,
      lat: Number((hub.lat - 0.0028).toFixed(4)),
      lng: Number((hub.lng + 0.0045).toFixed(4)),
      address: hub.clinicAddress,
      phone: `${hub.phonePrefix}-20-02`,
      is247: false,
      acceptsEmergency: false,
      specialties: [hub.doctor?.specialty ?? "General Medicine", "Telehealth"],
    },
    {
      countryCode: "MA",
      city: hub.city,
      kind: "PHARMACY" as const,
      name: hub.pharmacyName,
      licenseNumber: `MA-PHRM-${hub.codeNum}003`,
      lat: Number((hub.lat + 0.0018).toFixed(4)),
      lng: Number((hub.lng + 0.0022).toFixed(4)),
      address: hub.pharmacyAddress,
      phone: `${hub.phonePrefix}-30-03`,
      is247: true,
      acceptsEmergency: true,
      specialties: ["24/7 Night Guard", "Prescription Dispensing", "Cold Chain"],
    },
    {
      countryCode: "MA",
      city: hub.city,
      kind: "DIAGNOSTIC_LAB" as const,
      name: hub.labName,
      licenseNumber: `MA-LAB-${hub.codeNum}004`,
      lat: Number((hub.lat - 0.0045).toFixed(4)),
      lng: Number((hub.lng - 0.0024).toFixed(4)),
      address: hub.labAddress,
      phone: `${hub.phonePrefix}-40-04`,
      is247: false,
      acceptsEmergency: false,
      specialties: ["Hematology", "Biochemistry", "Imaging"],
    },
  ]);

const EXPANDED_MOROCCO_USERS: readonly SeedUserSpec[] =
  REGIONAL_MOROCCO_HUBS.flatMap((hub) => {
    const users: SeedUserSpec[] = [];
    if (hub.doctor) {
      users.push({
        email: `doctor.${hub.slug}.ma@medisync.global`,
        fullName: hub.doctor.fullName,
        role: "DOCTOR",
        countryCode: "MA",
        facilityLicense: `MA-CLIN-${hub.codeNum}002`,
        doctorProfile: {
          specialty: hub.doctor.specialty,
          licenseNumber: `MA-MD-${hub.codeNum}01`,
          consultationFeeMinor: hub.doctor.feeMinor,
          bio: `${hub.doctor.specialty} specialist in ${hub.city} providing clinic appointments and encrypted video consultations.`,
        },
      });
    }
    if (hub.driver) {
      users.push({
        email: `driver.${hub.slug}.ma@medisync.global`,
        fullName: hub.driver.fullName,
        role: "DRIVER",
        countryCode: "MA",
        facilityLicense: `MA-HOSP-${hub.codeNum}001`,
      });
    }
    return users;
  });

const BASE_SEED_FACILITIES: readonly SeedFacilitySpec[] = [
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

const SEED_FACILITIES: readonly SeedFacilitySpec[] = [
  ...BASE_SEED_FACILITIES,
  ...EXPANDED_MOROCCO_FACILITIES,
];

const BASE_SEED_USERS: readonly SeedUserSpec[] = [
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

const SEED_USERS: readonly SeedUserSpec[] = [
  ...BASE_SEED_USERS,
  ...EXPANDED_MOROCCO_USERS,
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
    ...REGIONAL_MOROCCO_HUBS.filter((hub) => Boolean(hub.driver)).map(
      (hub, idx) => ({
        email: `driver.${hub.slug}.ma@medisync.global`,
        countryCode: "MA",
        lat: Number((hub.lat + 0.002).toFixed(4)),
        lng: Number((hub.lng - 0.002).toFixed(4)),
        status: "AVAILABLE" as const,
        headingDeg: (idx * 47 + 30) % 360,
      }),
    ),
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
      name: "OTC & Parapharmacy Express Delivery",
      description:
        "Same-day courier delivery for OTC wellness & parapharmacy products (Law 17-04: prescription medicines dispensed in-person at pharmacy counter).",
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
