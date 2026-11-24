"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import dynamic from "next/dynamic";
import { Package, Pill, Plus, QrCode, RefreshCw, ShieldCheck } from "lucide-react";
import {
  listFacilityMedia,
  listMyUserMedia,
} from "@/features/media-certifications";
import {
  checkBackendOnline,
  fetchDirectoryFacilities,
} from "@/shared/api/directory-client";
import {
  clearStoredSession,
  readStoredSession,
  revokeClientSession,
} from "@/shared/auth/session-storage";
import {
  canReadPharmacyOrders,
  canReadPrescriptions,
  isConsumerUserOrGuest,
  syncPendingSessionStatus,
} from "@/shared/auth/role-capabilities";
import { ConsumerWorkspaceGuard } from "@/shared/auth/ConsumerWorkspaceGuard";
import { formatCountryDisplayName } from "@/shared/i18n/human-labels";
import { useLocale } from "@/shared/i18n/locale-store";
import { PHARMA_COPY } from "../pharmacy-i18n";
import {
  dispensePrescription,
  fetchPrescriptions,
  listMyPatientInsurances,
  verifyPrescriptionQr,
} from "@/features/clinical-workspace";

const ProfileCredentialsPanel = dynamic(
  () =>
    import("@/features/auth-portal").then((m) => m.ProfileCredentialsPanel),
  { ssr: false },
);
const FacilityPapersCard = dynamic(
  () =>
    import("@/features/media-certifications").then(
      (m) => m.FacilityPapersCard,
    ),
  { ssr: false },
);
import {
  isPendingStaffVerification,
  VerificationGateNotice,
} from "@/shared/ui/VerificationGateNotice";
import {
  ACTIVE_COUNTRY_CODE,
  resolveActivePack,
  resolveEffectiveCountryCode,
} from "@/shared/config/deployment";
import { UiTabBar, WorkspaceHeader, useToastSetter } from "@/shared/ui/primitives";
import type {
  AllergyWarning,
  AuthResponse,
  CountryPack,
  DirectoryFacilitySummary,
  FacilityMediaDocument,
  FulfillmentMode,
  LocaleCode,
  PatientInsurancePolicy,
  PaymentMethod,
  PharmacyOrderSummary,
  PharmacyProductCategory,
  PharmacyProductSummary,
  PrescriptionSummary,
  UpdatePharmacyProductInput,
  UserMediaDocument,
} from "@medisync/contracts";
import {
  confirmPharmacyOrderPayment,
  createPharmacyOrder,
  createPharmacyProduct,
  listMyPrescriptionsForCheckout,
  listPharmacyOrders,
  listPharmacyProducts,
  updatePharmacyOrderStatus,
  updatePharmacyProductStock,
} from "../api-client";
import {
  type CartLine,
  type CatalogSafetyFilter,
  type CatalogSortOption,
} from "./pharmacy-utils";
import { PharmacyCatalogGrid } from "./PharmacyCatalogGrid";
import { PharmacyCartSidebar } from "./PharmacyCartSidebar";
import { PharmacyOrdersView } from "./PharmacyOrdersView";
import { PharmacistDispenseDesk } from "./PharmacistDispenseDesk";
import { PharmacistInventoryDesk } from "./PharmacistInventoryDesk";
import { ProductDetailModal } from "./ProductDetailModal";

interface PharmacyStorefrontProps {
  packs: readonly CountryPack[];
  apiBaseUrl: string;
}

const PHARMA_PAPERS_TAB_COPY: Record<
  LocaleCode,
  { tabPapers: string }
> = {
  en: { tabPapers: "Papers & Permits" },
  fr: { tabPapers: "Agréments & Dossier" },
  ar: { tabPapers: "التراخيص والوثائق" },
};

/** Industry-grade MediSync pharmacy commerce storefront & role-isolated pharmacist desk. */
export function PharmacyStorefront({
  packs,
  apiBaseUrl,
}: PharmacyStorefrontProps) {
  const { locale, t, isRtl } = useLocale();
  const copy = PHARMA_COPY[locale];
  const papersCopy = PHARMA_PAPERS_TAB_COPY[locale];
  const defaultCountry = resolveActivePack(packs)?.code ?? ACTIVE_COUNTRY_CODE;

  const [selectedCountry, setSelectedCountry] =
    useState<string>(defaultCountry);
  const [selectedCategory, setSelectedCategory] = useState<
    PharmacyProductCategory | "ALL"
  >("ALL");
  const [selectedCity, setSelectedCity] = useState<string>("");
  const [selectedFacilityId, setSelectedFacilityId] = useState<string>("");
  const [searchText, setSearchText] = useState("");
  const [safetyFilter, setSafetyFilter] = useState<CatalogSafetyFilter>("ALL");
  const [inStockOnly, setInStockOnly] = useState(false);
  const [sortBy, setSortBy] = useState<CatalogSortOption>("recommended");
  const [activeMode, setActiveMode] = useState<
    "store" | "orders" | "dispense" | "manage" | "papers"
  >("store");

  const [session, setSession] = useState<AuthResponse | null>(null);
  const [sessionHydrated, setSessionHydrated] = useState(false);
  const sessionToken = session?.token ?? null;
  const sessionRole = session?.user.role ?? null;
  const sessionCountry = session?.user.countryCode ?? null;
  const isPendingStaff = isPendingStaffVerification(session?.user);
  const canManageStock =
    (sessionRole === "PHARMACIST" || sessionRole === "OPS_ADMIN") &&
    !isPendingStaff;
  const actionLockRef = useRef(false);

  const [facilities, setFacilities] = useState<DirectoryFacilitySummary[]>([]);
  const [products, setProducts] = useState<PharmacyProductSummary[]>([]);
  const [serverCourierFeeMinor, setServerCourierFeeMinor] = useState<
    number | null
  >(null);
  const [backendOffline, setBackendOffline] = useState(false);
  const [loadingCatalog, setLoadingCatalog] = useState(true);
  const [orders, setOrders] = useState<PharmacyOrderSummary[]>([]);
  const [prescriptions, setPrescriptions] = useState<PrescriptionSummary[]>([]);
  const [patientInsurances, setPatientInsurances] = useState<
    PatientInsurancePolicy[]
  >([]);
  const [staffRxQueue, setStaffRxQueue] = useState<PrescriptionSummary[]>([]);
  const [userDocs, setUserDocs] = useState<UserMediaDocument[]>([]);
  const [facilityDocs, setFacilityDocs] = useState<FacilityMediaDocument[]>([]);
  const [qrInput, setQrInput] = useState("");
  const [verifiedRx, setVerifiedRx] = useState<PrescriptionSummary | null>(
    null,
  );
  const [rxAllergyWarnings, setRxAllergyWarnings] = useState<AllergyWarning[]>(
    [],
  );
  const [dispenseNote, setDispenseNote] = useState("");

  const [cart, setCart] = useState<CartLine[]>([]);
  const [pendingSwitchProduct, setPendingSwitchProduct] =
    useState<PharmacyProductSummary | null>(null);
  const [inspectedProduct, setInspectedProduct] =
    useState<PharmacyProductSummary | null>(null);
  const [fulfillmentMode, setFulfillmentMode] =
    useState<FulfillmentMode>("PHARMACY_PICKUP");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [gpsPinnedCoords, setGpsPinnedCoords] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [locatingGps, setLocatingGps] = useState(false);
  const [paymentMethod, setPaymentMethod] =
    useState<PaymentMethod>("CARD_SIMULATED");
  const [selectedRxId, setSelectedRxId] = useState("");
  const [checkoutNotes, setCheckoutNotes] = useState("");
  const [printableOrder, setPrintableOrder] =
    useState<PharmacyOrderSummary | null>(null);

  const [newSku, setNewSku] = useState("");
  const [newName, setNewName] = useState("");
  const [newGeneric, setNewGeneric] = useState("");
  const [newDosageForm, setNewDosageForm] = useState("");
  const [newStrength, setNewStrength] = useState("");
  const [newCategory, setNewCategory] =
    useState<PharmacyProductCategory>("OTC_MEDICATION");
  const [newPriceMajor, setNewPriceMajor] = useState("");
  const [newStockQty, setNewStockQty] = useState("");
  const [newRequiresRx, setNewRequiresRx] = useState(false);

  const [busy, setBusy] = useState(false);
  const setBanner = useToastSetter();

  const activePack = useMemo(
    () => packs.find((p) => p.code === selectedCountry) ?? packs[0],
    [packs, selectedCountry],
  );

  const effectiveCountry = useMemo(() => {
    if (sessionCountry && sessionRole && sessionRole !== "OPS_ADMIN") {
      return sessionCountry;
    }
    return selectedCountry;
  }, [sessionCountry, sessionRole, selectedCountry]);

  const loadPharmacistPapers = useCallback(
    async (activeSession: AuthResponse | null) => {
      if (
        !activeSession?.token ||
        (activeSession.user.role !== "PHARMACIST" &&
          activeSession.user.role !== "OPS_ADMIN")
      ) {
        setUserDocs([]);
        setFacilityDocs([]);
        return;
      }
      const [myRes, facRes] = await Promise.all([
        listMyUserMedia(apiBaseUrl, activeSession.token),
        activeSession.user.facilityId
          ? listFacilityMedia(
              apiBaseUrl,
              activeSession.token,
              activeSession.user.facilityId,
            )
          : Promise.resolve({ ok: true as const, data: { documents: [] } }),
      ]);
      if (myRes.ok) setUserDocs(myRes.data.documents);
      if (facRes.ok) setFacilityDocs(facRes.data.documents);
    },
    [apiBaseUrl],
  );

  const loadCatalogAndOrders = useCallback(
    async (
      countryCode: string,
      activeSession: AuthResponse | null,
      facilityFilter: string,
      categoryFilter: PharmacyProductCategory | "ALL",
      queryText: string,
      cityFilter = "",
    ) => {
      setLoadingCatalog(true);
      try {
        const online = await checkBackendOnline();
        if (!online) {
          setBackendOffline(true);
          return;
        }
        setBackendOffline(false);

        const canViewInactive =
          Boolean(activeSession?.token) &&
          (activeSession?.user.role === "PHARMACIST" ||
            activeSession?.user.role === "OPS_ADMIN") &&
          !isPendingStaffVerification(activeSession?.user);

        const [facRes, prodRes] = await Promise.all([
          fetchDirectoryFacilities(apiBaseUrl, {
            countryCode,
            kind: "PHARMACY",
            limit: 150,
          }),
          listPharmacyProducts(
            apiBaseUrl,
            {
              countryCode,
              ...(cityFilter.trim() ? { city: cityFilter.trim() } : {}),
              ...(facilityFilter ? { facilityId: facilityFilter } : {}),
              ...(categoryFilter !== "ALL" ? { category: categoryFilter } : {}),
              ...(queryText.trim() ? { q: queryText.trim() } : {}),
              ...(canViewInactive ? { includeInactive: true } : {}),
              limit: 200,
            },
            activeSession?.token,
          ),
        ]);

        if (facRes.ok) {
          setFacilities(facRes.facilities);
        }
        if (prodRes.ok) {
          setProducts(prodRes.data.products);
          if (typeof prodRes.data.deliveryFeeMinor === "number") {
            setServerCourierFeeMinor(prodRes.data.deliveryFeeMinor);
          }
        }

        const allowOrders = canReadPharmacyOrders(activeSession?.user);
        const allowRx = canReadPrescriptions(activeSession?.user);
        const isConsumer =
          activeSession?.user.role === "PATIENT" ||
          activeSession?.user.role === "CAREGIVER";
        if (!allowOrders || !activeSession?.token) {
          setOrders([]);
          setPrescriptions([]);
          setPatientInsurances([]);
          return;
        }

        const [ordRes, rxRes, insRes] = await Promise.all([
          listPharmacyOrders(apiBaseUrl, activeSession.token, countryCode),
          allowRx
            ? listMyPrescriptionsForCheckout(
                apiBaseUrl,
                activeSession.token,
                countryCode,
              )
            : Promise.resolve(null),
          isConsumer
            ? listMyPatientInsurances(apiBaseUrl, activeSession.token)
            : Promise.resolve(null),
        ]);

        if (
          (!ordRes.ok && ordRes.status === 401) ||
          (rxRes !== null && !rxRes.ok && rxRes.status === 401)
        ) {
          clearStoredSession();
          setSession(null);
          setOrders([]);
          setPrescriptions([]);
          setPatientInsurances([]);
          setBanner({
            tone: "error",
            text: "Your sign-in session expired. Please sign in again via Portal.",
          });
          return;
        }

        setOrders(ordRes.ok ? ordRes.data.orders : []);
        setPrescriptions(rxRes && rxRes.ok ? rxRes.data.prescriptions : []);
        setPatientInsurances(
          insRes && insRes.ok ? insRes.data.policies : [],
        );
      } finally {
        setLoadingCatalog(false);
      }
    },
    [apiBaseUrl, setBanner],
  );

  useEffect(() => {
    let active = true;
    const stored = readStoredSession();
    const params = new URLSearchParams(window.location.search);
    const urlFacilityId = params.get("facilityId") ?? "";
    const storedIsPending = isPendingStaffVerification(stored?.user);
    const initialCountry = resolveEffectiveCountryCode(
      stored?.user.countryCode ?? defaultCountry,
    );
    setSession(stored);
    setSessionHydrated(true);
    setSelectedCountry(initialCountry);
    setSelectedFacilityId(urlFacilityId);
    if (
      (stored?.user.role === "PHARMACIST" ||
        stored?.user.role === "OPS_ADMIN") &&
      !storedIsPending
    ) {
      setActiveMode("dispense");
    }

    async function bootstrap() {
      let activeSession = stored;
      if (activeSession && isPendingStaffVerification(activeSession.user)) {
        const syncRes = await syncPendingSessionStatus(
          apiBaseUrl,
          activeSession,
        );
        if (!active) return;
        if (syncRes.status === "expired") {
          activeSession = null;
          setSession(null);
        } else if (syncRes.status === "updated" && syncRes.session) {
          activeSession = syncRes.session;
          setSession(syncRes.session);
          if (
            syncRes.session.user.role === "PHARMACIST" ||
            syncRes.session.user.role === "OPS_ADMIN"
          ) {
            setActiveMode("dispense");
          }
        }
      }
      const activeUser = activeSession?.user ?? null;
      if (
        activeUser &&
        (activeUser.role === "PHARMACIST" || activeUser.role === "OPS_ADMIN")
      ) {
        void loadPharmacistPapers(activeSession);
      }
      if (
        activeUser &&
        !isConsumerUserOrGuest(activeUser) &&
        ((activeUser.role !== "PHARMACIST" && activeUser.role !== "OPS_ADMIN") ||
          isPendingStaffVerification(activeUser))
      ) {
        setLoadingCatalog(false);
        return;
      }
      await loadCatalogAndOrders(
        resolveEffectiveCountryCode(
          activeSession?.user.countryCode ?? initialCountry,
        ),
        activeSession,
        urlFacilityId,
        "ALL",
        "",
      );
    }

    void bootstrap();
    return () => {
      active = false;
    };
  }, [apiBaseUrl, defaultCountry, loadCatalogAndOrders, loadPharmacistPapers]);

  useEffect(() => {
    if (!sessionToken || !canManageStock) {
      setStaffRxQueue([]);
      return;
    }
    let cancelled = false;
    fetchPrescriptions(apiBaseUrl, sessionToken, effectiveCountry).then(
      (res) => {
        if (!cancelled && res.ok) {
          setStaffRxQueue(res.data.prescriptions);
        }
      },
    );
    return () => {
      cancelled = true;
    };
  }, [apiBaseUrl, canManageStock, effectiveCountry, sessionToken]);

  function addProductQuantity(product: PharmacyProductSummary, qty = 1) {
    if (product.stockQty <= 0) return;
    const boundedQty = Math.max(1, Math.min(product.stockQty, qty));

    if (cart.length > 0 && cart[0]!.product.facilityId !== product.facilityId) {
      setPendingSwitchProduct(product);
      return;
    }

    setCart((prev) => {
      const idx = prev.findIndex((c) => c.product.id === product.id);
      if (idx >= 0) {
        const nextQty = Math.min(product.stockQty, prev[idx]!.quantity + boundedQty);
        return prev.map((line, i) =>
          i === idx ? { ...line, quantity: nextQty } : line,
        );
      }
      return [...prev, { product, quantity: boundedQty }];
    });
  }

  function updateCartQty(productId: string, delta: number) {
    setCart((prev) =>
      prev
        .map((line) =>
          line.product.id === productId
            ? {
                ...line,
                quantity: Math.min(
                  line.product.stockQty,
                  Math.max(0, line.quantity + delta),
                ),
              }
            : line,
        )
        .filter((line) => line.quantity > 0),
    );
  }

  function handleDetectGpsLocation() {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setBanner({
        tone: "error",
        text: "GPS detection is unavailable in this browser; please enter your delivery address manually.",
      });
      return;
    }
    setLocatingGps(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setGpsPinnedCoords({ lat, lng });
        setDeliveryAddress(
          `GPS Delivery Pin (${lat.toFixed(4)}, ${lng.toFixed(4)})`,
        );
        setLocatingGps(false);
        setBanner({
          tone: "success",
          text: "Courier GPS dropoff coordinates locked.",
        });
      },
      () => {
        setLocatingGps(false);
        setBanner({
          tone: "info",
          text: "Location permission declined — type your street address directly below.",
        });
      },
      { enableHighAccuracy: true, timeout: 6000 },
    );
  }

  const cartQuantities = useMemo(() => {
    const map = new Map<string, number>();
    for (const line of cart) {
      map.set(line.product.id, line.quantity);
    }
    return map;
  }, [cart]);

  const cartRequiresRx = useMemo(
    () => cart.some((line) => line.product.requiresPrescription),
    [cart],
  );

  const effectivePack = useMemo(
    () => packs.find((p) => p.code === effectiveCountry) ?? activePack,
    [packs, effectiveCountry, activePack],
  );
  const allowRxCourier = effectivePack?.allowRxCourierDelivery ?? false;
  const rxPickupOnly = cartRequiresRx && !allowRxCourier;

  useEffect(() => {
    if (rxPickupOnly && fulfillmentMode === "COURIER_DELIVERY") {
      setFulfillmentMode("PHARMACY_PICKUP");
      setBanner({
        tone: "info",
        text: `${effectivePack?.pharmacyLawReference ?? "Local pharmacy law"}: switched to Pharmacy Pickup because prescription medicines require in-person dispensing.`,
      });
    }
  }, [rxPickupOnly, fulfillmentMode, effectivePack?.pharmacyLawReference, setBanner]);

  const cartSubtotalMinor = useMemo(
    () =>
      cart.reduce(
        (acc, line) => acc + line.product.priceMinor * line.quantity,
        0,
      ),
    [cart],
  );

  const deliveryFeeMinor =
    cart.length === 0 || fulfillmentMode === "PHARMACY_PICKUP"
      ? 0
      : (serverCourierFeeMinor ?? 0);

  async function handleCheckoutAndPay(e: FormEvent) {
    e.preventDefault();
    if (!sessionToken) {
      setBanner({
        tone: "error",
        text: "Sign in via Portal before placing a pharmacy order.",
      });
      return;
    }
    if (isPendingStaff) {
      setBanner({
        tone: "error",
        text: "Account verification pending approval.",
      });
      return;
    }
    if (cart.length === 0 || actionLockRef.current) return;
    if (rxPickupOnly && fulfillmentMode === "COURIER_DELIVERY") {
      setFulfillmentMode("PHARMACY_PICKUP");
      setBanner({
        tone: "error",
        text: `${effectivePack?.pharmacyLawReference ?? "Local pharmacy law"} requires in-person Pharmacy Pickup for prescription medicines.`,
      });
      return;
    }
    if (cartRequiresRx && !selectedRxId) {
      setBanner({
        tone: "error",
        text: "Select an issued doctor E-Prescription to fulfill Rx items in your cart.",
      });
      return;
    }

    actionLockRef.current = true;
    const facilityId = cart[0]!.product.facilityId;
    setBusy(true);
    setBanner(null);

    try {
      const createRes = await createPharmacyOrder(apiBaseUrl, sessionToken, {
        facilityId,
        items: cart.map((c) => ({
          productId: c.product.id,
          quantity: c.quantity,
        })),
        fulfillmentMode,
        ...(fulfillmentMode === "COURIER_DELIVERY"
          ? {
              deliveryAddress,
              ...(gpsPinnedCoords
                ? {
                    deliveryLat: gpsPinnedCoords.lat,
                    deliveryLng: gpsPinnedCoords.lng,
                  }
                : {}),
            }
          : {}),
        ...(cartRequiresRx && selectedRxId
          ? { prescriptionId: selectedRxId }
          : {}),
        ...(checkoutNotes.trim() ? { notes: checkoutNotes.trim() } : {}),
      });

      if (!createRes.ok) {
        setBanner({
          tone: "error",
          text: `Order checkout failed: ${createRes.error}`,
        });
        return;
      }

      const payRes = await confirmPharmacyOrderPayment(
        apiBaseUrl,
        sessionToken,
        createRes.data.order.id,
        { paymentMethod },
      );

      if (!payRes.ok) {
        if (payRes.error === "PAYMENT_PROVIDER_REQUIRED") {
          await updatePharmacyOrderStatus(
            apiBaseUrl,
            sessionToken,
            createRes.data.order.id,
            { status: "CANCELLED" },
          ).catch(() => undefined);
          setPaymentMethod("CASH_ON_DELIVERY");
          setBanner({
            tone: "info",
            text:
              locale === "fr"
                ? "Le paiement carte simulé est désactivé en production. Mode basculé sur Paiement à la livraison — cliquez à nouveau pour confirmer."
                : locale === "ar"
                  ? "الدفع التجريبي بالبطاقة معطّل في بيئة الإنتاج. تم التحويل تلقائياً إلى الدفع عند الاستلام — اضغط مجدداً لتأكيد الطلب."
                  : "Simulated card checkout is disabled in production. Switched to Pay on Delivery — click checkout again to confirm.",
          });
          return;
        }
        setBanner({
          tone: "error",
          text: `Payment confirmation error: ${payRes.error}`,
        });
        return;
      }

      const paid = payRes.data.order;
      setCart([]);
      setGpsPinnedCoords(null);
      setPrintableOrder(paid);
      setActiveMode("orders");
      setBanner({
        tone: "success",
        text: `Order paid cleanly! Receipt ${paid.receiptNumber ?? paid.id.slice(0, 8)}${paid.dispatchRequestId ? " · Live courier dispatch created." : ""}`,
      });
      await loadCatalogAndOrders(
        effectiveCountry,
        session,
        selectedFacilityId,
        selectedCategory,
        searchText,
        selectedCity,
      );
    } finally {
      actionLockRef.current = false;
      setBusy(false);
    }
  }

  async function handleAddCatalogProduct(e: FormEvent): Promise<boolean> {
    e.preventDefault();
    if (!sessionToken || actionLockRef.current) {
      if (!sessionToken) {
        setBanner({
          tone: "error",
          text: "Sign in as Pharmacist or Admin first.",
        });
      }
      return false;
    }
    const targetFac = selectedFacilityId || facilities[0]?.id;
    if (!targetFac) {
      setBanner({
        tone: "error",
        text: "Select a verified pharmacy facility first.",
      });
      return false;
    }
    const rawPrice = newPriceMajor.trim().replace(",", ".");
    const rawStock = newStockQty.trim().replace(",", ".");
    const priceMinor =
      rawPrice === "" ? Number.NaN : Math.round(Number(rawPrice) * 100);
    const stockQty = rawStock === "" ? Number.NaN : Number(rawStock);
    if (!Number.isFinite(priceMinor) || priceMinor < 10) {
      setBanner({
        tone: "error",
        text:
          locale === "fr"
            ? "Veuillez saisir un prix PPV valide (≥ 0.10)."
            : locale === "ar"
              ? "يرجى إدخال سعر PPV صحيح (0.10 على الأقل)."
              : "Enter a valid positive PPV price (≥ 0.10).",
      });
      return false;
    }
    if (!Number.isFinite(stockQty) || !Number.isInteger(stockQty) || stockQty < 0) {
      setBanner({
        tone: "error",
        text:
          locale === "fr"
            ? "Veuillez saisir une quantité de stock entière valide (≥ 0)."
            : locale === "ar"
              ? "يرجى إدخال كمية مخزون صحيحة (0 أو أكثر)."
              : "Enter a valid whole-number stock quantity (≥ 0).",
      });
      return false;
    }

    actionLockRef.current = true;
    setBusy(true);
    try {
      const res = await createPharmacyProduct(apiBaseUrl, sessionToken, {
        facilityId: targetFac,
        sku: newSku,
        name: newName,
        ...(newGeneric.trim() ? { genericName: newGeneric.trim() } : {}),
        category: newCategory,
        dosageForm: newDosageForm.trim() || "Box",
        strength: newStrength.trim() || "Standard",
        requiresPrescription: newRequiresRx,
        priceMinor,
        stockQty: Math.round(stockQty),
      });

      if (!res.ok) {
        setBanner({ tone: "error", text: `Catalog error: ${res.error}` });
        return false;
      }
      setNewSku("");
      setNewName("");
      setNewGeneric("");
      setNewDosageForm("");
      setNewStrength("");
      setNewPriceMajor("");
      setNewStockQty("");
      setBanner({
        tone: "success",
        text: `Added ${res.data.product.name} (${res.data.product.sku}) to catalog.`,
      });
      await loadCatalogAndOrders(
        effectiveCountry,
        session,
        selectedFacilityId,
        selectedCategory,
        searchText,
        selectedCity,
      );
      return true;
    } finally {
      actionLockRef.current = false;
      setBusy(false);
    }
  }

  async function handleUpdateProductPricingStock(
    product: PharmacyProductSummary,
    patch: UpdatePharmacyProductInput,
  ) {
    if (!sessionToken || actionLockRef.current) return;
    actionLockRef.current = true;
    setBusy(true);
    try {
      const res = await updatePharmacyProductStock(
        apiBaseUrl,
        sessionToken,
        product.id,
        patch,
      );
      if (!res.ok) {
        setBanner({ tone: "error", text: `Restock blocked: ${res.error}` });
        return;
      }
      setBanner({
        tone: "success",
        text: `${product.name} updated (${res.data.product.stockQty} units).`,
      });
      await loadCatalogAndOrders(
        effectiveCountry,
        session,
        selectedFacilityId,
        selectedCategory,
        searchText,
        selectedCity,
      );
    } finally {
      actionLockRef.current = false;
      setBusy(false);
    }
  }

  async function handleVerifyQr(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!sessionToken || !canManageStock || actionLockRef.current) return;
    if (!qrInput.trim()) return;
    actionLockRef.current = true;
    setBusy(true);
    try {
      const res = await verifyPrescriptionQr(
        apiBaseUrl,
        sessionToken,
        qrInput.trim(),
      );
      if (!res.ok) {
        setVerifiedRx(null);
        setRxAllergyWarnings([]);
        setBanner({
          tone: "error",
          text: `QR Verification Failed: ${res.error}`,
        });
        return;
      }
      const firstMed =
        res.data.prescription.medications[0]?.name ?? "E-Prescription";
      const warnings = res.data.allergyWarnings ?? [];
      setVerifiedRx(res.data.prescription);
      setRxAllergyWarnings(warnings);
      setBanner({
        tone: warnings.length > 0 ? "info" : "success",
        text:
          warnings.length > 0
            ? `Allergy Alert on ${firstMed}: ${warnings[0]!.message}`
            : `Verified E-Rx for ${res.data.prescription.patientName}: ${firstMed}.`,
      });
    } finally {
      actionLockRef.current = false;
      setBusy(false);
    }
  }

  async function handleDispenseRx(prescriptionId: string) {
    if (!sessionToken || !canManageStock || actionLockRef.current) return;
    actionLockRef.current = true;
    setBusy(true);
    try {
      const targetPharmacyId =
        session?.user.facilityId ?? (selectedFacilityId || undefined);
      const res = await dispensePrescription(
        apiBaseUrl,
        sessionToken,
        prescriptionId,
        {
          ...(targetPharmacyId ? { pharmacyFacilityId: targetPharmacyId } : {}),
          ...(dispenseNote.trim()
            ? { dispensingNote: dispenseNote.trim() }
            : {}),
        },
      );
      if (!res.ok) {
        setBanner({
          tone: "error",
          text:
            res.status === 409
              ? "Prescription already dispensed in another session."
              : `Dispense failed: ${res.error}`,
        });
        return;
      }
      const firstMed =
        res.data.prescription.medications[0]?.name ?? "Medication";
      setVerifiedRx(res.data.prescription);
      setDispenseNote("");
      setStaffRxQueue((prev) =>
        prev.map((rx) =>
          rx.id === res.data.prescription.id ? res.data.prescription : rx,
        ),
      );
      setBanner({
        tone: "success",
        text: `Dispensed ${firstMed} to ${res.data.prescription.patientName}.`,
      });
    } finally {
      actionLockRef.current = false;
      setBusy(false);
    }
  }

  async function handleAdvanceOrder(
    order: PharmacyOrderSummary,
    nextStatus: "PREPARING" | "OUT_FOR_DELIVERY" | "DELIVERED" | "CANCELLED",
  ) {
    if (!sessionToken || isPendingStaff || actionLockRef.current) return;
    actionLockRef.current = true;
    setBusy(true);
    try {
      const res = await updatePharmacyOrderStatus(
        apiBaseUrl,
        sessionToken,
        order.id,
        { status: nextStatus },
      );
      if (!res.ok) {
        setBanner({ tone: "error", text: `Order update blocked: ${res.error}` });
        return;
      }
      setBanner({
        tone: "success",
        text: `Order ${order.receiptNumber ?? order.id.slice(0, 8)} moved to ${nextStatus}.`,
      });
      await loadCatalogAndOrders(
        effectiveCountry,
        session,
        selectedFacilityId,
        selectedCategory,
        searchText,
        selectedCity,
      );
    } finally {
      actionLockRef.current = false;
      setBusy(false);
    }
  }

  const currencyCode = activePack?.currencyCode ?? effectiveCountry;
  const showPendingStaffGate =
    sessionHydrated &&
    Boolean(session?.user) &&
    !isConsumerUserOrGuest(session?.user) &&
    isPendingStaff;
  const isBlockedStaffVisitor =
    sessionHydrated &&
    Boolean(session?.user) &&
    !isConsumerUserOrGuest(session?.user) &&
    !canManageStock;

  const handleSignOut = () => {
    revokeClientSession(apiBaseUrl);
    setSession(null);
    setOrders([]);
    setPrescriptions([]);
    setPatientInsurances([]);
    setStaffRxQueue([]);
    setVerifiedRx(null);
    setQrInput("");
    setActiveMode("store");
    void loadCatalogAndOrders(
      defaultCountry,
      null,
      selectedFacilityId,
      selectedCategory,
      searchText,
    );
  };

  const inspectedFacility = inspectedProduct
    ? (facilities.find((f) => f.id === inspectedProduct.facilityId) ?? null)
    : null;

  return (
    <div dir={isRtl ? "rtl" : "ltr"} className="space-y-4">
      <WorkspaceHeader
        title={canManageStock ? copy.pharmacistHeading : t("pharma.heading")}
        countryCode={effectiveCountry}
        countryName={formatCountryDisplayName(
          effectiveCountry,
          activePack?.name ?? effectiveCountry,
          locale,
        )}
        currencyCode={currencyCode}
        emergencyHotline={activePack?.emergencyHotlines.ambulance ?? ""}
        user={session?.user ?? null}
        guestLabel={canManageStock ? copy.pharmacistGuest : copy.customerGuest}
        onSignOut={handleSignOut}
        actions={
          isBlockedStaffVisitor ? null : (
            <button
              type="button"
              onClick={() =>
                void loadCatalogAndOrders(
                  effectiveCountry,
                  session,
                  selectedFacilityId,
                  selectedCategory,
                  searchText,
                  selectedCity,
                )
              }
              aria-label={copy.refreshAria}
              className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 text-xs font-semibold text-slate-700 shadow-2xs transition hover:border-teal-700 hover:text-teal-900"
            >
              <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="hidden sm:inline">{copy.refreshBtn}</span>
            </button>
          )
        }
      />

      <ConsumerWorkspaceGuard
        user={session?.user ?? null}
        hydrated={sessionHydrated}
        surfaceTitle={copy.surfaceTitle}
        allowRoles={["PHARMACIST", "OPS_ADMIN"]}
        onSignOut={handleSignOut}
      >
        {showPendingStaffGate && session?.user && sessionToken ? (
          <div className="space-y-4">
            <VerificationGateNotice user={session.user} />
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <FacilityPapersCard
                apiBaseUrl={apiBaseUrl}
                token={sessionToken}
                facilityId={session.user.facilityId ?? null}
                facilityName={
                  facilities.find((f) => f.id === session.user.facilityId)?.name ??
                  null
                }
                facilityKind="PHARMACY"
                documents={facilityDocs}
                busy={busy}
                onBusyChange={setBusy}
                onDocumentsUpdated={() => loadPharmacistPapers(session)}
                onFeedback={(tone, text) => setBanner({ tone, text })}
              />
              <ProfileCredentialsPanel
                apiBaseUrl={apiBaseUrl}
                token={sessionToken}
                userRole={session.user.role}
                documents={userDocs}
                busy={busy}
                onBusyChange={setBusy}
                onDocumentsUpdated={() => loadPharmacistPapers(session)}
                onFeedback={(tone, text) => setBanner({ tone, text })}
              />
            </div>
          </div>
        ) : (
          <>
            <VerificationGateNotice user={session?.user} compact />

            {backendOffline ? (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-xs text-amber-950">
                <p className="font-semibold">{copy.offlineBanner}</p>
                <button
                  type="button"
                  onClick={() =>
                    void loadCatalogAndOrders(
                      effectiveCountry,
                      session,
                      selectedFacilityId,
                      selectedCategory,
                      searchText,
                      selectedCity,
                    )
                  }
                  className="rounded-full bg-amber-900 px-3 py-1 text-[11px] font-semibold text-white hover:bg-amber-950"
                >
                  {copy.retryBtn}
                </button>
              </div>
            ) : null}

            {/* Streamlined Mode Tabs */}
        <section className="flex flex-wrap items-center justify-between gap-2">
          <UiTabBar
            ariaLabel={copy.modesAria}
            activeTab={activeMode}
            onSelect={(nextMode) => {
              setActiveMode(nextMode);
              if (nextMode === "papers" && session) {
                void loadPharmacistPapers(session);
              }
            }}
            tabs={[
              ...(!canManageStock
                ? [
                    {
                      id: "store" as const,
                      label: copy.tabStore,
                      icon: <Pill className="h-3.5 w-3.5" aria-hidden="true" />,
                    },
                  ]
                : []),
              {
                id: "orders" as const,
                label: `${copy.tabOrders} (${orders.length})`,
                icon: <Package className="h-3.5 w-3.5" aria-hidden="true" />,
              },
              ...(canManageStock
                ? [
                    {
                      id: "dispense" as const,
                      label: copy.tabDispense,
                      icon: <QrCode className="h-3.5 w-3.5" aria-hidden="true" />,
                    },
                    {
                      id: "manage" as const,
                      label: copy.tabManage,
                      icon: <Plus className="h-3.5 w-3.5" aria-hidden="true" />,
                    },
                    {
                      id: "papers" as const,
                      label: papersCopy.tabPapers,
                      icon: <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />,
                    },
                  ]
                : []),
            ]}
          />
        </section>

        {activeMode === "store" && !canManageStock ? (
          <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-12">
            <PharmacyCatalogGrid
              products={products}
              facilities={facilities}
              effectiveCountry={effectiveCountry}
              loadingCatalog={loadingCatalog}
              searchText={searchText}
              selectedCity={selectedCity}
              selectedFacilityId={selectedFacilityId}
              selectedCategory={selectedCategory}
              safetyFilter={safetyFilter}
              inStockOnly={inStockOnly}
              sortBy={sortBy}
              cartQuantities={cartQuantities}
              onSearchChange={(next) => {
                setSearchText(next);
                void loadCatalogAndOrders(
                  effectiveCountry,
                  session,
                  selectedFacilityId,
                  selectedCategory,
                  next,
                  selectedCity,
                );
              }}
              onCityChange={(nextCity) => {
                setSelectedCity(nextCity);
                setSelectedFacilityId("");
                void loadCatalogAndOrders(
                  effectiveCountry,
                  session,
                  "",
                  selectedCategory,
                  searchText,
                  nextCity,
                );
              }}
              onFacilityChange={(nextFac) => {
                setSelectedFacilityId(nextFac);
                void loadCatalogAndOrders(
                  effectiveCountry,
                  session,
                  nextFac,
                  selectedCategory,
                  searchText,
                  selectedCity,
                );
              }}
              onCategoryChange={(nextCat) => {
                setSelectedCategory(nextCat);
                void loadCatalogAndOrders(
                  effectiveCountry,
                  session,
                  selectedFacilityId,
                  nextCat,
                  searchText,
                  selectedCity,
                );
              }}
              onSafetyFilterChange={setSafetyFilter}
              onInStockOnlyChange={setInStockOnly}
              onSortChange={setSortBy}
              onAddToCart={(product) => addProductQuantity(product, 1)}
              onUpdateCartQty={updateCartQty}
              onInspectProduct={setInspectedProduct}
            />

            <PharmacyCartSidebar
              cart={cart}
              pendingSwitchProduct={pendingSwitchProduct}
              currencyCode={currencyCode}
              sessionToken={sessionToken}
              prescriptions={prescriptions}
              patientInsurances={patientInsurances}
              selectedRxId={selectedRxId}
              fulfillmentMode={fulfillmentMode}
              deliveryAddress={deliveryAddress}
              gpsPinnedCoords={gpsPinnedCoords}
              locatingGps={locatingGps}
              paymentMethod={paymentMethod}
              checkoutNotes={checkoutNotes}
              cartSubtotalMinor={cartSubtotalMinor}
              courierQuoteMinor={serverCourierFeeMinor}
              deliveryFeeMinor={deliveryFeeMinor}
              allowRxCourier={allowRxCourier}
              pharmacyLawReference={effectivePack?.pharmacyLawReference ?? null}
              busy={busy}
              onUpdateCartQty={updateCartQty}
              onClearCart={() => {
                setCart([]);
                setPendingSwitchProduct(null);
              }}
              onConfirmFacilitySwitch={() => {
                if (!pendingSwitchProduct) return;
                setCart([{ product: pendingSwitchProduct, quantity: 1 }]);
                setBanner({
                  tone: "info",
                  text: `${copy.cartSwitchedPrefix} ${pendingSwitchProduct.facilityName}.`,
                });
                setPendingSwitchProduct(null);
              }}
              onDismissFacilitySwitch={() => setPendingSwitchProduct(null)}
              onSelectRxId={setSelectedRxId}
              onSelectFulfillmentMode={setFulfillmentMode}
              onDeliveryAddressChange={(addr) => {
                setDeliveryAddress(addr);
                if (gpsPinnedCoords) setGpsPinnedCoords(null);
              }}
              onDetectGpsLocation={handleDetectGpsLocation}
              onPaymentMethodChange={setPaymentMethod}
              onCheckoutNotesChange={setCheckoutNotes}
              onSubmitCheckout={(e) => void handleCheckoutAndPay(e)}
            />
          </div>
        ) : null}

        {activeMode === "orders" ? (
          <PharmacyOrdersView
            orders={orders}
            printableOrder={printableOrder}
            canManageStock={canManageStock}
            busy={busy}
            onSelectPrintableOrder={setPrintableOrder}
            onAdvanceOrder={handleAdvanceOrder}
          />
        ) : null}

        {activeMode === "dispense" && canManageStock ? (
          <PharmacistDispenseDesk
            qrInput={qrInput}
            verifiedRx={verifiedRx}
            allergyWarnings={rxAllergyWarnings}
            dispenseNote={dispenseNote}
            staffRxQueue={staffRxQueue}
            busy={busy}
            onQrInputChange={setQrInput}
            onDispenseNoteChange={setDispenseNote}
            onVerifyQr={(e) => void handleVerifyQr(e)}
            onDispenseRx={(rxId) => void handleDispenseRx(rxId)}
          />
        ) : null}

        {activeMode === "manage" && canManageStock ? (
          <PharmacistInventoryDesk
            effectiveCountry={effectiveCountry}
            currencyCode={currencyCode}
            products={products}
            busy={busy}
            newSku={newSku}
            newName={newName}
            newGeneric={newGeneric}
            newDosageForm={newDosageForm}
            newStrength={newStrength}
            newCategory={newCategory}
            newPriceMajor={newPriceMajor}
            newStockQty={newStockQty}
            newRequiresRx={newRequiresRx}
            onNewSkuChange={setNewSku}
            onNewNameChange={setNewName}
            onNewGenericChange={setNewGeneric}
            onNewDosageFormChange={setNewDosageForm}
            onNewStrengthChange={setNewStrength}
            onNewCategoryChange={setNewCategory}
            onNewPriceMajorChange={setNewPriceMajor}
            onNewStockQtyChange={setNewStockQty}
            onNewRequiresRxChange={setNewRequiresRx}
            onAddCatalogProduct={handleAddCatalogProduct}
            onRestock={(prod, delta) =>
              void handleUpdateProductPricingStock(prod, {
                stockQty: Math.max(0, prod.stockQty + delta),
              })
            }
            onUpdateProductPricingStock={(prod, patch) =>
              void handleUpdateProductPricingStock(prod, patch)
            }
          />
        ) : null}

        {activeMode === "papers" && canManageStock && session?.user && sessionToken ? (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <FacilityPapersCard
              apiBaseUrl={apiBaseUrl}
              token={sessionToken}
              facilityId={session.user.facilityId ?? (selectedFacilityId || null)}
              facilityName={
                facilities.find(
                  (f) => f.id === (session.user.facilityId ?? selectedFacilityId),
                )?.name ?? null
              }
              facilityKind="PHARMACY"
              documents={facilityDocs}
              busy={busy}
              onBusyChange={setBusy}
              onDocumentsUpdated={() => loadPharmacistPapers(session)}
              onFeedback={(tone, text) => setBanner({ tone, text })}
            />
            <ProfileCredentialsPanel
              apiBaseUrl={apiBaseUrl}
              token={sessionToken}
              userRole={session.user.role}
              documents={userDocs}
              busy={busy}
              onBusyChange={setBusy}
              onDocumentsUpdated={() => loadPharmacistPapers(session)}
              onFeedback={(tone, text) => setBanner({ tone, text })}
            />
          </div>
        ) : null}

            <ProductDetailModal
              product={inspectedProduct}
              facility={inspectedFacility}
              inCartQty={
                inspectedProduct
                  ? (cartQuantities.get(inspectedProduct.id) ?? 0)
                  : 0
              }
              onClose={() => setInspectedProduct(null)}
              onAddQuantity={addProductQuantity}
            />
          </>
        )}
      </ConsumerWorkspaceGuard>
    </div>
  );
}
