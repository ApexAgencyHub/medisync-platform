"use client";

import { useState, type FormEvent } from "react";
import {
  AlertTriangle,
  Check,
  Edit3,
  Package,
  Pause,
  Play,
  Plus,
  Search,
  X,
} from "lucide-react";
import {
  PharmacyProductCategorySchema,
  type LocaleCode,
  type PharmacyProductCategory,
  type PharmacyProductSummary,
  type UpdatePharmacyProductInput,
} from "@medisync/contracts";
import { useLocale } from "@/shared/i18n/locale-store";
import { ProductThumbnail } from "@/shared/ui/EntityAvatar";
import { UiBadge, UiButton, UiInput } from "@/shared/ui/primitives";
import {
  ClinicalStepper,
  MoroccanComplianceBadge,
} from "@/shared/ui/TactileControls";
import { PHARMA_COPY } from "../pharmacy-i18n";
import { formatMinorMoney } from "./pharmacy-utils";

interface QuickCatalogPreset {
  readonly label: string;
  readonly sku: string;
  readonly name: string;
  readonly generic: string;
  readonly dosageForm: string;
  readonly strength: string;
  readonly category: PharmacyProductCategory;
  readonly priceMajor: string;
  readonly stockQty: string;
  readonly requiresRx: boolean;
}

const QUICK_CATALOG_PRESETS: readonly QuickCatalogPreset[] = [
  {
    label: "Doliprane 1000mg",
    sku: "OTC-DOL-1000",
    name: "Doliprane 1000mg",
    generic: "Paracetamol",
    dosageForm: "Tablet",
    strength: "1000mg",
    category: "OTC_MEDICATION",
    priceMajor: "22.50",
    stockQty: "60",
    requiresRx: false,
  },
  {
    label: "Augmentin 1g",
    sku: "RX-AUG-1000",
    name: "Augmentin 1g",
    generic: "Amoxicillin / Clavulanate",
    dosageForm: "Sachet",
    strength: "1g / 125mg",
    category: "PRESCRIPTION_RX",
    priceMajor: "98.00",
    stockQty: "30",
    requiresRx: true,
  },
  {
    label: "Amlor 5mg",
    sku: "RX-AML-5MG",
    name: "Amlor 5mg",
    generic: "Amlodipine",
    dosageForm: "Capsule",
    strength: "5mg",
    category: "PRESCRIPTION_RX",
    priceMajor: "64.00",
    stockQty: "40",
    requiresRx: true,
  },
  {
    label: "Omeprazole 20mg",
    sku: "OTC-OME-20",
    name: "Omeprazole 20mg",
    generic: "Omeprazole",
    dosageForm: "Gastro-resistant Capsule",
    strength: "20mg",
    category: "OTC_MEDICATION",
    priceMajor: "42.00",
    stockQty: "45",
    requiresRx: false,
  },
  {
    label: "Ventoline Spray",
    sku: "RX-VEN-100",
    name: "Ventoline 100mcg",
    generic: "Salbutamol",
    dosageForm: "Inhaler",
    strength: "100mcg/dose",
    category: "PRESCRIPTION_RX",
    priceMajor: "49.50",
    stockQty: "25",
    requiresRx: true,
  },
  {
    label: "Serum Physiologique",
    sku: "PED-SER-30",
    name: "Serum Physiologique 0.9%",
    generic: "Sodium Chloride 0.9%",
    dosageForm: "Single-dose Vial x30",
    strength: "5mL",
    category: "PEDIATRIC_CARE",
    priceMajor: "28.00",
    stockQty: "80",
    requiresRx: false,
  },
];

const DESK_EXTRA_COPY: Record<
  LocaleCode,
  {
    statusAll: string;
    statusActive: string;
    statusPaused: string;
    pausedBadge: string;
    pauseSkuBtn: string;
    activateSkuBtn: string;
    productNameLabel: string;
    genericLabel: string;
    categoryLabel: string;
    dosageLabel: string;
    strengthLabel: string;
    rxLabel: string;
  }
> = {
  en: {
    statusAll: "All SKUs",
    statusActive: "Active",
    statusPaused: "Paused",
    pausedBadge: "Paused",
    pauseSkuBtn: "Pause",
    activateSkuBtn: "Activate",
    productNameLabel: "Product Name",
    genericLabel: "Generic Name",
    categoryLabel: "Category",
    dosageLabel: "Dosage Form",
    strengthLabel: "Strength",
    rxLabel: "Requires Prescription (Rx)",
  },
  fr: {
    statusAll: "Tous",
    statusActive: "Actifs",
    statusPaused: "En pause",
    pausedBadge: "En pause",
    pauseSkuBtn: "Pause",
    activateSkuBtn: "Activer",
    productNameLabel: "Nom du produit",
    genericLabel: "DCI / Générique",
    categoryLabel: "Catégorie",
    dosageLabel: "Forme galénique",
    strengthLabel: "Dosage",
    rxLabel: "Ordonnance requise (Rx)",
  },
  ar: {
    statusAll: "الكل",
    statusActive: "نشط",
    statusPaused: "متوقف",
    pausedBadge: "متوقف مؤقتاً",
    pauseSkuBtn: "إيقاف",
    activateSkuBtn: "تفعيل",
    productNameLabel: "اسم المنتج",
    genericLabel: "الاسم العلمي",
    categoryLabel: "الفئة",
    dosageLabel: "الشكل الصيدلاني",
    strengthLabel: "التركيز",
    rxLabel: "يتطلب وصفة طبية",
  },
};

interface PharmacistInventoryDeskProps {
  effectiveCountry: string;
  currencyCode: string;
  products: readonly PharmacyProductSummary[];
  busy: boolean;
  newSku: string;
  newName: string;
  newGeneric: string;
  newDosageForm: string;
  newStrength: string;
  newCategory: PharmacyProductCategory;
  newPriceMajor: string;
  newStockQty: string;
  newRequiresRx: boolean;
  onNewSkuChange: (v: string) => void;
  onNewNameChange: (v: string) => void;
  onNewGenericChange: (v: string) => void;
  onNewDosageFormChange: (v: string) => void;
  onNewStrengthChange: (v: string) => void;
  onNewCategoryChange: (v: PharmacyProductCategory) => void;
  onNewPriceMajorChange: (v: string) => void;
  onNewStockQtyChange: (v: string) => void;
  onNewRequiresRxChange: (v: boolean) => void;
  onAddCatalogProduct: (e: FormEvent) => Promise<boolean> | boolean | void;
  onRestock: (product: PharmacyProductSummary, delta: number) => void;
  onUpdateProductPricingStock: (
    product: PharmacyProductSummary,
    patch: UpdatePharmacyProductInput,
  ) => void;
}

/** Clinical Pharmacist Inventory CRUD: real dosage forms, low-stock alerts & inline pricing/stock editor. */
export function PharmacistInventoryDesk({
  effectiveCountry,
  currencyCode,
  products,
  busy,
  newSku,
  newName,
  newGeneric,
  newDosageForm,
  newStrength,
  newCategory,
  newPriceMajor,
  newStockQty,
  newRequiresRx,
  onNewSkuChange,
  onNewNameChange,
  onNewGenericChange,
  onNewDosageFormChange,
  onNewStrengthChange,
  onNewCategoryChange,
  onNewPriceMajorChange,
  onNewStockQtyChange,
  onNewRequiresRxChange,
  onAddCatalogProduct,
  onRestock,
  onUpdateProductPricingStock,
}: PharmacistInventoryDeskProps) {
  const { locale } = useLocale();
  const copy = PHARMA_COPY[locale];
  const ec = DESK_EXTRA_COPY[locale];
  const [invSearch, setInvSearch] = useState("");
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState<"ALL" | "ACTIVE" | "PAUSED">(
    "ALL",
  );
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editGeneric, setEditGeneric] = useState("");
  const [editCategory, setEditCategory] =
    useState<PharmacyProductCategory>("OTC_MEDICATION");
  const [editDosageForm, setEditDosageForm] = useState("");
  const [editStrength, setEditStrength] = useState("");
  const [editRequiresRx, setEditRequiresRx] = useState(false);
  const [editStock, setEditStock] = useState("");
  const [editPrice, setEditPrice] = useState("");

  const lowStockCount = products.filter(
    (p) => p.stockQty > 0 && p.stockQty <= 10,
  ).length;
  const outOfStockCount = products.filter((p) => p.stockQty === 0).length;
  const rxCount = products.filter((p) => p.requiresPrescription).length;

  const filteredProducts = products.filter((prod) => {
    if (activeFilter === "ACTIVE" && !prod.isActive) return false;
    if (activeFilter === "PAUSED" && prod.isActive) return false;
    if (lowStockOnly && prod.stockQty > 10) return false;
    if (invSearch.trim()) {
      const q = invSearch.trim().toLowerCase();
      const hay = `${prod.name} ${prod.sku} ${prod.genericName ?? ""} ${prod.facilityName}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  function startEditing(prod: PharmacyProductSummary) {
    setEditingId(prod.id);
    setEditName(prod.name);
    setEditGeneric(prod.genericName ?? "");
    setEditCategory(prod.category);
    setEditDosageForm(prod.dosageForm ?? "");
    setEditStrength(prod.strength ?? "");
    setEditRequiresRx(prod.requiresPrescription);
    setEditStock(String(prod.stockQty));
    setEditPrice((prod.priceMinor / 100).toFixed(2));
  }

  return (
    <div className="space-y-4">
      {/* KPI Stock Health Strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-2xl border border-[#D7E4F2] bg-white px-4 py-3.5 shadow-[0_6px_22px_-12px_rgba(15,36,62,0.06)]">
          <p className="text-[11px] font-semibold text-[#556E89] uppercase">
            {copy.kpiActiveSkus}
          </p>
          <p className="mt-1 font-mono-tabular text-xl font-bold text-[#0F243E]">
            {products.length}
          </p>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50/90 px-4 py-3.5">
          <p className="text-[11px] font-semibold text-amber-900 uppercase">
            {copy.kpiLowStock}
          </p>
          <p className="mt-1 font-mono-tabular text-xl font-bold text-amber-950">
            {lowStockCount}
          </p>
        </div>
        <div className="rounded-2xl border border-rose-200 bg-rose-50/90 px-4 py-3.5">
          <p className="text-[11px] font-semibold text-rose-900 uppercase">
            {copy.kpiOutOfStock}
          </p>
          <p className="mt-1 font-mono-tabular text-xl font-bold text-rose-950">
            {outOfStockCount}
          </p>
        </div>
        <div className="rounded-2xl border border-[#B2E5DC] bg-[#E6F7F4]/80 px-4 py-3.5">
          <p className="text-[11px] font-semibold text-[#0A6E5E] uppercase">
            {copy.kpiRxControlled}
          </p>
          <p className="mt-1 font-mono-tabular text-xl font-bold text-[#0F243E]">
            {rxCount}
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {composerOpen ? (
        <form
          onSubmit={async (e) => {
            const ok = await onAddCatalogProduct(e);
            if (ok !== false) setComposerOpen(false);
          }}
          className="space-y-3 rounded-2xl border border-[#BFDBFE] bg-[#F8FBFE] p-5 shadow-[0_6px_22px_-12px_rgba(15,36,62,0.08)]"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-editorial text-base font-bold text-[#0F243E]">
                {copy.addMedHeading} ({effectiveCountry})
              </h2>
              <MoroccanComplianceBadge domain="pharmacy" locale={locale} />
            </div>
            <button
              type="button"
              onClick={() => setComposerOpen(false)}
              aria-label={
                locale === "fr"
                  ? "Fermer le formulaire produit"
                  : locale === "ar"
                    ? "إغلاق نموذج إضافة الدواء"
                    : "Close composer"
              }
              className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-[#D7E4F2] bg-white text-[#4A627D] hover:text-[#0F243E]"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          {/* 1-Tap Quick-Fill Presets */}
          <div className="flex flex-wrap gap-1.5">
            {QUICK_CATALOG_PRESETS.map((preset) => (
              <button
                key={preset.sku}
                type="button"
                onClick={() => {
                  onNewSkuChange(preset.sku);
                  onNewNameChange(preset.name);
                  onNewGenericChange(preset.generic);
                  onNewDosageFormChange(preset.dosageForm);
                  onNewStrengthChange(preset.strength);
                  onNewCategoryChange(preset.category);
                  onNewPriceMajorChange(preset.priceMajor);
                  onNewStockQtyChange(preset.stockQty);
                  onNewRequiresRxChange(preset.requiresRx);
                }}
                className="rounded-full border border-[#BFDBFE] bg-[#EBF4FF] px-2.5 py-1 text-[11px] font-semibold text-[#0052A3] transition hover:bg-[#0066CC] hover:text-white"
              >
                + {preset.label}
              </button>
            ))}
          </div>

          {/* Visual Category Pill Selector */}
          <div
            role="radiogroup"
            aria-label={ec.categoryLabel}
            className="flex flex-wrap gap-1.5"
          >
            {PharmacyProductCategorySchema.options.map((cat) => {
              const active = newCategory === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => onNewCategoryChange(cat)}
                  className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold transition ${
                    active
                      ? "border-[#0052A3] bg-[#0066CC] text-white"
                      : "border-[#CBDDF0] bg-white text-[#4A627D] hover:border-[#0066CC]"
                  }`}
                >
                  {copy.categories[cat]}
                </button>
              );
            })}
          </div>

          {/* Dosage Form Quick Chips */}
          <div className="flex flex-wrap gap-1.5">
            {(
              [
                { value: "Tablet", labels: { en: "Tablet", fr: "Comprimé", ar: "قرص" } },
                { value: "Capsule", labels: { en: "Capsule", fr: "Gélule", ar: "كبسولة" } },
                { value: "Sachet", labels: { en: "Sachet", fr: "Sachet", ar: "كيس" } },
                { value: "Syrup", labels: { en: "Syrup", fr: "Sirop", ar: "شراب" } },
                { value: "Inhaler", labels: { en: "Inhaler", fr: "Spray / Inhalateur", ar: "بخاخ" } },
                { value: "Drops", labels: { en: "Drops", fr: "Gouttes", ar: "قطرات" } },
              ] as const
            ).map((form) => (
              <button
                key={form.value}
                type="button"
                onClick={() => onNewDosageFormChange(form.labels[locale])}
                className={`rounded-lg border px-2 py-0.5 text-[10.5px] font-semibold transition ${
                  newDosageForm.toLowerCase() === form.value.toLowerCase() ||
                  newDosageForm.toLowerCase() === form.labels[locale].toLowerCase()
                    ? "border-[#0F9D88] bg-[#E6F7F4] text-[#0B6B5C]"
                    : "border-[#D7E4F2] bg-white text-[#556E89] hover:border-[#0066CC]"
                }`}
              >
                {form.labels[locale]}
              </button>
            ))}
          </div>

          <div className="grid gap-2.5 sm:grid-cols-3">
            <UiInput
              type="text"
              required
              placeholder={copy.skuPlaceholder}
              value={newSku}
              onChange={(e) => onNewSkuChange(e.target.value)}
              className="font-mono-tabular text-xs"
            />
            <UiInput
              type="text"
              required
              placeholder={copy.medNamePlaceholder}
              value={newName}
              onChange={(e) => onNewNameChange(e.target.value)}
              className="text-xs"
            />
            <UiInput
              type="text"
              placeholder={copy.genericPlaceholder}
              value={newGeneric}
              onChange={(e) => onNewGenericChange(e.target.value)}
              className="text-xs"
            />
          </div>
          <div className="grid gap-2.5 sm:grid-cols-2">
            <UiInput
              type="text"
              required
              placeholder={copy.dosageFormPlaceholder}
              value={newDosageForm}
              onChange={(e) => onNewDosageFormChange(e.target.value)}
              className="text-xs"
            />
            <UiInput
              type="text"
              required
              placeholder={copy.strengthPlaceholder}
              value={newStrength}
              onChange={(e) => onNewStrengthChange(e.target.value)}
              className="text-xs"
            />
          </div>
          <div className="grid gap-2.5 sm:grid-cols-2">
            <ClinicalStepper
              label={`PPV (${currencyCode})`}
              value={newPriceMajor}
              onChange={onNewPriceMajorChange}
              step={5}
              min={1}
              max={10000}
              decimals={2}
              unit={currencyCode}
              placeholder="25.00"
              presets={[
                { label: "15", value: "15.00" },
                { label: "35", value: "35.00" },
                { label: "60", value: "60.00" },
                { label: "120", value: "120.00" },
              ]}
            />
            <ClinicalStepper
              label={copy.initialStockPlaceholder}
              value={newStockQty}
              onChange={onNewStockQtyChange}
              step={5}
              min={0}
              max={10000}
              placeholder="20"
              presets={[
                { label: "10", value: "10" },
                { label: "25", value: "25" },
                { label: "50", value: "50" },
                { label: "100", value: "100" },
              ]}
            />
          </div>

          {/* Segmented OTC vs Rx Toggle + Submit */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="grid w-full grid-cols-2 gap-1.5 rounded-xl border border-[#CBDDF0] bg-white p-1 sm:w-72">
              <button
                type="button"
                onClick={() => onNewRequiresRxChange(false)}
                className={`min-h-[34px] rounded-lg text-xs font-bold transition ${
                  !newRequiresRx
                    ? "bg-[#E6F7F4] text-[#0B6B5C] ring-1 ring-[#B2E5DC]"
                    : "text-[#556E89] hover:text-[#0F243E]"
                }`}
              >
                {copy.otcShortBadge}
              </button>
              <button
                type="button"
                onClick={() => onNewRequiresRxChange(true)}
                className={`min-h-[34px] rounded-lg text-xs font-bold transition ${
                  newRequiresRx
                    ? "bg-[#0066CC] text-white shadow-2xs"
                    : "text-[#556E89] hover:text-[#0F243E]"
                }`}
              >
                {copy.rxRequiredBadge}
              </button>
            </div>

            <UiButton type="submit" disabled={busy}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              <span>{copy.addCatalogBtn}</span>
            </UiButton>
          </div>
        </form>
        ) : null}

        <section className="space-y-3 rounded-2xl border border-[#D7E4F2] bg-white p-5 shadow-[0_6px_22px_-12px_rgba(15,36,62,0.08)]">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-editorial text-base font-bold text-[#0F243E]">
                {copy.liveInventoryHeading}
              </h2>
              <MoroccanComplianceBadge domain="pharmacy" locale={locale} />
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <UiButton
                type="button"
                size="sm"
                variant={composerOpen ? "secondary" : "primary"}
                onClick={() => setComposerOpen((prev) => !prev)}
              >
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{copy.addMedHeading}</span>
              </UiButton>
              {(
                [
                  { id: "ALL", label: ec.statusAll },
                  { id: "ACTIVE", label: ec.statusActive },
                  { id: "PAUSED", label: ec.statusPaused },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setActiveFilter(opt.id)}
                  className={`h-8 rounded-full border px-3 text-xs font-semibold transition ${
                    activeFilter === opt.id
                      ? "border-[#0052A3] bg-[#0066CC] text-white"
                      : "border-[#CBDDF0] bg-[#F8FBFE] text-[#4A627D] hover:bg-white"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setLowStockOnly((v) => !v)}
                className={`inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition ${
                  lowStockOnly
                    ? "border-amber-400 bg-amber-100 text-amber-950"
                    : "border-[#CBDDF0] bg-[#F8FBFE] text-[#4A627D] hover:bg-white"
                }`}
              >
                <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{copy.lowOutOnlyBtn}</span>
              </button>
            </div>
          </div>

          <div className="flex h-10 items-center gap-2 rounded-xl border border-[#CBDDF0] bg-[#F8FBFE] px-3.5 focus-within:border-[#0066CC] focus-within:bg-white">
            <Search className="h-3.5 w-3.5 text-[#556E89]" aria-hidden="true" />
            <input
              type="search"
              value={invSearch}
              onChange={(e) => setInvSearch(e.target.value)}
              placeholder={copy.filterInventoryPlaceholder}
              className="min-w-0 flex-1 bg-transparent text-xs text-[#0F243E] placeholder:text-[#7D95B0] focus:outline-none"
            />
          </div>

          <div className="max-h-[480px] space-y-2.5 overflow-y-auto pe-1 [scrollbar-width:thin]">
            {filteredProducts.length === 0 ? (
              <p className="rounded-xl border border-[#D7E4F2] bg-[#F8FBFE] p-6 text-center text-xs text-slate-500">
                {copy.emptyInventory}
              </p>
            ) : (
              filteredProducts.map((prod) => {
                const isEditing = editingId === prod.id;
                const stockTone =
                  prod.stockQty === 0
                    ? "red"
                    : prod.stockQty <= 10
                      ? "amber"
                      : "emerald";
                const stockPct = Math.min(
                  100,
                  Math.max(0, Math.round((prod.stockQty / 50) * 100)),
                );
                const stockBarColor =
                  prod.stockQty === 0
                    ? "bg-rose-500"
                    : prod.stockQty <= 10
                      ? "bg-amber-500"
                      : "bg-[#0F9D88]";

                return (
                  <div
                    key={prod.id}
                    className="space-y-2.5 rounded-xl border border-[#D7E4F2] bg-[#F8FBFE] px-3.5 py-3 text-xs transition hover:border-[#93C5FD]"
                  >
                    <div className="flex items-start gap-3">
                      <ProductThumbnail
                        name={prod.name}
                        category={prod.category}
                        subtitle={prod.facilityName}
                        imageUrl={prod.imageUrl}
                        fit="cover"
                        className="h-12 w-12 shrink-0 rounded-xl"
                      />
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex flex-wrap items-center justify-between gap-1.5">
                          <p className="font-bold text-[#0F243E]">
                            <bdi dir="auto">{prod.name}</bdi>
                          </p>
                          <div className="flex flex-wrap items-center gap-1.5">
                            {!prod.isActive ? (
                              <UiBadge tone="amber">{ec.pausedBadge}</UiBadge>
                            ) : null}
                            <UiBadge tone={stockTone}>
                              <Package className="me-1 inline h-3 w-3" />
                              {prod.stockQty} {copy.leftWord}
                            </UiBadge>
                          </div>
                        </div>
                        <p className="font-mono-tabular text-[11px] text-[#556E89]">
                          {prod.sku} ·{" "}
                          <strong className="text-[#0F243E]">
                            {formatMinorMoney(prod.priceMinor, prod.currencyCode)}
                          </strong>{" "}
                          · {prod.facilityName}
                        </p>
                        {/* Visual Stock Health Bar */}
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#DCE8F5]">
                          <div
                            className={`h-full rounded-full transition-all ${stockBarColor}`}
                            style={{ width: `${Math.max(stockPct, prod.stockQty > 0 ? 6 : 0)}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#E6EFF8] pt-2">
                      <div className="flex flex-wrap items-center gap-1">
                        <UiButton
                          variant="secondary"
                          size="sm"
                          disabled={busy || prod.stockQty === 0}
                          onClick={() => onRestock(prod, -1)}
                          className="rounded-full px-2.5"
                        >
                          -1
                        </UiButton>
                        <UiButton
                          variant="secondary"
                          size="sm"
                          disabled={busy}
                          onClick={() => onRestock(prod, 5)}
                          className="rounded-full px-2.5 text-[#0F9D88]"
                        >
                          +5
                        </UiButton>
                        <UiButton
                          variant="secondary"
                          size="sm"
                          disabled={busy}
                          onClick={() => onRestock(prod, 10)}
                          className="rounded-full px-2.5 text-[#0066CC]"
                        >
                          {copy.unitsPlus10}
                        </UiButton>
                        <UiButton
                          variant="secondary"
                          size="sm"
                          disabled={busy}
                          onClick={() => onRestock(prod, 25)}
                          className="rounded-full px-2.5 text-[#0052A3]"
                        >
                          +25
                        </UiButton>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            onUpdateProductPricingStock(prod, {
                              isActive: !prod.isActive,
                            })
                          }
                          className="inline-flex h-8 items-center gap-1 rounded-xl border border-[#D7E4F2] bg-white px-2.5 text-[11px] font-semibold text-slate-700 hover:bg-amber-50 hover:text-amber-800"
                        >
                          {prod.isActive ? (
                            <>
                              <Pause className="h-3 w-3" aria-hidden="true" />
                              <span>{ec.pauseSkuBtn}</span>
                            </>
                          ) : (
                            <>
                              <Play className="h-3 w-3" aria-hidden="true" />
                              <span>{ec.activateSkuBtn}</span>
                            </>
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            isEditing ? setEditingId(null) : startEditing(prod)
                          }
                          aria-label={`${copy.editStockPriceAria} ${prod.name}`}
                          className={`inline-flex h-8 w-8 items-center justify-center rounded-xl border transition ${
                            isEditing
                              ? "border-[#0066CC] bg-[#EBF4FF] text-[#0066CC]"
                              : "border-[#D7E4F2] bg-white text-slate-600 hover:border-[#0066CC] hover:text-[#0066CC]"
                          }`}
                        >
                          <Edit3 className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                      </div>
                    </div>

                    {isEditing ? (
                      <div className="space-y-3 rounded-xl border border-[#BFDBFE] bg-white p-3.5">
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                          <div>
                            <label className="block text-[10px] font-semibold text-[#556E89] uppercase">
                              {ec.productNameLabel}
                            </label>
                            <input
                              type="text"
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                              className="mt-0.5 h-8 w-full rounded-lg border border-[#CBDDF0] bg-white px-2.5 text-xs"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-semibold text-[#556E89] uppercase">
                              {ec.genericLabel}
                            </label>
                            <input
                              type="text"
                              value={editGeneric}
                              onChange={(e) => setEditGeneric(e.target.value)}
                              className="mt-0.5 h-8 w-full rounded-lg border border-[#CBDDF0] bg-white px-2.5 text-xs"
                            />
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-1">
                          {PharmacyProductCategorySchema.options.map((cat) => (
                            <button
                              key={cat}
                              type="button"
                              onClick={() => setEditCategory(cat)}
                              className={`rounded-full border px-2 py-0.5 text-[10.5px] font-semibold transition ${
                                editCategory === cat
                                  ? "border-[#0052A3] bg-[#0066CC] text-white"
                                  : "border-[#CBDDF0] bg-[#F8FBFE] text-[#4A627D]"
                              }`}
                            >
                              {copy.categories[cat]}
                            </button>
                          ))}
                        </div>

                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                          <div>
                            <label className="block text-[10px] font-semibold text-[#556E89] uppercase">
                              {ec.dosageLabel}
                            </label>
                            <input
                              type="text"
                              value={editDosageForm}
                              onChange={(e) =>
                                setEditDosageForm(e.target.value)
                              }
                              className="mt-0.5 h-8 w-full rounded-lg border border-[#CBDDF0] bg-white px-2.5 text-xs"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-semibold text-[#556E89] uppercase">
                              {ec.strengthLabel}
                            </label>
                            <input
                              type="text"
                              value={editStrength}
                              onChange={(e) => setEditStrength(e.target.value)}
                              className="mt-0.5 h-8 w-full rounded-lg border border-[#CBDDF0] bg-white px-2.5 text-xs"
                            />
                          </div>
                        </div>

                        {(() => {
                          const rawStock = editStock.trim().replace(",", ".");
                          const rawPrice = editPrice.trim().replace(",", ".");
                          const parsedStock =
                            rawStock === "" ? Number.NaN : Number(rawStock);
                          const parsedPriceMinor =
                            rawPrice === ""
                              ? Number.NaN
                              : Math.round(Number(rawPrice) * 100);
                          const nameValid = editName.trim().length >= 2;
                          const stockValid =
                            Number.isFinite(parsedStock) &&
                            Number.isInteger(parsedStock) &&
                            parsedStock >= 0;
                          const priceValid =
                            Number.isFinite(parsedPriceMinor) &&
                            parsedPriceMinor >= 10;
                          const inlineValid =
                            nameValid && stockValid && priceValid;
                          const inlineError = !nameValid
                            ? locale === "fr"
                              ? "Le nom du produit doit contenir au moins 2 caractères."
                              : locale === "ar"
                                ? "يجب أن يحتوي اسم المنتج على حرفين على الأقل."
                                : "Product name must be at least 2 characters."
                            : !stockValid
                              ? locale === "fr"
                                ? "Saisissez un stock entier positif ou nul (≥ 0)."
                                : locale === "ar"
                                  ? "أدخل كمية مخزون صحيحة (0 أو أكثر)."
                                  : "Enter a valid whole-number stock quantity (≥ 0)."
                              : !priceValid
                                ? locale === "fr"
                                  ? `Le prix PPV doit être au moins 0.10 ${prod.currencyCode}.`
                                  : locale === "ar"
                                    ? `يجب أن لا يقل سعر PPV عن 0.10 ${prod.currencyCode}.`
                                    : `PPV price must be at least 0.10 ${prod.currencyCode}.`
                                : null;

                          return (
                            <>
                              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                                <ClinicalStepper
                                  id={`edit-stock-${prod.id}`}
                                  label={copy.exactStockLabel}
                                  value={editStock}
                                  onChange={setEditStock}
                                  step={5}
                                  min={0}
                                  max={10000}
                                  tone={stockValid ? "default" : "alert"}
                                  presets={[
                                    { label: "0", value: "0" },
                                    { label: "10", value: "10" },
                                    { label: "25", value: "25" },
                                    { label: "50", value: "50" },
                                  ]}
                                />
                                <ClinicalStepper
                                  id={`edit-price-${prod.id}`}
                                  label={`PPV (${prod.currencyCode})`}
                                  value={editPrice}
                                  onChange={setEditPrice}
                                  step={5}
                                  min={0.1}
                                  max={10000}
                                  decimals={2}
                                  unit={prod.currencyCode}
                                  tone={priceValid ? "default" : "alert"}
                                  presets={[
                                    { label: "15", value: "15.00" },
                                    { label: "35", value: "35.00" },
                                    { label: "60", value: "60.00" },
                                    { label: "120", value: "120.00" },
                                  ]}
                                />
                              </div>

                              {inlineError ? (
                                <p
                                  role="alert"
                                  className="rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-[11px] font-semibold text-rose-800"
                                >
                                  {inlineError}
                                </p>
                              ) : null}

                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="grid w-full grid-cols-2 gap-1 rounded-xl border border-[#CBDDF0] bg-[#F8FBFE] p-1 sm:w-64">
                                  <button
                                    type="button"
                                    onClick={() => setEditRequiresRx(false)}
                                    className={`min-h-[30px] rounded-lg text-[11px] font-bold transition ${
                                      !editRequiresRx
                                        ? "bg-[#E6F7F4] text-[#0B6B5C] ring-1 ring-[#B2E5DC]"
                                        : "text-[#556E89] hover:text-[#0F243E]"
                                    }`}
                                  >
                                    {copy.otcShortBadge}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setEditRequiresRx(true)}
                                    className={`min-h-[30px] rounded-lg text-[11px] font-bold transition ${
                                      editRequiresRx
                                        ? "bg-[#0066CC] text-white shadow-2xs"
                                        : "text-[#556E89] hover:text-[#0F243E]"
                                    }`}
                                  >
                                    {copy.rxRequiredBadge}
                                  </button>
                                </div>
                                <button
                                  type="button"
                                  disabled={busy || !inlineValid}
                                  onClick={() => {
                                    if (!inlineValid) return;
                                    onUpdateProductPricingStock(prod, {
                                      name: editName.trim(),
                                      genericName:
                                        editGeneric.trim() || undefined,
                                      category: editCategory,
                                      dosageForm:
                                        editDosageForm.trim() || undefined,
                                      strength: editStrength.trim() || undefined,
                                      requiresPrescription: editRequiresRx,
                                      stockQty: Math.round(parsedStock),
                                      priceMinor: parsedPriceMinor,
                                    });
                                    setEditingId(null);
                                  }}
                                  className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-[#0066CC] px-4 text-xs font-semibold text-white transition hover:bg-[#0052A3] disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  <Check
                                    className="h-3.5 w-3.5"
                                    aria-hidden="true"
                                  />
                                  <span>{copy.saveBtn}</span>
                                </button>
                              </div>
                            </>
                          );
                        })()}
                      </div>
                    ) : null}
                  </div>
                );
              })
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
