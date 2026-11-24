import type { LocaleCode } from "@medisync/contracts";

export type MoroccanRegionCode =
  | "MA-01"
  | "MA-02"
  | "MA-03"
  | "MA-04"
  | "MA-05"
  | "MA-06"
  | "MA-07"
  | "MA-08"
  | "MA-09"
  | "MA-10"
  | "MA-11"
  | "MA-12";

export interface MoroccanRegionDefinition {
  code: MoroccanRegionCode;
  name: string;
  labels: Record<LocaleCode, string>;
  capitalCityId: string;
}

export interface MoroccanPlaceDefinition {
  id: string;
  name: string;
  labels: Record<LocaleCode, string>;
  lat: number;
  lng: number;
  aliases?: readonly string[];
}

export interface MoroccanCityDefinition {
  id: string;
  name: string;
  labels: Record<LocaleCode, string>;
  regionCode: MoroccanRegionCode;
  region: string;
  districtLabel: string;
  lat: number;
  lng: number;
  bbox: {
    minLng: number;
    minLat: number;
    maxLng: number;
    maxLat: number;
  };
  aliases: readonly string[];
  places: readonly MoroccanPlaceDefinition[];
  isMajorHub?: boolean;
}

export interface MoroccanLocationMatch {
  id: string;
  kind: "CITY" | "PLACE";
  cityId: string;
  cityName: string;
  cityLabels: Record<LocaleCode, string>;
  name: string;
  labels: Record<LocaleCode, string>;
  regionCode: MoroccanRegionCode;
  region: string;
  districtLabel: string;
  lat: number;
  lng: number;
  bbox: {
    minLng: number;
    minLat: number;
    maxLng: number;
    maxLat: number;
  };
}

export const MOROCCAN_REGIONS: readonly MoroccanRegionDefinition[] = [
  {
    code: "MA-06",
    name: "Casablanca-Settat",
    labels: {
      en: "Casablanca-Settat",
      fr: "Casablanca-Settat",
      ar: "الدار البيضاء-سطات",
    },
    capitalCityId: "casablanca",
  },
  {
    code: "MA-04",
    name: "Rabat-Salé-Kénitra",
    labels: {
      en: "Rabat-Salé-Kénitra",
      fr: "Rabat-Salé-Kénitra",
      ar: "الرباط-سلا-القنيطرة",
    },
    capitalCityId: "rabat",
  },
  {
    code: "MA-07",
    name: "Marrakech-Safi",
    labels: {
      en: "Marrakech-Safi",
      fr: "Marrakech-Safi",
      ar: "مراكش-آسفي",
    },
    capitalCityId: "marrakech",
  },
  {
    code: "MA-01",
    name: "Tanger-Tétouan-Al Hoceïma",
    labels: {
      en: "Tangier-Tetouan-Al Hoceima",
      fr: "Tanger-Tétouan-Al Hoceïma",
      ar: "طنجة-تطوان-الحسيمة",
    },
    capitalCityId: "tangier",
  },
  {
    code: "MA-03",
    name: "Fès-Meknès",
    labels: {
      en: "Fes-Meknes",
      fr: "Fès-Meknès",
      ar: "فاس-مكناس",
    },
    capitalCityId: "fes",
  },
  {
    code: "MA-09",
    name: "Souss-Massa",
    labels: {
      en: "Souss-Massa",
      fr: "Souss-Massa",
      ar: "سوس-ماسة",
    },
    capitalCityId: "agadir",
  },
  {
    code: "MA-02",
    name: "Oriental",
    labels: {
      en: "Oriental",
      fr: "Oriental",
      ar: "الشرق",
    },
    capitalCityId: "oujda",
  },
  {
    code: "MA-05",
    name: "Béni Mellal-Khénifra",
    labels: {
      en: "Beni Mellal-Khenifra",
      fr: "Béni Mellal-Khénifra",
      ar: "بني ملال-خنيفرة",
    },
    capitalCityId: "beni-mellal",
  },
  {
    code: "MA-08",
    name: "Drâa-Tafilalet",
    labels: {
      en: "Draa-Tafilalet",
      fr: "Drâa-Tafilalet",
      ar: "درعة-تافيلالت",
    },
    capitalCityId: "errachidia",
  },
  {
    code: "MA-10",
    name: "Guelmim-Oued Noun",
    labels: {
      en: "Guelmim-Oued Noun",
      fr: "Guelmim-Oued Noun",
      ar: "كلميم-واد نون",
    },
    capitalCityId: "guelmim",
  },
  {
    code: "MA-11",
    name: "Laâyoune-Sakia El Hamra",
    labels: {
      en: "Laayoune-Sakia El Hamra",
      fr: "Laâyoune-Sakia El Hamra",
      ar: "العيون-الساقية الحمراء",
    },
    capitalCityId: "laayoune",
  },
  {
    code: "MA-12",
    name: "Dakhla-Oued Ed-Dahab",
    labels: {
      en: "Dakhla-Oued Ed-Dahab",
      fr: "Dakhla-Oued Ed-Dahab",
      ar: "الداخلة-وادي الذهب",
    },
    capitalCityId: "dakhla",
  },
] as const;

const REGION_BY_CODE = new Map<MoroccanRegionCode, MoroccanRegionDefinition>(
  MOROCCAN_REGIONS.map((r) => [r.code, r]),
);

function makePlace(
  id: string,
  en: string,
  fr: string,
  ar: string,
  lat: number,
  lng: number,
  aliases?: readonly string[],
): MoroccanPlaceDefinition {
  return {
    id,
    name: fr,
    labels: { en, fr, ar },
    lat,
    lng,
    ...(aliases ? { aliases } : {}),
  };
}

interface RawCityInput {
  id: string;
  en: string;
  fr?: string;
  ar: string;
  regionCode: MoroccanRegionCode;
  districtLabel: string;
  lat: number;
  lng: number;
  spanLat?: number;
  spanLng?: number;
  bbox?: MoroccanCityDefinition["bbox"];
  aliases?: readonly string[];
  places?: readonly MoroccanPlaceDefinition[];
  isMajorHub?: boolean;
}

function buildCity(raw: RawCityInput): MoroccanCityDefinition {
  const fr = raw.fr ?? raw.en;
  const regionDef = REGION_BY_CODE.get(raw.regionCode)!;
  const halfLat = raw.spanLat ?? 0.028;
  const halfLng = raw.spanLng ?? 0.044;
  const bbox = raw.bbox ?? {
    minLng: Number((raw.lng - halfLng).toFixed(4)),
    minLat: Number((raw.lat - halfLat).toFixed(4)),
    maxLng: Number((raw.lng + halfLng).toFixed(4)),
    maxLat: Number((raw.lat + halfLat).toFixed(4)),
  };

  const aliasSet = new Set<string>([
    raw.id,
    raw.en,
    fr,
    raw.ar,
    ...(raw.aliases ?? []),
  ]);

  return {
    id: raw.id,
    name: fr,
    labels: { en: raw.en, fr, ar: raw.ar },
    regionCode: raw.regionCode,
    region: regionDef.name,
    districtLabel: raw.districtLabel,
    lat: raw.lat,
    lng: raw.lng,
    bbox,
    aliases: Array.from(aliasSet),
    places: raw.places ?? [],
    ...(raw.isMajorHub ? { isMajorHub: true } : {}),
  };
}

export const MOROCCAN_CITIES_CATALOG: readonly MoroccanCityDefinition[] = [
  // ── MA-06: Casablanca-Settat ──
  buildCity({
    id: "casablanca",
    en: "Casablanca",
    fr: "Casablanca",
    ar: "الدار البيضاء",
    regionCode: "MA-06",
    districtLabel: "Casablanca Central Metro",
    lat: 33.584,
    lng: -7.628,
    bbox: { minLng: -7.694, minLat: 33.562, maxLng: -7.596, maxLat: 33.606 },
    aliases: ["casa", "dar el beida", "dar beida", "كازا", "البيضاء"],
    isMajorHub: true,
    places: [
      makePlace("casa-maarif", "Maarif", "Maârif", "المعاريف", 33.5818, -7.6348, ["maarif", "bir anzarane"]),
      makePlace("casa-anfa", "Anfa", "Anfa", "أنفا", 33.5912, -7.641, ["boulevard anfa", "racine"]),
      makePlace("casa-ain-diab", "Ain Diab", "Aïn Diab", "عين الذئاب", 33.596, -7.672, ["corniche"]),
      makePlace("casa-gauthier", "Gauthier", "Gauthier", "غوتييه", 33.5885, -7.6295),
      makePlace("casa-bourgogne", "Bourgogne", "Bourgogne", "بوركون", 33.5985, -7.6375),
      makePlace("casa-mers-sultan", "Mers Sultan", "Mers Sultan", "مرس السلطان", 33.575, -7.612, ["abdelmoumen"]),
      makePlace("casa-hopitaux", "Quartier des Hopitaux", "Quartier des Hôpitaux", "حي المستشفيات", 33.5835, -7.6212, ["chu ibn rochd"]),
      makePlace("casa-hay-hassani", "Hay Hassani", "Hay Hassani", "الحي الحسني", 33.562, -7.668, ["oulfa"]),
      makePlace("casa-sidi-maarouf", "Sidi Maarouf", "Sidi Maârouf", "سيدي معروف", 33.532, -7.645, ["casanearshore", "californie"]),
      makePlace("casa-californie", "Californie", "Californie", "كاليفورنيا", 33.547, -7.632),
      makePlace("casa-derb-sultan", "Derb Sultan", "Derb Sultan", "درب السلطان", 33.568, -7.604),
      makePlace("casa-ain-sebaa", "Ain Sebaa", "Aïn Sebaâ", "عين السبع", 33.606, -7.535),
      makePlace("casa-sidi-bernoussi", "Sidi Bernoussi", "Sidi Bernoussi", "سيدي البرنوصي", 33.612, -7.502),
      makePlace("casa-hay-mohammadi", "Hay Mohammadi", "Hay Mohammadi", "الحي المحمدي", 33.588, -7.568),
      makePlace("casa-sidi-moumen", "Sidi Moumen", "Sidi Moumen", "سيدي مومن", 33.586, -7.528),
      makePlace("casa-bouskoura", "Bouskoura", "Bouskoura", "بوسكورة", 33.449, -7.648),
      makePlace("casa-dar-bouazza", "Dar Bouazza", "Dar Bouazza", "دار بوعزة", 33.524, -7.826, ["tamaris"]),
    ],
  }),
  buildCity({
    id: "mohammedia",
    en: "Mohammedia",
    fr: "Mohammedia",
    ar: "المحمدية",
    regionCode: "MA-06",
    districtLabel: "Mohammedia Parc & Bay",
    lat: 33.6866,
    lng: -7.3829,
    aliases: ["fedala", "المحمديه"],
    isMajorHub: true,
    places: [
      makePlace("moh-parc", "Le Parc", "Le Parc", "البارك", 33.694, -7.389),
      makePlace("moh-alia", "Alia", "El Alia", "العالية", 33.681, -7.372),
      makePlace("moh-monica", "Plage Monica", "Plage Monica", "شاطئ مونيكا", 33.704, -7.362),
      makePlace("moh-mansouria", "El Mansouria", "El Mansouria", "المنصورية", 33.742, -7.295),
    ],
  }),
  buildCity({
    id: "el-jadida",
    en: "El Jadida",
    fr: "El Jadida",
    ar: "الجديدة",
    regionCode: "MA-06",
    districtLabel: "El Jadida Plateau & Coast",
    lat: 33.2316,
    lng: -8.5007,
    aliases: ["jadida", "mazagan", "الجديده"],
    isMajorHub: true,
    places: [
      makePlace("jad-plateau", "Plateau", "Plateau", "البلاطو", 33.243, -8.504),
      makePlace("jad-sidi-bouzid", "Sidi Bouzid", "Sidi Bouzid", "سيدي بوزيد", 33.226, -8.552),
      makePlace("jad-essalam", "Hay Essalam", "Hay Essalam", "حي السلام", 33.225, -8.494),
    ],
  }),
  buildCity({
    id: "azemmour",
    en: "Azemmour",
    fr: "Azemmour",
    ar: "أزمور",
    regionCode: "MA-06",
    districtLabel: "Azemmour & Oum Er-Rbia",
    lat: 33.2878,
    lng: -8.3422,
    aliases: ["azemour", "ازمور"],
  }),
  buildCity({
    id: "settat",
    en: "Settat",
    fr: "Settat",
    ar: "سطات",
    regionCode: "MA-06",
    districtLabel: "Settat Centre & Chaouia",
    lat: 33.001,
    lng: -7.6166,
    aliases: ["chaouia"],
    isMajorHub: true,
    places: [
      makePlace("set-centre", "Settat Centre", "Centre Ville Settat", "وسط سطات", 33.0015, -7.618),
      makePlace("set-farah", "Hay Al Farah", "Hay Al Farah", "حي الفرح", 32.996, -7.624),
    ],
  }),
  buildCity({
    id: "berrechid",
    en: "Berrechid",
    fr: "Berrechid",
    ar: "برشيد",
    regionCode: "MA-06",
    districtLabel: "Berrechid Centre",
    lat: 33.2655,
    lng: -7.5875,
    aliases: ["deroua", "برشيد"],
    places: [
      makePlace("ber-deroua", "Deroua", "Deroua", "الدروة", 33.395, -7.528),
    ],
  }),
  buildCity({
    id: "benslimane",
    en: "Benslimane",
    fr: "Benslimane",
    ar: "بنسليمان",
    regionCode: "MA-06",
    districtLabel: "Benslimane & Bouznika",
    lat: 33.6122,
    lng: -7.1211,
    aliases: ["ben slimane"],
  }),
  buildCity({
    id: "bouznika",
    en: "Bouznika",
    fr: "Bouznika",
    ar: "بوزنيقة",
    regionCode: "MA-06",
    districtLabel: "Bouznika Bay & Centre",
    lat: 33.7894,
    lng: -7.1597,
  }),
  buildCity({
    id: "sidi-bennour",
    en: "Sidi Bennour",
    fr: "Sidi Bennour",
    ar: "سيدي بنور",
    regionCode: "MA-06",
    districtLabel: "Sidi Bennour Doukkala",
    lat: 32.6524,
    lng: -8.4277,
    aliases: ["doukkala"],
  }),
  buildCity({
    id: "nouaceur",
    en: "Nouaceur",
    fr: "Nouaceur",
    ar: "النواصر",
    regionCode: "MA-06",
    districtLabel: "Nouaceur & Airport Zone",
    lat: 33.3675,
    lng: -7.5736,
    aliases: ["mohammed v airport"],
  }),

  // ── MA-04: Rabat-Salé-Kénitra ──
  buildCity({
    id: "rabat",
    en: "Rabat",
    fr: "Rabat",
    ar: "الرباط",
    regionCode: "MA-04",
    districtLabel: "Rabat Agdal & Hassan",
    lat: 34.004,
    lng: -6.84,
    bbox: { minLng: -6.885, minLat: 33.972, maxLng: -6.795, maxLat: 34.036 },
    aliases: ["ribat", "رباط"],
    isMajorHub: true,
    places: [
      makePlace("rab-agdal", "Agdal", "Agdal", "أكدال", 34.0005, -6.8462, ["fal ould oumeir", "avenue de france"]),
      makePlace("rab-hassan", "Hassan", "Hassan", "حسان", 34.0209, -6.8352, ["mohammed v"]),
      makePlace("rab-souissi", "Souissi", "Souissi", "السويسي", 33.982, -6.842, ["chu ibn sina"]),
      makePlace("rab-hay-riad", "Hay Riad", "Hay Riad", "حي الرياض", 33.959, -6.872),
      makePlace("rab-ocean", "L'Ocean", "L'Océan", "المحيط", 34.018, -6.854),
      makePlace("rab-yacoub", "Yacoub El Mansour", "Yacoub El Mansour", "يعقوب المنصور", 33.992, -6.876),
      makePlace("rab-medina", "Rabat Medina", "Médina de Rabat", "المدينة العتيقة الرباط", 34.025, -6.839),
    ],
  }),
  buildCity({
    id: "sale",
    en: "Sale",
    fr: "Salé",
    ar: "سلا",
    regionCode: "MA-04",
    districtLabel: "Salé Tabriquet & Bettana",
    lat: 34.0531,
    lng: -6.7985,
    aliases: ["sale", "salé", "sala", "سلا الجديدة"],
    isMajorHub: true,
    places: [
      makePlace("sal-tabriquet", "Tabriquet", "Tabriquet", "تابريكت", 34.052, -6.807),
      makePlace("sal-bettana", "Bettana", "Bettana", "بطانة", 34.039, -6.809),
      makePlace("sal-jadida", "Sala Al Jadida", "Sala Al Jadida", "سلا الجديدة", 34.002, -6.742),
      makePlace("sal-salam", "Hay Salam", "Hay Salam", "حي السلام سلا", 34.041, -6.792),
    ],
  }),
  buildCity({
    id: "temara",
    en: "Temara",
    fr: "Témara",
    ar: "تمارة",
    regionCode: "MA-04",
    districtLabel: "Témara & Harhoura",
    lat: 33.9267,
    lng: -6.9122,
    aliases: ["temara", "témara", "harhoura", "skhirat", "تماره"],
    isMajorHub: true,
    places: [
      makePlace("tem-harhoura", "Harhoura", "Harhoura", "هرهورة", 33.938, -6.956),
      makePlace("tem-wifak", "Wifak", "Al Wifak", "الوفاق", 33.921, -6.927),
      makePlace("tem-massira", "Massira", "Massira Témara", "المسيرة تمارة", 33.914, -6.906),
      makePlace("tem-skhirat", "Skhirat", "Skhirat", "الصخيرات", 33.852, -7.031),
    ],
  }),
  buildCity({
    id: "kenitra",
    en: "Kenitra",
    fr: "Kénitra",
    ar: "القنيطرة",
    regionCode: "MA-04",
    districtLabel: "Kénitra Centre & Mehdia",
    lat: 34.261,
    lng: -6.5802,
    aliases: ["kenitra", "kénitra", "gharb", "قنيطرة"],
    isMajorHub: true,
    places: [
      makePlace("ken-ville-haute", "Ville Haute", "Ville Haute", "المدينة العليا", 34.2615, -6.582),
      makePlace("ken-mimosa", "Mimosa", "Mimosa", "ميموزة", 34.264, -6.594),
      makePlace("ken-mehdia", "Mehdia", "Mehdia", "المهدية", 34.259, -6.658),
      makePlace("ken-bir-rami", "Bir Rami", "Bir Rami", "بئر الرامي", 34.245, -6.605),
    ],
  }),
  buildCity({
    id: "khemisset",
    en: "Khemisset",
    fr: "Khémisset",
    ar: "الخميسات",
    regionCode: "MA-04",
    districtLabel: "Khémisset Centre",
    lat: 33.824,
    lng: -6.0663,
    aliases: ["khemisset", "khémisset", "zemmour"],
  }),
  buildCity({
    id: "tiflet",
    en: "Tiflet",
    fr: "Tiflet",
    ar: "تيفلت",
    regionCode: "MA-04",
    districtLabel: "Tiflet Centre",
    lat: 33.8947,
    lng: -6.3065,
  }),
  buildCity({
    id: "sidi-kacem",
    en: "Sidi Kacem",
    fr: "Sidi Kacem",
    ar: "سيدي قاسم",
    regionCode: "MA-04",
    districtLabel: "Sidi Kacem Centre",
    lat: 34.2214,
    lng: -5.7078,
  }),
  buildCity({
    id: "sidi-slimane",
    en: "Sidi Slimane",
    fr: "Sidi Slimane",
    ar: "سيدي سليمان",
    regionCode: "MA-04",
    districtLabel: "Sidi Slimane Centre",
    lat: 34.2648,
    lng: -5.926,
  }),

  // ── MA-07: Marrakech-Safi ──
  buildCity({
    id: "marrakech",
    en: "Marrakech",
    fr: "Marrakech",
    ar: "مراكش",
    regionCode: "MA-07",
    districtLabel: "Marrakech Guéliz & Médina",
    lat: 31.632,
    lng: -8.003,
    bbox: { minLng: -8.048, minLat: 31.602, maxLng: -7.958, maxLat: 31.662 },
    aliases: ["marrakesh", "kech", "gueliz", "مراكش الحمراء"],
    isMajorHub: true,
    places: [
      makePlace("rak-gueliz", "Gueliz", "Guéliz", "جيليز", 31.6335, -8.0124, ["zerktouni"]),
      makePlace("rak-hivernage", "Hivernage", "Hivernage", "إيفرناج", 31.622, -8.011),
      makePlace("rak-medina", "Marrakech Medina", "Médina Marrakech", "المدينة العتيقة مراكش", 31.6295, -7.989),
      makePlace("rak-semlalia", "Semlalia", "Semlalia", "السملالية", 31.647, -8.015),
      makePlace("rak-amerchich", "Amerchich", "Amerchich", "أمرشيش", 31.653, -8.005, ["chu mohammed vi"]),
      makePlace("rak-daoudiate", "Daoudiate", "Daoudiate", "الداوديات", 31.654, -7.997),
      makePlace("rak-targa", "Targa", "Targa", "تاركة", 31.649, -8.055),
      makePlace("rak-massira", "Massira", "Hay Al Massira", "حي المسيرة مراكش", 31.631, -8.048),
      makePlace("rak-mhamid", "M'Hamid", "M'Hamid", "المحاميد", 31.594, -8.036),
      makePlace("rak-palmeraie", "Palmeraie", "Palmeraie", "النخيل", 31.675, -7.958),
    ],
  }),
  buildCity({
    id: "safi",
    en: "Safi",
    fr: "Safi",
    ar: "آسفي",
    regionCode: "MA-07",
    districtLabel: "Safi Centre & Plateau",
    lat: 32.2994,
    lng: -9.2372,
    aliases: ["asfi", "اسفي", "آسفي"],
    isMajorHub: true,
    places: [
      makePlace("saf-plateau", "Plateau Safi", "Plateau Safi", "البلاطو آسفي", 32.301, -9.233),
      makePlace("saf-ville-nouvelle", "Ville Nouvelle Safi", "Ville Nouvelle", "المدينة الجديدة آسفي", 32.295, -9.239),
    ],
  }),
  buildCity({
    id: "essaouira",
    en: "Essaouira",
    fr: "Essaouira",
    ar: "الصويرة",
    regionCode: "MA-07",
    districtLabel: "Essaouira Bay & Médina",
    lat: 31.5085,
    lng: -9.7595,
    aliases: ["mogador", "الصويره"],
    isMajorHub: true,
    places: [
      makePlace("ess-medina", "Essaouira Medina", "Médina Essaouira", "المدينة العتيقة الصويرة", 31.513, -9.77),
      makePlace("ess-borj", "Borj", "Quartier Borj", "حي البرج", 31.505, -9.757),
    ],
  }),
  buildCity({
    id: "benguerir",
    en: "Benguerir",
    fr: "Benguérir",
    ar: "ابن جرير",
    regionCode: "MA-07",
    districtLabel: "Benguérir & Ville Verte",
    lat: 32.2359,
    lng: -7.9538,
    aliases: ["ben guerir", "benguerir", "rehamna", "um6p", "بن جرير"],
    places: [
      makePlace("bg-green-city", "Mohammed VI Green City", "Ville Verte Mohammed VI", "المدينة الخضراء محمد السادس", 32.219, -7.937),
    ],
  }),
  buildCity({
    id: "el-kelaa-des-sraghna",
    en: "El Kelaa des Sraghna",
    fr: "El Kelâa des Sraghna",
    ar: "قلعة السراغنة",
    regionCode: "MA-07",
    districtLabel: "El Kelâa des Sraghna",
    lat: 32.0523,
    lng: -7.4063,
    aliases: ["kelaa sraghna", "kelaat sraghna", "sraghna"],
  }),
  buildCity({
    id: "youssoufia",
    en: "Youssoufia",
    fr: "Youssoufia",
    ar: "اليوسفية",
    regionCode: "MA-07",
    districtLabel: "Youssoufia Centre",
    lat: 32.2463,
    lng: -8.5294,
  }),
  buildCity({
    id: "chichaoua",
    en: "Chichaoua",
    fr: "Chichaoua",
    ar: "شيشاوة",
    regionCode: "MA-07",
    districtLabel: "Chichaoua Centre",
    lat: 31.544,
    lng: -8.766,
  }),
  buildCity({
    id: "tahannaout",
    en: "Tahannaout",
    fr: "Tahannaout",
    ar: "تحناوت",
    regionCode: "MA-07",
    districtLabel: "Al Haouz & Tahannaout",
    lat: 31.3519,
    lng: -7.9499,
    aliases: ["al haouz", "haouz", "الحوز"],
  }),

  // ── MA-01: Tanger-Tétouan-Al Hoceïma ──
  buildCity({
    id: "tangier",
    en: "Tangier",
    fr: "Tanger",
    ar: "طنجة",
    regionCode: "MA-01",
    districtLabel: "Tangier Bay & Centre",
    lat: 35.77,
    lng: -5.813,
    bbox: { minLng: -5.858, minLat: 35.742, maxLng: -5.768, maxLat: 35.798 },
    aliases: ["tanger", "tangiers", "detroit", "طنجه"],
    isMajorHub: true,
    places: [
      makePlace("tng-centre", "Boulevard Pasteur", "Centre Ville & Pasteur", "وسط المدينة باستور", 35.7765, -5.812),
      makePlace("tng-malabata", "Malabata", "Malabata", "مالاباطا", 35.779, -5.777),
      makePlace("tng-iberia", "Iberia", "Iberia", "إيبيريا", 35.783, -5.822),
      makePlace("tng-marshan", "Marshan", "Marshan", "مرشان", 35.788, -5.821),
      makePlace("tng-boukhalef", "Boukhalef", "Boukhalef", "بوخالف", 35.736, -5.893),
      makePlace("tng-beni-makada", "Beni Makada", "Béni Makada", "بني مكادة", 35.748, -5.825),
    ],
  }),
  buildCity({
    id: "tetouan",
    en: "Tetouan",
    fr: "Tétouan",
    ar: "تطوان",
    regionCode: "MA-01",
    districtLabel: "Tétouan Ensanche & Wilaya",
    lat: 35.5785,
    lng: -5.3684,
    aliases: ["tetouan", "tétouan", "titwan", "تطوان"],
    isMajorHub: true,
    places: [
      makePlace("tet-ensanche", "Ensanche", "Ensanche Centre", "إنسانشي وسط المدينة", 35.573, -5.371),
      makePlace("tet-wilaya", "Wilaya", "Quartier Wilaya", "حي الولاية", 35.584, -5.349),
      makePlace("tet-medina", "Tetouan Medina", "Médina Tétouan", "المدينة العتيقة تطوان", 35.571, -5.367),
    ],
  }),
  buildCity({
    id: "martil",
    en: "Martil",
    fr: "Martil",
    ar: "مرتيل",
    regionCode: "MA-01",
    districtLabel: "Martil & Cabo Negro",
    lat: 35.6166,
    lng: -5.2752,
    aliases: ["cabo negro"],
  }),
  buildCity({
    id: "mdiq",
    en: "M'diq",
    fr: "M'diq",
    ar: "المضيق",
    regionCode: "MA-01",
    districtLabel: "M'diq Coast",
    lat: 35.6858,
    lng: -5.3253,
    aliases: ["mdiq", "rincon"],
  }),
  buildCity({
    id: "fnideq",
    en: "Fnideq",
    fr: "Fnideq",
    ar: "الفنيدق",
    regionCode: "MA-01",
    districtLabel: "Fnideq Coast",
    lat: 35.8491,
    lng: -5.3575,
    aliases: ["castillejos"],
  }),
  buildCity({
    id: "al-hoceima",
    en: "Al Hoceima",
    fr: "Al Hoceïma",
    ar: "الحسيمة",
    regionCode: "MA-01",
    districtLabel: "Al Hoceïma Bay & Rif",
    lat: 35.2517,
    lng: -3.9372,
    aliases: ["hoceima", "al hoceima", "al hoceïma", "rif", "imzouren", "الحسيمه"],
    isMajorHub: true,
    places: [
      makePlace("hoc-mirador", "Mirador", "Mirador", "ميرادور", 35.249, -3.941),
      makePlace("hoc-imzouren", "Imzouren", "Imzouren", "إمزورن", 35.146, -3.851),
    ],
  }),
  buildCity({
    id: "chefchaouen",
    en: "Chefchaouen",
    fr: "Chefchaouen",
    ar: "شفشاون",
    regionCode: "MA-01",
    districtLabel: "Chefchaouen Médina & Rif",
    lat: 35.1688,
    lng: -5.2636,
    aliases: ["chaouen", "xauen", "الشاون"],
    places: [
      makePlace("cha-ras-el-maa", "Ras El Maa", "Ras El Ma", "رأس الماء", 35.171, -5.257),
    ],
  }),
  buildCity({
    id: "larache",
    en: "Larache",
    fr: "Larache",
    ar: "العرائش",
    regionCode: "MA-01",
    districtLabel: "Larache Loukkos",
    lat: 35.1932,
    lng: -6.1557,
    aliases: ["el araich", "loukkos"],
  }),
  buildCity({
    id: "ksar-el-kebir",
    en: "Ksar El Kebir",
    fr: "Ksar El Kébir",
    ar: "القصر الكبير",
    regionCode: "MA-01",
    districtLabel: "Ksar El Kébir Centre",
    lat: 35.0004,
    lng: -5.9038,
    aliases: ["ksar el kebir", "ksar el kébir"],
  }),
  buildCity({
    id: "asilah",
    en: "Asilah",
    fr: "Asilah",
    ar: "أصيلة",
    regionCode: "MA-01",
    districtLabel: "Asilah Atlantic",
    lat: 35.4652,
    lng: -6.0348,
    aliases: ["azilah", "assilah", "اصيله"],
  }),
  buildCity({
    id: "ouezzane",
    en: "Ouezzane",
    fr: "Ouezzane",
    ar: "وزان",
    regionCode: "MA-01",
    districtLabel: "Ouezzane Centre",
    lat: 34.7975,
    lng: -5.5786,
    aliases: ["ouazzane"],
  }),

  // ── MA-03: Fès-Meknès ──
  buildCity({
    id: "fes",
    en: "Fes",
    fr: "Fès",
    ar: "فاس",
    regionCode: "MA-03",
    districtLabel: "Fès Ville Nouvelle",
    lat: 34.034,
    lng: -5.003,
    bbox: { minLng: -5.048, minLat: 34.006, maxLng: -4.958, maxLat: 34.062 },
    aliases: ["fes", "fez", "fès", "saiss", "فاس"],
    isMajorHub: true,
    places: [
      makePlace("fes-vn", "Ville Nouvelle", "Ville Nouvelle", "المدينة الجديدة فاس", 34.0365, -5.0025),
      makePlace("fes-atlas", "Atlas", "Quartier Atlas", "حي الأطلس", 34.027, -4.994),
      makePlace("fes-saiss", "Saiss", "Saïss", "سايس", 34.0098, -4.9965, ["chu hassan ii"]),
      makePlace("fes-narjiss", "Narjiss", "Narjiss", "النرجس", 34.017, -4.999),
      makePlace("fes-bali", "Fes El Bali", "Fès El Bali", "فاس البالي", 34.062, -4.978),
      makePlace("fes-zouagha", "Zouagha", "Zouagha", "زواغة", 34.028, -5.042),
    ],
  }),
  buildCity({
    id: "meknes",
    en: "Meknes",
    fr: "Meknès",
    ar: "مكناس",
    regionCode: "MA-03",
    districtLabel: "Meknès Hamria & Marjane",
    lat: 33.8935,
    lng: -5.5473,
    aliases: ["meknes", "meknès", "ismailia", "مكناس"],
    isMajorHub: true,
    places: [
      makePlace("mek-hamria", "Hamria", "Hamria", "حمرية", 33.895, -5.547),
      makePlace("mek-marjane", "Marjane", "Marjane Meknès", "مرجان مكناس", 33.869, -5.571),
      makePlace("mek-bellevue", "Belle Vue", "Belle Vue", "بيلفو", 33.889, -5.534),
      makePlace("mek-toulal", "Toulal", "Toulal", "تولال", 33.898, -5.595),
    ],
  }),
  buildCity({
    id: "ifrane",
    en: "Ifrane",
    fr: "Ifrane",
    ar: "إفران",
    regionCode: "MA-03",
    districtLabel: "Ifrane Middle Atlas",
    lat: 33.5228,
    lng: -5.111,
    aliases: ["al akhawayn", "افران"],
  }),
  buildCity({
    id: "azrou",
    en: "Azrou",
    fr: "Azrou",
    ar: "أزرو",
    regionCode: "MA-03",
    districtLabel: "Azrou Middle Atlas",
    lat: 33.4344,
    lng: -5.2213,
    aliases: ["ازرو"],
  }),
  buildCity({
    id: "sefrou",
    en: "Sefrou",
    fr: "Sefrou",
    ar: "صفرو",
    regionCode: "MA-03",
    districtLabel: "Sefrou Centre",
    lat: 33.8318,
    lng: -4.828,
  }),
  buildCity({
    id: "taza",
    en: "Taza",
    fr: "Taza",
    ar: "تازة",
    regionCode: "MA-03",
    districtLabel: "Taza Corridor",
    lat: 34.213,
    lng: -4.0103,
    aliases: ["تازه"],
    isMajorHub: true,
  }),
  buildCity({
    id: "taounate",
    en: "Taounate",
    fr: "Taounate",
    ar: "تاونات",
    regionCode: "MA-03",
    districtLabel: "Taounate Centre",
    lat: 34.5369,
    lng: -4.6401,
  }),
  buildCity({
    id: "el-hajeb",
    en: "El Hajeb",
    fr: "El Hajeb",
    ar: "الحاجب",
    regionCode: "MA-03",
    districtLabel: "El Hajeb Centre",
    lat: 33.6879,
    lng: -5.371,
  }),
  buildCity({
    id: "boulemane",
    en: "Boulemane",
    fr: "Boulemane",
    ar: "بولمان",
    regionCode: "MA-03",
    districtLabel: "Boulemane & Missour",
    lat: 33.3625,
    lng: -4.7303,
    aliases: ["missour", "ميسور"],
  }),

  // ── MA-02: Oriental ──
  buildCity({
    id: "oujda",
    en: "Oujda",
    fr: "Oujda",
    ar: "وجدة",
    regionCode: "MA-02",
    districtLabel: "Oujda Centre & CHU Mohammed VI",
    lat: 34.6814,
    lng: -1.9086,
    aliases: ["angad", "oriental", "وجده"],
    isMajorHub: true,
    places: [
      makePlace("ouj-centre", "Oujda Centre", "Boulevard Mohammed V Oujda", "وسط وجدة", 34.6814, -1.9086),
      makePlace("ouj-lazaret", "Lazaret", "Lazaret", "لازاري", 34.664, -1.894),
      makePlace("ouj-qods", "Hay Al Qods", "Hay Al Qods", "حي القدس وجدة", 34.655, -1.912),
    ],
  }),
  buildCity({
    id: "nador",
    en: "Nador",
    fr: "Nador",
    ar: "الناظور",
    regionCode: "MA-02",
    districtLabel: "Nador Lagoon & Centre",
    lat: 35.1681,
    lng: -2.9335,
    aliases: ["marchica", "selouane", "aroui", "ناظور"],
    isMajorHub: true,
    places: [
      makePlace("nad-centre", "Nador Centre", "Nador Centre", "وسط الناظور", 35.1681, -2.9335),
      makePlace("nad-selouane", "Selouane", "Selouane", "سلوان", 35.075, -2.942),
      makePlace("nad-aroui", "Al Aroui", "Al Aroui", "العروي", 35.012, -3.008),
      makePlace("nad-beni-ansar", "Beni Ansar", "Beni Ansar", "بني أنصار", 35.258, -2.934),
    ],
  }),
  buildCity({
    id: "berkane",
    en: "Berkane",
    fr: "Berkane",
    ar: "بركان",
    regionCode: "MA-02",
    districtLabel: "Berkane & Saïdia",
    lat: 34.92,
    lng: -2.32,
    aliases: ["saidia", "saïdia", "السعيدية"],
    places: [
      makePlace("ber-saidia", "Saidia", "Saïdia", "السعيدية", 35.083, -2.23),
    ],
  }),
  buildCity({
    id: "taourirt",
    en: "Taourirt",
    fr: "Taourirt",
    ar: "تاوريرت",
    regionCode: "MA-02",
    districtLabel: "Taourirt Centre",
    lat: 34.4073,
    lng: -2.8973,
  }),
  buildCity({
    id: "guercif",
    en: "Guercif",
    fr: "Guercif",
    ar: "جرسيف",
    regionCode: "MA-02",
    districtLabel: "Guercif Centre",
    lat: 34.2257,
    lng: -3.3536,
  }),
  buildCity({
    id: "jerada",
    en: "Jerada",
    fr: "Jerada",
    ar: "جرادة",
    regionCode: "MA-02",
    districtLabel: "Jerada Centre",
    lat: 34.3117,
    lng: -2.1636,
  }),
  buildCity({
    id: "driouch",
    en: "Driouch",
    fr: "Driouch",
    ar: "الدريوش",
    regionCode: "MA-02",
    districtLabel: "Driouch Centre",
    lat: 34.9767,
    lng: -3.3884,
  }),
  buildCity({
    id: "figuig",
    en: "Figuig",
    fr: "Figuig",
    ar: "فجيج",
    regionCode: "MA-02",
    districtLabel: "Figuig & Bouarfa",
    lat: 32.1089,
    lng: -1.2286,
    aliases: ["bouarfa", "بوعرفة"],
  }),

  // ── MA-09: Souss-Massa ──
  buildCity({
    id: "agadir",
    en: "Agadir",
    fr: "Agadir",
    ar: "أكادير",
    regionCode: "MA-09",
    districtLabel: "Agadir Centre & Bay",
    lat: 30.42,
    lng: -9.597,
    bbox: { minLng: -9.642, minLat: 30.392, maxLng: -9.552, maxLat: 30.448 },
    aliases: ["souss", "اكادير", "أغادير"],
    isMajorHub: true,
    places: [
      makePlace("aga-talborjt", "Talborjt", "Talborjt", "تالبرجت", 30.426, -9.599),
      makePlace("aga-founty", "Founty", "Founty", "فونتي", 30.404, -9.594),
      makePlace("aga-sonaba", "Sonaba", "Sonaba", "سونابا", 30.408, -9.589),
      makePlace("aga-salam", "Hay Salam", "Hay Salam Agadir", "حي السلام أكادير", 30.411, -9.559),
      makePlace("aga-dakhla", "Hay Dakhla", "Hay Dakhla", "حي الداخلة أكادير", 30.416, -9.566),
      makePlace("aga-anza", "Anza", "Anza", "أنزا", 30.451, -9.644),
      makePlace("aga-taghazout", "Taghazout", "Taghazout", "تغازوت", 30.545, -9.711),
    ],
  }),
  buildCity({
    id: "inezgane",
    en: "Inezgane",
    fr: "Inezgane",
    ar: "إنزكان",
    regionCode: "MA-09",
    districtLabel: "Inezgane & Aït Melloul",
    lat: 30.3554,
    lng: -9.5364,
    aliases: ["ait melloul", "aït melloul", "dcheira", "أيت ملول", "إنزكان"],
    places: [
      makePlace("inz-ait-melloul", "Ait Melloul", "Aït Melloul", "أيت ملول", 30.334, -9.497),
      makePlace("inz-dcheira", "Dcheira El Jihadia", "Dcheira El Jihadia", "الدشيرة الجهادية", 30.371, -9.541),
    ],
  }),
  buildCity({
    id: "taroudant",
    en: "Taroudant",
    fr: "Taroudant",
    ar: "تارودانت",
    regionCode: "MA-09",
    districtLabel: "Taroudant Souss Valley",
    lat: 30.4703,
    lng: -8.877,
    aliases: ["taroudannt", "oulad teima", "أولاد تايمة"],
    isMajorHub: true,
    places: [
      makePlace("tar-oulad-teima", "Oulad Teima", "Oulad Teïma", "أولاد تايمة", 30.395, -9.209),
    ],
  }),
  buildCity({
    id: "tiznit",
    en: "Tiznit",
    fr: "Tiznit",
    ar: "تيزنيت",
    regionCode: "MA-09",
    districtLabel: "Tiznit Centre",
    lat: 29.6974,
    lng: -9.7316,
    aliases: ["تزنيت"],
  }),
  buildCity({
    id: "biougra",
    en: "Biougra",
    fr: "Biougra",
    ar: "بيوكرى",
    regionCode: "MA-09",
    districtLabel: "Chtouka Aït Baha",
    lat: 30.2144,
    lng: -9.3708,
    aliases: ["chtouka", "شتوكة"],
  }),
  buildCity({
    id: "tata",
    en: "Tata",
    fr: "Tata",
    ar: "طاطا",
    regionCode: "MA-09",
    districtLabel: "Tata Oasis",
    lat: 29.7427,
    lng: -7.9725,
  }),

  // ── MA-05: Béni Mellal-Khénifra ──
  buildCity({
    id: "beni-mellal",
    en: "Beni Mellal",
    fr: "Béni Mellal",
    ar: "بني ملال",
    regionCode: "MA-05",
    districtLabel: "Béni Mellal Centre & Atlas",
    lat: 32.3373,
    lng: -6.3498,
    aliases: ["beni mellal", "béni mellal", "tadla"],
    isMajorHub: true,
    places: [
      makePlace("bm-centre", "Beni Mellal Centre", "Centre Béni Mellal", "وسط بني ملال", 32.3373, -6.3498),
      makePlace("bm-ain-asserdoun", "Ain Asserdoun", "Aïn Asserdoun", "عين أسردون", 32.326, -6.327),
    ],
  }),
  buildCity({
    id: "khouribga",
    en: "Khouribga",
    fr: "Khouribga",
    ar: "خريبكة",
    regionCode: "MA-05",
    districtLabel: "Khouribga Centre",
    lat: 32.8811,
    lng: -6.9063,
    aliases: ["خريبكه"],
    isMajorHub: true,
  }),
  buildCity({
    id: "khenifra",
    en: "Khenifra",
    fr: "Khénifra",
    ar: "خنيفرة",
    regionCode: "MA-05",
    districtLabel: "Khénifra Middle Atlas",
    lat: 32.934,
    lng: -5.6616,
    aliases: ["khenifra", "khénifra", "خنيفره"],
  }),
  buildCity({
    id: "fquih-ben-salah",
    en: "Fquih Ben Salah",
    fr: "Fquih Ben Salah",
    ar: "الفقيه بن صالح",
    regionCode: "MA-05",
    districtLabel: "Fquih Ben Salah",
    lat: 32.5021,
    lng: -6.6877,
    aliases: ["fkih ben salah"],
  }),
  buildCity({
    id: "oued-zem",
    en: "Oued Zem",
    fr: "Oued Zem",
    ar: "وادي زم",
    regionCode: "MA-05",
    districtLabel: "Oued Zem Centre",
    lat: 32.8627,
    lng: -6.5736,
  }),
  buildCity({
    id: "azilal",
    en: "Azilal",
    fr: "Azilal",
    ar: "أزيلال",
    regionCode: "MA-05",
    districtLabel: "Azilal High Atlas",
    lat: 31.9616,
    lng: -6.5711,
    aliases: ["ازيلال"],
  }),
  buildCity({
    id: "kasba-tadla",
    en: "Kasba Tadla",
    fr: "Kasba Tadla",
    ar: "قصبة تادلة",
    regionCode: "MA-05",
    districtLabel: "Kasba Tadla",
    lat: 32.5977,
    lng: -6.2685,
  }),

  // ── MA-08: Drâa-Tafilalet ──
  buildCity({
    id: "ouarzazate",
    en: "Ouarzazate",
    fr: "Ouarzazate",
    ar: "ورزازات",
    regionCode: "MA-08",
    districtLabel: "Ouarzazate Centre & Drâa",
    lat: 30.9335,
    lng: -6.937,
    aliases: ["warzazat", "tabounte"],
    isMajorHub: true,
    places: [
      makePlace("ouz-centre", "Ouarzazate Centre", "Boulevard Mohammed V Ouarzazate", "وسط ورزازات", 30.919, -6.912),
      makePlace("ouz-tabounte", "Tabounte", "Tabounte", "تابونت", 30.912, -6.885),
    ],
  }),
  buildCity({
    id: "errachidia",
    en: "Errachidia",
    fr: "Errachidia",
    ar: "الرشيدية",
    regionCode: "MA-08",
    districtLabel: "Errachidia Tafilalet",
    lat: 31.9314,
    lng: -4.4244,
    aliases: ["rachidia", "tafilalet", "الرشيديه"],
    isMajorHub: true,
  }),
  buildCity({
    id: "tinghir",
    en: "Tinghir",
    fr: "Tinghir",
    ar: "تنغير",
    regionCode: "MA-08",
    districtLabel: "Tinghir & Todra",
    lat: 31.5147,
    lng: -5.5328,
    aliases: ["tinerhir", "todra"],
  }),
  buildCity({
    id: "zagora",
    en: "Zagora",
    fr: "Zagora",
    ar: "زاكورة",
    regionCode: "MA-08",
    districtLabel: "Zagora Drâa Valley",
    lat: 30.3324,
    lng: -5.8384,
    aliases: ["زاكوره"],
  }),
  buildCity({
    id: "midelt",
    en: "Midelt",
    fr: "Midelt",
    ar: "ميدلت",
    regionCode: "MA-08",
    districtLabel: "Midelt High Plateau",
    lat: 32.6852,
    lng: -4.7451,
  }),
  buildCity({
    id: "erfoud",
    en: "Erfoud",
    fr: "Erfoud",
    ar: "أرفود",
    regionCode: "MA-08",
    districtLabel: "Erfoud & Merzouga",
    lat: 31.4314,
    lng: -4.2288,
    aliases: ["merzouga", "rissani", "مرزوكة", "الريصاني"],
  }),

  // ── MA-10: Guelmim-Oued Noun ──
  buildCity({
    id: "guelmim",
    en: "Guelmim",
    fr: "Guelmim",
    ar: "كلميم",
    regionCode: "MA-10",
    districtLabel: "Guelmim Oued Noun",
    lat: 28.987,
    lng: -10.0574,
    aliases: ["goulimine", "oued noun", "كليميم"],
    isMajorHub: true,
  }),
  buildCity({
    id: "tan-tan",
    en: "Tan-Tan",
    fr: "Tan-Tan",
    ar: "طانطان",
    regionCode: "MA-10",
    districtLabel: "Tan-Tan & El Ouatia",
    lat: 28.438,
    lng: -11.1032,
    aliases: ["tantan", "el ouatia", "الوطية"],
  }),
  buildCity({
    id: "sidi-ifni",
    en: "Sidi Ifni",
    fr: "Sidi Ifni",
    ar: "سيدي إفني",
    regionCode: "MA-10",
    districtLabel: "Sidi Ifni Coast",
    lat: 29.3797,
    lng: -10.1729,
    aliases: ["ifni", "سيدي افني"],
  }),
  buildCity({
    id: "assa",
    en: "Assa",
    fr: "Assa",
    ar: "آسا",
    regionCode: "MA-10",
    districtLabel: "Assa-Zag",
    lat: 28.6095,
    lng: -9.4293,
    aliases: ["assa-zag", "zag", "آسا الزاك"],
  }),

  // ── MA-11: Laâyoune-Sakia El Hamra ──
  buildCity({
    id: "laayoune",
    en: "Laayoune",
    fr: "Laâyoune",
    ar: "العيون",
    regionCode: "MA-11",
    districtLabel: "Laâyoune Centre & Al Wahda",
    lat: 27.1536,
    lng: -13.2033,
    aliases: ["laayoune", "laâyoune", "el aaiun", "sakia el hamra", "العيون"],
    isMajorHub: true,
    places: [
      makePlace("laa-centre", "Laayoune Centre", "Centre Ville Laâyoune", "وسط العيون", 27.1536, -13.2033),
      makePlace("laa-wahda", "Al Wahda", "Hay Al Wahda", "حي الوحدة العيون", 27.143, -13.189),
      makePlace("laa-foum-el-oued", "Foum El Oued", "Foum El Oued", "فم الواد", 27.177, -13.395),
      makePlace("laa-marsa", "El Marsa", "El Marsa", "المرسى العيون", 27.097, -13.413),
    ],
  }),
  buildCity({
    id: "boujdour",
    en: "Boujdour",
    fr: "Boujdour",
    ar: "بوجدور",
    regionCode: "MA-11",
    districtLabel: "Boujdour Atlantic",
    lat: 26.1258,
    lng: -14.4847,
  }),
  buildCity({
    id: "smara",
    en: "Smara",
    fr: "Es-Semara",
    ar: "السمارة",
    regionCode: "MA-11",
    districtLabel: "Es-Semara Centre",
    lat: 26.7384,
    lng: -11.6719,
    aliases: ["es-semara", "semara", "السماره"],
  }),
  buildCity({
    id: "tarfaya",
    en: "Tarfaya",
    fr: "Tarfaya",
    ar: "طرفاية",
    regionCode: "MA-11",
    districtLabel: "Tarfaya Coast",
    lat: 27.9392,
    lng: -12.926,
  }),

  // ── MA-12: Dakhla-Oued Ed-Dahab ──
  buildCity({
    id: "dakhla",
    en: "Dakhla",
    fr: "Dakhla",
    ar: "الداخلة",
    regionCode: "MA-12",
    districtLabel: "Dakhla Peninsula & Bay",
    lat: 23.6848,
    lng: -15.957,
    aliases: ["oued ed-dahab", "الداخله"],
    isMajorHub: true,
    places: [
      makePlace("dak-centre", "Dakhla Centre", "Centre Ville Dakhla", "وسط الداخلة", 23.708, -15.936),
      makePlace("dak-salam", "Hay Salam Dakhla", "Hay Salam", "حي السلام الداخلة", 23.694, -15.948),
      makePlace("dak-nahda", "Hay Nahda", "Hay Nahda", "حي النهضة الداخلة", 23.719, -15.932),
    ],
  }),
  buildCity({
    id: "bir-gandouz",
    en: "Bir Gandouz",
    fr: "Bir Gandouz",
    ar: "بئر كندوز",
    regionCode: "MA-12",
    districtLabel: "Aousserd & Bir Gandouz",
    lat: 21.6089,
    lng: -16.4631,
    aliases: ["aousserd", "guerguerat", "أوسرد"],
  }),
];

/**
 * Normalizes Latin accents/diacritics and Arabic letter variants (alef, teh marbuta, alef maqsura)
 * so queries like "Fes", "Fès", "Laayoune", "اكادير", "أكادير" match seamlessly.
 */
export function normalizeLocationText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/['’`-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

const CITY_BY_ID = new Map<string, MoroccanCityDefinition>(
  MOROCCAN_CITIES_CATALOG.map((city) => [city.id, city]),
);

const ALL_LOCATION_ENTRIES: readonly MoroccanLocationMatch[] =
  MOROCCAN_CITIES_CATALOG.flatMap((city) => {
    const cityEntry: MoroccanLocationMatch = {
      id: city.id,
      kind: "CITY",
      cityId: city.id,
      cityName: city.name,
      cityLabels: city.labels,
      name: city.name,
      labels: city.labels,
      regionCode: city.regionCode,
      region: city.region,
      districtLabel: city.districtLabel,
      lat: city.lat,
      lng: city.lng,
      bbox: city.bbox,
    };

    const placeEntries: MoroccanLocationMatch[] = city.places.map((place) => ({
      id: place.id,
      kind: "PLACE",
      cityId: city.id,
      cityName: city.name,
      cityLabels: city.labels,
      name: place.name,
      labels: place.labels,
      regionCode: city.regionCode,
      region: city.region,
      districtLabel: `${place.name}, ${city.name}`,
      lat: place.lat,
      lng: place.lng,
      bbox: {
        minLng: Number((place.lng - 0.022).toFixed(4)),
        minLat: Number((place.lat - 0.015).toFixed(4)),
        maxLng: Number((place.lng + 0.022).toFixed(4)),
        maxLat: Number((place.lat + 0.015).toFixed(4)),
      },
    }));

    return [cityEntry, ...placeEntries];
  });

export function findMoroccanCity(
  queryOrId: string | null | undefined,
): MoroccanCityDefinition | undefined {
  if (!queryOrId) return undefined;
  const direct = CITY_BY_ID.get(queryOrId.trim().toLowerCase());
  if (direct) return direct;

  const needle = normalizeLocationText(queryOrId);
  if (!needle) return undefined;

  // 1. Exact city name/id/alias match
  const exactCity = MOROCCAN_CITIES_CATALOG.find(
    (c) =>
      normalizeLocationText(c.id) === needle ||
      normalizeLocationText(c.name) === needle ||
      normalizeLocationText(c.labels.en) === needle ||
      normalizeLocationText(c.labels.fr) === needle ||
      normalizeLocationText(c.labels.ar) === needle ||
      c.aliases.some((alias) => normalizeLocationText(alias) === needle),
  );
  if (exactCity) return exactCity;

  // 2. Exact neighborhood/place match -> resolve to parent city
  const placeParent = MOROCCAN_CITIES_CATALOG.find((c) =>
    c.places.some(
      (p) =>
        normalizeLocationText(p.name) === needle ||
        normalizeLocationText(p.labels.en) === needle ||
        normalizeLocationText(p.labels.fr) === needle ||
        normalizeLocationText(p.labels.ar) === needle ||
        (p.aliases ?? []).some((a) => normalizeLocationText(a) === needle),
    ),
  );
  return placeParent;
}

export function getMoroccanCityAliasTerms(
  queryOrId: string | null | undefined,
): string[] {
  if (!queryOrId) return [];
  const needle = normalizeLocationText(queryOrId);
  if (!needle) return [];

  const city = findMoroccanCity(queryOrId);
  if (!city) return [needle];

  const terms = new Set<string>([
    needle,
    normalizeLocationText(city.name),
    normalizeLocationText(city.labels.en),
    normalizeLocationText(city.labels.fr),
    normalizeLocationText(city.labels.ar),
    city.name.toLowerCase(),
    city.labels.en.toLowerCase(),
    city.labels.fr.toLowerCase(),
    city.labels.ar.toLowerCase(),
  ]);
  for (const alias of city.aliases) {
    terms.add(normalizeLocationText(alias));
    terms.add(alias.trim().toLowerCase());
  }
  return Array.from(terms).filter((t) => t.length > 0);
}

export function expandMoroccanCityKeywords(
  city: string | null | undefined,
): string {
  const terms = getMoroccanCityAliasTerms(city);
  return terms.join(" ");
}

export function matchesMoroccanCity(
  selectedCity: string,
  primaryCity: string | null | undefined,
  fallbackFields: readonly (string | null | undefined)[] = [],
): boolean {
  const needle = normalizeLocationText(selectedCity);
  if (!needle) return true;

  const matchedCity = findMoroccanCity(selectedCity);
  const tokens = matchedCity
    ? Array.from(
        new Set([
          normalizeLocationText(matchedCity.name),
          normalizeLocationText(matchedCity.labels.en),
          normalizeLocationText(matchedCity.labels.fr),
          normalizeLocationText(matchedCity.labels.ar),
          ...matchedCity.aliases.map(normalizeLocationText),
        ]),
      )
    : [needle];

  const normalizedPrimary =
    typeof primaryCity === "string" ? normalizeLocationText(primaryCity) : "";
  if (normalizedPrimary.length > 0) {
    return tokens.some(
      (token) =>
        normalizedPrimary === token || normalizedPrimary.includes(token),
    );
  }

  const haystack = fallbackFields
    .filter((f): f is string => typeof f === "string" && f.length > 0)
    .map(normalizeLocationText)
    .join(" ");
  if (!haystack) return false;
  return tokens.some((token) => haystack.includes(token));
}

export function searchMoroccanLocations(
  rawQuery: string,
  limit = 16,
): MoroccanLocationMatch[] {
  const needle = normalizeLocationText(rawQuery);
  if (!needle) {
    return ALL_LOCATION_ENTRIES.filter((entry) => entry.kind === "CITY").slice(
      0,
      limit,
    );
  }

  const scored: Array<{ entry: MoroccanLocationMatch; score: number }> = [];
  for (const entry of ALL_LOCATION_ENTRIES) {
    const cityDef = CITY_BY_ID.get(entry.cityId);
    const placeDef =
      entry.kind === "PLACE"
        ? cityDef?.places.find((p) => p.id === entry.id)
        : undefined;

    const candidates = [
      entry.name,
      entry.labels.en,
      entry.labels.fr,
      entry.labels.ar,
      entry.region,
      ...(entry.kind === "CITY"
        ? (cityDef?.aliases ?? [])
        : [
            entry.cityName,
            entry.cityLabels.en,
            entry.cityLabels.ar,
            ...(placeDef?.aliases ?? []),
          ]),
    ].map(normalizeLocationText);

    let score = 0;
    for (const c of candidates) {
      if (!c) continue;
      if (c === needle) {
        score = Math.max(score, entry.kind === "CITY" ? 100 : 95);
      } else if (c.startsWith(needle)) {
        score = Math.max(score, entry.kind === "CITY" ? 80 : 72);
      } else if (c.includes(needle)) {
        score = Math.max(score, entry.kind === "CITY" ? 55 : 48);
      }
    }

    if (score > 0) {
      if (entry.kind === "CITY" && cityDef?.isMajorHub) {
        score += 5;
      }
      scored.push({ entry, score });
    }
  }

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (a.entry.kind !== b.entry.kind) return a.entry.kind === "CITY" ? -1 : 1;
    return a.entry.name.localeCompare(b.entry.name);
  });

  return scored.slice(0, limit).map((s) => s.entry);
}
