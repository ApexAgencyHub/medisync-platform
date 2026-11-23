import type {
  FulfillmentMode,
  LocaleCode,
  PaymentMethod,
  PharmacyOrderStatus,
  PharmacyProductCategory,
} from "@medisync/contracts";

export interface PharmacyUiCopy {
  pharmacistHeading: string;
  pharmacistGuest: string;
  customerGuest: string;
  refreshAria: string;
  refreshBtn: string;
  surfaceTitle: string;
  offlineBanner: string;
  retryBtn: string;
  modesAria: string;
  tabStore: string;
  tabOrders: string;
  tabDispense: string;
  tabManage: string;
  cartSwitchedPrefix: string;
  categories: Record<PharmacyProductCategory, string>;
  guidance: Record<PharmacyProductCategory, string>;
  fulfillment: Record<FulfillmentMode, string>;
  paymentMethods: Record<PaymentMethod, string>;
  orderStatus: Record<
    PharmacyOrderStatus,
    { label: string; tone: "amber" | "teal" | "slate" | "emerald" | "red" }
  >;
  licensePrefix: string;
  clearSearchAria: string;
  facilityFilterAria: string;
  allPharmaciesOption: string;
  allCategoriesBtn: string;
  allTypesChip: string;
  otcReadyChip: string;
  rxOnlyChip: string;
  inStockOnlyChip: string;
  itemsWord: string;
  itemWord: string;
  sortAria: string;
  sortRecommended: string;
  sortPriceAsc: string;
  sortPriceDesc: string;
  sortNameAsc: string;
  emptyFilterPrefix: string;
  emptyFilterHint: string;
  resetCatalogBtn: string;
  rxRequiredBadge: string;
  otcShortBadge: string;
  detailsForAriaPrefix: string;
  detailsBtn: string;
  qrRxTooltip: string;
  qrRxShort: string;
  outOfStock: string;
  onlyLeftPrefix: string;
  onlyLeftSuffix: string;
  inStockSuffix: string;
  decreasePrefix: string;
  increasePrefix: string;
  inCartSuffix: string;
  clearBagBtn: string;
  switchCartPrefix: string;
  switchCartBodyPrefix: string;
  switchAndAddBtn: string;
  keepBagBtn: string;
  fulfillingViaPrefix: string;
  bagHintPickup: string;
  bagHintCourier: string;
  bagHintRx: string;
  removeItemAria: string;
  attachRxHeading: string;
  signInWord: string;
  toAttachRxSuffix: string;
  noActiveRxPrefix: string;
  bookConsultLink: string;
  toReceiveRxSuffix: string;
  selectIssuedRxOption: string;
  pharmacyPickupTitle: string;
  freeCounterSub: string;
  courierDispatchTitle: string;
  pickupOnlyRxSub: string;
  calculatedAtCheckout: string;
  defaultRegulationTitle: string;
  rxPickupNotice: string;
  deliveryAddressLabel: string;
  detectingGps: string;
  autoGpsPin: string;
  addressPlaceholder: string;
  gpsLockedPrefix: string;
  gpsLockedSuffix: string;
  paymentChannelLabel: string;
  activePolicyLabel: string;
  noInsurancePrefix: string;
  myCareLink: string;
  pharmacistNoteLabel: string;
  pharmacistNotePlaceholder: string;
  subtotalLabel: string;
  courierFeeLabel: string;
  freeWord: string;
  quotedByServer: string;
  totalLabel: string;
  processingCheckout: string;
  inBagWord: string;
  reviewCheckout: string;
  ordersSubtitle: string;
  filterAllPrefix: string;
  filterActive: string;
  filterDelivered: string;
  filterCancelled: string;
  officialReceiptPrefix: string;
  issuedPrefix: string;
  printReceiptBtn: string;
  closeBtn: string;
  patientLabel: string;
  pharmacyLabel: string;
  channelLabel: string;
  pendingWord: string;
  courierShortLabel: string;
  totalPaidLabel: string;
  noOrdersYet: string;
  noMatchingOrders: string;
  orderNumberPrefix: string;
  qrRxLinkedBadge: string;
  trackCourierBtn: string;
  receiptBtn: string;
  prepareBtn: string;
  dispatchCourierBtn: string;
  markDeliveredBtn: string;
  cancelBtn: string;
  stepPaid: string;
  stepPreparing: string;
  stepEnRoute: string;
  stepDelivered: string;
  stepCompleted: string;
  modalProductDetailsAria: string;
  modalCloseAria: string;
  modalRxBadge: string;
  modalOtcBadge: string;
  modalColdChainBadge: string;
  modalActiveIngredient: string;
  modalFormStrength: string;
  modalAvailability: string;
  modalUnitsReadySuffix: string;
  modalDispensingGuidanceHeading: string;
  modalAcceptedCoverage: string;
  modalUnitPriceLabel: string;
  modalDecreaseQtyAria: string;
  modalIncreaseQtyAria: string;
  modalMaxInCart: string;
  modalAddPrefix: string;
  modalToCartSuffix: string;
  dispenseDeskTitle: string;
  dispenseDeskSub: string;
  qrTokenLabel: string;
  verifyQrBtn: string;
  prescriberLabel: string;
  daysWord: string;
  clinicalNotePrefix: string;
  dispensingNoteLabel: string;
  dispensingNotePlaceholder: string;
  confirmDispenseBtn: string;
  dispensingRecordPrefix: string;
  activeQueueHeading: string;
  readyToDispenseWord: string;
  completedWord: string;
  queueFilterAll: string;
  queueFilterReady: string;
  queueFilterDispensed: string;
  queueSearchPlaceholder: string;
  queueEmptyNone: string;
  queueEmptyFiltered: string;
  kpiActiveSkus: string;
  kpiLowStock: string;
  kpiOutOfStock: string;
  kpiRxControlled: string;
  addMedHeading: string;
  skuPlaceholder: string;
  medNamePlaceholder: string;
  genericPlaceholder: string;
  dosageFormPlaceholder: string;
  strengthPlaceholder: string;
  priceWord: string;
  initialStockPlaceholder: string;
  requiresRxLabel: string;
  addCatalogBtn: string;
  liveInventoryHeading: string;
  lowOutOnlyBtn: string;
  filterInventoryPlaceholder: string;
  emptyInventory: string;
  leftWord: string;
  unitsPlus10: string;
  editStockPriceAria: string;
  exactStockLabel: string;
  saveBtn: string;
}

export const PHARMA_COPY: Record<LocaleCode, PharmacyUiCopy> = {
  en: {
    pharmacistHeading: "Pharmacist QR Dispense & Courier Desk",
    pharmacistGuest: "Pharmacist Console",
    customerGuest: "Browse Storefront",
    refreshAria: "Refresh catalog",
    refreshBtn: "Refresh",
    surfaceTitle: "Pharmacy Storefront & Patient Checkout",
    offlineBanner:
      "Backend pharmacy service is unreachable right now. Catalog and checkout require a live API connection.",
    retryBtn: "Retry Connection",
    modesAria: "Pharmacy modes",
    tabStore: "Catalog & Checkout",
    tabOrders: "Orders & Receipts",
    tabDispense: "QR Rx Dispense",
    tabManage: "Pharmacist Stock Manager",
    cartSwitchedPrefix: "Cart switched to",
    categories: {
      OTC_MEDICATION: "OTC Care",
      PRESCRIPTION_RX: "Prescription Rx",
      MEDICAL_DEVICE: "Devices",
      WELLNESS_SUPPLEMENT: "Supplements",
      PEDIATRIC_CARE: "Pediatric",
      COLD_CHAIN: "Cold Chain 2-8°C",
    },
    guidance: {
      OTC_MEDICATION:
        "Over-the-counter formulation verified by licensed pharmacists.",
      PRESCRIPTION_RX:
        "Dispensing requires a signed physician QR E-Prescription at checkout.",
      MEDICAL_DEVICE:
        "Calibrated medical hardware inspected for home or clinical monitoring.",
      WELLNESS_SUPPLEMENT:
        "Pharmaceutical-grade nutritional or supportive care formulation.",
      PEDIATRIC_CARE:
        "Formulated for pediatric hydration or child care; confirm weight dosing.",
      COLD_CHAIN:
        "Temperature-sensitive 2-8°C biologic. Dispatched in insulated cold packs.",
    },
    fulfillment: {
      PHARMACY_PICKUP: "Pharmacy Counter Pickup",
      COURIER_DELIVERY: "Express Medical Courier",
    },
    paymentMethods: {
      CARD_SIMULATED: "Online Card / Instant Receipt",
      INSURANCE_COPAY: "Insurance / Mutuelle Co-Pay",
      CASH_ON_DELIVERY: "Cash / Counter Payment",
    },
    orderStatus: {
      PENDING_PAYMENT: { label: "Awaiting Payment", tone: "amber" },
      PAID: { label: "Paid · Sent to Pharmacy", tone: "teal" },
      PREPARING: { label: "Preparing Medication", tone: "amber" },
      OUT_FOR_DELIVERY: { label: "Courier En Route", tone: "teal" },
      DELIVERED: { label: "Delivered / Completed", tone: "emerald" },
      CANCELLED: { label: "Cancelled · Restocked", tone: "red" },
    },
    licensePrefix: "License",
    clearSearchAria: "Clear search",
    facilityFilterAria: "Dispensing Pharmacy Filter",
    allPharmaciesOption: "All Pharmacies",
    allCategoriesBtn: "All Categories",
    allTypesChip: "All Types",
    otcReadyChip: "OTC Ready (No Rx)",
    rxOnlyChip: "Rx Prescription",
    inStockOnlyChip: "In Stock Only",
    itemsWord: "items",
    itemWord: "item",
    sortAria: "Sort medications",
    sortRecommended: "Recommended",
    sortPriceAsc: "Price: Low to High",
    sortPriceDesc: "Price: High to Low",
    sortNameAsc: "Name: A to Z",
    emptyFilterPrefix: "No pharmacy items match your current filter in",
    emptyFilterHint: "Try clearing your search or switching back to All Categories.",
    resetCatalogBtn: "Reset Catalog Filters",
    rxRequiredBadge: "Rx Required",
    otcShortBadge: "OTC",
    detailsForAriaPrefix: "Details for",
    detailsBtn: "Details",
    qrRxTooltip: "Requires verified physician QR Rx during checkout",
    qrRxShort: "QR Rx",
    outOfStock: "Out of stock",
    onlyLeftPrefix: "Only",
    onlyLeftSuffix: "left",
    inStockSuffix: "in stock",
    decreasePrefix: "Decrease",
    increasePrefix: "Increase",
    inCartSuffix: "in cart",
    clearBagBtn: "Clear",
    switchCartPrefix: "Replace cart with",
    switchCartBodyPrefix:
      "Each order fulfills from one licensed dispensing pharmacy. Switching replaces your current bag with",
    switchAndAddBtn: "Switch & Add",
    keepBagBtn: "Keep Current Bag",
    fulfillingViaPrefix: "Fulfilling via",
    bagHintPickup: "• Direct pharmacy pickup is free (~20 min prep).",
    bagHintCourier: "• Express medical courier delivers with live tracking.",
    bagHintRx: "• Rx items validate your signed doctor QR script.",
    removeItemAria: "Remove item",
    attachRxHeading: "Attach Issued E-Prescription (Rx Required)",
    signInWord: "Sign in",
    toAttachRxSuffix: "to attach your verified doctor QR script.",
    noActiveRxPrefix: "No active unfulfilled prescriptions found.",
    bookConsultLink: "Book a doctor consultation",
    toReceiveRxSuffix: "to receive an E-Prescription.",
    selectIssuedRxOption: "-- Select issued prescription --",
    pharmacyPickupTitle: "Pharmacy Pickup",
    freeCounterSub: "Free · Counter",
    courierDispatchTitle: "Courier Dispatch",
    pickupOnlyRxSub: "Pickup Only (Rx)",
    calculatedAtCheckout: "Calculated at checkout",
    defaultRegulationTitle: "Pharmacy Dispensing Regulation",
    rxPickupNotice:
      "Prescription medications require in-person pickup at the licensed pharmacy counter. Remove Rx items if you only need courier delivery for wellness or medical devices.",
    deliveryAddressLabel: "Courier Delivery Address",
    detectingGps: "Detecting...",
    autoGpsPin: "Auto GPS Pin",
    addressPlaceholder: "Street address, building, floor...",
    gpsLockedPrefix: "GPS locked",
    gpsLockedSuffix: "for live driver dispatch",
    paymentChannelLabel: "Payment Channel",
    activePolicyLabel: "Active Policy:",
    noInsurancePrefix: "No insurance policy saved yet — manage policies on",
    myCareLink: "My Care",
    pharmacistNoteLabel: "Pharmacist Note (Optional)",
    pharmacistNotePlaceholder: "Allergy or doorstep instructions",
    subtotalLabel: "Subtotal",
    courierFeeLabel: "Courier Fee",
    freeWord: "Free",
    quotedByServer: "Quoted by server",
    totalLabel: "Total",
    processingCheckout: "Processing Checkout...",
    inBagWord: "in Bag",
    reviewCheckout: "Review Checkout →",
    ordersSubtitle:
      "Real-time fulfillment status, courier tracking, and clinical itemized receipts.",
    filterAllPrefix: "All",
    filterActive: "Active",
    filterDelivered: "Delivered",
    filterCancelled: "Cancelled",
    officialReceiptPrefix: "OFFICIAL PHARMACY RECEIPT",
    issuedPrefix: "Issued",
    printReceiptBtn: "Print Receipt",
    closeBtn: "Close",
    patientLabel: "Patient:",
    pharmacyLabel: "Pharmacy:",
    channelLabel: "Channel:",
    pendingWord: "Pending",
    courierShortLabel: "Courier:",
    totalPaidLabel: "Total Paid:",
    noOrdersYet: "No pharmacy orders recorded yet.",
    noMatchingOrders: "No orders match this status filter.",
    orderNumberPrefix: "Order #",
    qrRxLinkedBadge: "QR Rx Linked",
    trackCourierBtn: "Track Courier",
    receiptBtn: "Receipt",
    prepareBtn: "Prepare",
    dispatchCourierBtn: "Dispatch Courier",
    markDeliveredBtn: "Mark Delivered",
    cancelBtn: "Cancel",
    stepPaid: "Paid",
    stepPreparing: "Preparing",
    stepEnRoute: "Courier En Route",
    stepDelivered: "Delivered",
    stepCompleted: "Completed",
    modalProductDetailsAria: "Product details for",
    modalCloseAria: "Close product details",
    modalRxBadge: "Rx Prescription Required",
    modalOtcBadge: "OTC Pharmacist Approved",
    modalColdChainBadge: "2-8°C Cold Chain",
    modalActiveIngredient: "Active Ingredient",
    modalFormStrength: "Form & Strength",
    modalAvailability: "Availability",
    modalUnitsReadySuffix: "units ready",
    modalDispensingGuidanceHeading: "Clinical Dispensing Guidance",
    modalAcceptedCoverage: "Accepted Coverage:",
    modalUnitPriceLabel: "Unit Price",
    modalDecreaseQtyAria: "Decrease quantity",
    modalIncreaseQtyAria: "Increase quantity",
    modalMaxInCart: "Max in Cart",
    modalAddPrefix: "Add",
    modalToCartSuffix: "to Cart",
    dispenseDeskTitle: "E-Prescription QR Verification Desk",
    dispenseDeskSub:
      "Scan or paste a signed MediSync Rx token before releasing medication.",
    qrTokenLabel: "E-Prescription QR Token",
    verifyQrBtn: "Verify QR Prescription",
    prescriberLabel: "Prescriber:",
    daysWord: "days",
    clinicalNotePrefix: "Clinical Note:",
    dispensingNoteLabel: "Pharmacist Dispensing & Batch Note (Optional)",
    dispensingNotePlaceholder: "Lot # / Generic substitution / Patient counselled",
    confirmDispenseBtn: "Confirm Dispense & Release",
    dispensingRecordPrefix: "Dispensing Record:",
    activeQueueHeading: "Active E-Prescriptions in Queue",
    readyToDispenseWord: "ready to dispense",
    completedWord: "completed",
    queueFilterAll: "All",
    queueFilterReady: "Ready",
    queueFilterDispensed: "Dispensed",
    queueSearchPlaceholder: "Search patient, prescriber, or medication...",
    queueEmptyNone:
      "No signed E-Prescriptions queued yet. Physicians issue QR scripts from /clinical.",
    queueEmptyFiltered: "No prescriptions match this filter.",
    kpiActiveSkus: "Active Catalog SKUs",
    kpiLowStock: "Low Stock (<= 10)",
    kpiOutOfStock: "Out of Stock",
    kpiRxControlled: "Rx Controlled",
    addMedHeading: "Add Pharmacy Medication",
    skuPlaceholder: "SKU (e.g. MA-AZITH-500)",
    medNamePlaceholder: "Medication / Product Name",
    genericPlaceholder: "Generic Active Ingredient (optional)",
    dosageFormPlaceholder: "Dosage Form (e.g. Box / 16 Tablets)",
    strengthPlaceholder: "Strength (e.g. 500 mg)",
    priceWord: "Price",
    initialStockPlaceholder: "Initial Stock Qty",
    requiresRxLabel: "Requires verified Doctor E-Prescription (Rx)",
    addCatalogBtn: "Add to Pharmacy Catalog",
    liveInventoryHeading: "Live Inventory Controls",
    lowOutOnlyBtn: "Low / Out Only",
    filterInventoryPlaceholder:
      "Filter catalog SKUs by name, active ingredient, or code...",
    emptyInventory: "No inventory items match this view.",
    leftWord: "left",
    unitsPlus10: "+10 Units",
    editStockPriceAria: "Edit stock and price for",
    exactStockLabel: "Exact Stock",
    saveBtn: "Save",
  },
  fr: {
    pharmacistHeading: "Comptoir Pharmacien QR & Livraison",
    pharmacistGuest: "Espace Pharmacien",
    customerGuest: "Parcourir l'Officine",
    refreshAria: "Actualiser le catalogue",
    refreshBtn: "Actualiser",
    surfaceTitle: "Officines de Garde, Parapharmacie & Retrait QR",
    offlineBanner:
      "Service pharmacie indisponible actuellement. Le catalogue et le paiement nécessitent l'API en ligne.",
    retryBtn: "Réessayer",
    modesAria: "Vues pharmacie",
    tabStore: "Catalogue & Panier",
    tabOrders: "Commandes & Reçus",
    tabDispense: "Validation Ordonnance QR",
    tabManage: "Gestion des Stocks",
    cartSwitchedPrefix: "Panier transféré vers",
    categories: {
      OTC_MEDICATION: "Sans Ordonnance",
      PRESCRIPTION_RX: "Sur Ordonnance Rx",
      MEDICAL_DEVICE: "Dispositifs Médicaux",
      WELLNESS_SUPPLEMENT: "Compléments",
      PEDIATRIC_CARE: "Pédiatrie",
      COLD_CHAIN: "Chaîne du Froid 2-8°C",
    },
    guidance: {
      OTC_MEDICATION:
        "Formule en vente libre validée par des pharmaciens diplômés.",
      PRESCRIPTION_RX:
        "La délivrance exige une e-ordonnance QR signée par un médecin.",
      MEDICAL_DEVICE:
        "Matériel médical calibré pour le suivi à domicile ou en clinique.",
      WELLNESS_SUPPLEMENT:
        "Complément nutritionnel ou soin de soutien de qualité officinale.",
      PEDIATRIC_CARE:
        "Adapté aux soins pédiatriques ; vérifiez la posologie selon le poids.",
      COLD_CHAIN:
        "Produit biologique 2-8°C expédié en pochette isotherme réfrigérée.",
    },
    fulfillment: {
      PHARMACY_PICKUP: "Retrait au Comptoir Pharmacie",
      COURIER_DELIVERY: "Coursier Médical Express",
    },
    paymentMethods: {
      CARD_SIMULATED: "Carte Bancaire / Reçu Immédiat",
      INSURANCE_COPAY: "Tiers Payant / Mutuelle",
      CASH_ON_DELIVERY: "Espèces à la Livraison / Comptoir",
    },
    orderStatus: {
      PENDING_PAYMENT: { label: "En attente de paiement", tone: "amber" },
      PAID: { label: "Payée · Reçue en officine", tone: "teal" },
      PREPARING: { label: "En préparation", tone: "amber" },
      OUT_FOR_DELIVERY: { label: "Coursier en route", tone: "teal" },
      DELIVERED: { label: "Livrée / Terminée", tone: "emerald" },
      CANCELLED: { label: "Annulée · Remise en stock", tone: "red" },
    },
    licensePrefix: "Agrément",
    clearSearchAria: "Effacer la recherche",
    facilityFilterAria: "Filtrer par pharmacie",
    allPharmaciesOption: "Toutes les pharmacies",
    allCategoriesBtn: "Toutes catégories",
    allTypesChip: "Tous types",
    otcReadyChip: "Sans ordonnance",
    rxOnlyChip: "Ordonnance Rx",
    inStockOnlyChip: "En stock uniquement",
    itemsWord: "articles",
    itemWord: "article",
    sortAria: "Trier les produits",
    sortRecommended: "Recommandés",
    sortPriceAsc: "Prix croissant",
    sortPriceDesc: "Prix décroissant",
    sortNameAsc: "Nom A à Z",
    emptyFilterPrefix: "Aucun article ne correspond à votre filtre en",
    emptyFilterHint: "Effacez la recherche ou affichez toutes les catégories.",
    resetCatalogBtn: "Réinitialiser les filtres",
    rxRequiredBadge: "Ordonnance Rx",
    otcShortBadge: "Libre",
    detailsForAriaPrefix: "Détails pour",
    detailsBtn: "Détails",
    qrRxTooltip: "Exige une ordonnance QR signée lors de la validation",
    qrRxShort: "QR Rx",
    outOfStock: "Rupture de stock",
    onlyLeftPrefix: "Plus que",
    onlyLeftSuffix: "en stock",
    inStockSuffix: "disponibles",
    decreasePrefix: "Diminuer",
    increasePrefix: "Augmenter",
    inCartSuffix: "dans le panier",
    clearBagBtn: "Vider",
    switchCartPrefix: "Changer de pharmacie vers",
    switchCartBodyPrefix:
      "Chaque commande est préparée par une seule officine. Ce changement remplacera votre panier par",
    switchAndAddBtn: "Changer & Ajouter",
    keepBagBtn: "Garder le panier",
    fulfillingViaPrefix: "Préparé par",
    bagHintPickup: "• Retrait gratuit au comptoir (~20 min).",
    bagHintCourier: "• Livraison rapide par coursier avec suivi GPS.",
    bagHintRx: "• Les médicaments Rx vérifient votre ordonnance QR.",
    removeItemAria: "Retirer l'article",
    attachRxHeading: "Joindre une Ordonnance QR (Requise)",
    signInWord: "Connectez-vous",
    toAttachRxSuffix: "pour joindre votre ordonnance QR médicale.",
    noActiveRxPrefix: "Aucune ordonnance active disponible.",
    bookConsultLink: "Consulter un médecin",
    toReceiveRxSuffix: "pour obtenir une e-ordonnance QR.",
    selectIssuedRxOption: "-- Choisir une ordonnance --",
    pharmacyPickupTitle: "Retrait en Pharmacie",
    freeCounterSub: "Gratuit · Comptoir",
    courierDispatchTitle: "Coursier Express",
    pickupOnlyRxSub: "Retrait uniquement (Rx)",
    calculatedAtCheckout: "Calculé au panier",
    defaultRegulationTitle: "Réglementation Officinale",
    rxPickupNotice:
      "Les médicaments sur ordonnance exigent un retrait en personne au comptoir. Retirez les articles Rx si vous souhaitez une livraison.",
    deliveryAddressLabel: "Adresse de Livraison",
    detectingGps: "Localisation...",
    autoGpsPin: "Position GPS",
    addressPlaceholder: "Rue, immeuble, étage...",
    gpsLockedPrefix: "GPS verrouillé",
    gpsLockedSuffix: "pour le coursier",
    paymentChannelLabel: "Mode de Paiement",
    activePolicyLabel: "Contrat actif :",
    noInsurancePrefix: "Aucune mutuelle enregistrée — gérez vos cartes dans",
    myCareLink: "Mon Espace Santé",
    pharmacistNoteLabel: "Note pour le pharmacien (facultatif)",
    pharmacistNotePlaceholder: "Allergie ou instructions d'accès",
    subtotalLabel: "Sous-total",
    courierFeeLabel: "Frais coursier",
    freeWord: "Gratuit",
    quotedByServer: "Calculé à l'étape suivante",
    totalLabel: "Total",
    processingCheckout: "Validation en cours...",
    inBagWord: "au panier",
    reviewCheckout: "Voir le panier →",
    ordersSubtitle:
      "Suivi en temps réel de préparation, livraison coursier et reçus détaillés.",
    filterAllPrefix: "Toutes",
    filterActive: "En cours",
    filterDelivered: "Livrées",
    filterCancelled: "Annulées",
    officialReceiptPrefix: "REÇU OFFICIEL PHARMACIE",
    issuedPrefix: "Émis le",
    printReceiptBtn: "Imprimer le reçu",
    closeBtn: "Fermer",
    patientLabel: "Patient :",
    pharmacyLabel: "Pharmacie :",
    channelLabel: "Paiement :",
    pendingWord: "En attente",
    courierShortLabel: "Coursier :",
    totalPaidLabel: "Total payé :",
    noOrdersYet: "Aucune commande pharmacie pour l'instant.",
    noMatchingOrders: "Aucune commande ne correspond à ce filtre.",
    orderNumberPrefix: "Commande n°",
    qrRxLinkedBadge: "Ordonnance QR liée",
    trackCourierBtn: "Suivre le coursier",
    receiptBtn: "Reçu",
    prepareBtn: "Préparer",
    dispatchCourierBtn: "Envoyer coursier",
    markDeliveredBtn: "Marquer livrée",
    cancelBtn: "Annuler",
    stepPaid: "Payée",
    stepPreparing: "Préparation",
    stepEnRoute: "En livraison",
    stepDelivered: "Livrée",
    stepCompleted: "Retirée",
    modalProductDetailsAria: "Détails produit",
    modalCloseAria: "Fermer la fiche produit",
    modalRxBadge: "Ordonnance Médicale Requise",
    modalOtcBadge: "Vente Libre Validée",
    modalColdChainBadge: "Chaîne Froid 2-8°C",
    modalActiveIngredient: "Principe Actif",
    modalFormStrength: "Forme & Dosage",
    modalAvailability: "Disponibilité",
    modalUnitsReadySuffix: "unités prêtes",
    modalDispensingGuidanceHeading: "Conseil Officinal de Délivrance",
    modalAcceptedCoverage: "Mutuelles acceptées :",
    modalUnitPriceLabel: "Prix unitaire",
    modalDecreaseQtyAria: "Réduire la quantité",
    modalIncreaseQtyAria: "Augmenter la quantité",
    modalMaxInCart: "Maximum atteint",
    modalAddPrefix: "Ajouter",
    modalToCartSuffix: "au panier",
    dispenseDeskTitle: "Comptoir de Vérification Ordonnance QR",
    dispenseDeskSub:
      "Scannez ou collez le jeton QR signé avant de délivrer les médicaments.",
    qrTokenLabel: "Code QR Ordonnance",
    verifyQrBtn: "Vérifier l'ordonnance QR",
    prescriberLabel: "Prescripteur :",
    daysWord: "jours",
    clinicalNotePrefix: "Note clinique :",
    dispensingNoteLabel: "Note de délivrance / lot (facultatif)",
    dispensingNotePlaceholder: "N° de lot / Substitution / Conseil patient",
    confirmDispenseBtn: "Confirmer la délivrance",
    dispensingRecordPrefix: "Dossier de délivrance :",
    activeQueueHeading: "Ordonnances QR en file d'attente",
    readyToDispenseWord: "prêtes",
    completedWord: "délivrées",
    queueFilterAll: "Toutes",
    queueFilterReady: "Prêtes",
    queueFilterDispensed: "Délivrées",
    queueSearchPlaceholder: "Patient, médecin ou médicament...",
    queueEmptyNone:
      "Aucune ordonnance en attente. Les médecins émettent leurs QR depuis /clinical.",
    queueEmptyFiltered: "Aucune ordonnance correspondante.",
    kpiActiveSkus: "Références actives",
    kpiLowStock: "Stock faible (<= 10)",
    kpiOutOfStock: "Ruptures de stock",
    kpiRxControlled: "Sous ordonnance Rx",
    addMedHeading: "Ajouter un médicament au catalogue",
    skuPlaceholder: "Code SKU (ex: MA-AZITH-500)",
    medNamePlaceholder: "Nom du médicament / produit",
    genericPlaceholder: "DCI / Principe actif (facultatif)",
    dosageFormPlaceholder: "Forme (ex: Boîte / 16 comprimés)",
    strengthPlaceholder: "Dosage (ex: 500 mg)",
    priceWord: "Prix",
    initialStockPlaceholder: "Stock initial",
    requiresRxLabel: "Exige une ordonnance médicale QR (Rx)",
    addCatalogBtn: "Ajouter au catalogue",
    liveInventoryHeading: "Gestion des Stocks en Direct",
    lowOutOnlyBtn: "Stock faible / Rupture",
    filterInventoryPlaceholder: "Filtrer par nom, principe actif ou code SKU...",
    emptyInventory: "Aucun article dans cette vue.",
    leftWord: "restants",
    unitsPlus10: "+10 unités",
    editStockPriceAria: "Modifier prix et stock pour",
    exactStockLabel: "Stock exact",
    saveBtn: "Enregistrer",
  },
  ar: {
    pharmacistHeading: "مكتب الصيدلي لصرف الوصفات والتوصيل",
    pharmacistGuest: "منصة الصيدلي",
    customerGuest: "تصفح الصيدلية",
    refreshAria: "تحديث القائمة",
    refreshBtn: "تحديث",
    surfaceTitle: "صيدليات الحراسة، شبه الصيدلية وصرف الوصفات QR",
    offlineBanner:
      "تعذر الاتصال بخدمة الصيدلية حالياً. يتطلب عرض الأدوية والطلب اتصالاً مباشراً بالخادم.",
    retryBtn: "إعادة المحاولة",
    modesAria: "أقسام الصيدلية",
    tabStore: "الأدوية والطلب",
    tabOrders: "طلباتي والفواتير",
    tabDispense: "فحص وصفة QR",
    tabManage: "تسيير المخزون",
    cartSwitchedPrefix: "تم تحويل السلة إلى",
    categories: {
      OTC_MEDICATION: "بدون وصفة طبية",
      PRESCRIPTION_RX: "أدوية بوصفة طبية",
      MEDICAL_DEVICE: "أجهزة طبية",
      WELLNESS_SUPPLEMENT: "فيتامينات ومكملات",
      PEDIATRIC_CARE: "عناية بالأطفال",
      COLD_CHAIN: "أدوية مبردة 2-8°",
    },
    guidance: {
      OTC_MEDICATION: "أدوية وعلاجات آمنة بدون وصفة ومعتمدة من الصيادلة.",
      PRESCRIPTION_RX:
        "يتطلب صرف هذا الدواء وصفة طبية موقعة برمز QR من الطبيب.",
      MEDICAL_DEVICE: "أجهزة طبية معايرة للفحص والقياس داخل البيت أو العيادة.",
      WELLNESS_SUPPLEMENT: "مكملات غذائية وعناية يومية بجودة صيدلانية.",
      PEDIATRIC_CARE: "منتج مخصص للأطفال والرضع؛ تأكد من الجرعة حسب الوزن.",
      COLD_CHAIN:
        "دواء حساس للحرارة (2-8°م) يُحفظ ويُسلم داخل حافظات مبردة.",
    },
    fulfillment: {
      PHARMACY_PICKUP: "الاستلام من الصيدلية",
      COURIER_DELIVERY: "توصيل طبي سريع للبيت",
    },
    paymentMethods: {
      CARD_SIMULATED: "أداء بالبطاقة / فاتورة فورية",
      INSURANCE_COPAY: "التغطية الصحية / التأمين",
      CASH_ON_DELIVERY: "نقداً عند الاستلام",
    },
    orderStatus: {
      PENDING_PAYMENT: { label: "في انتظار الأداء", tone: "amber" },
      PAID: { label: "تم الأداء · وصل للصيدلية", tone: "teal" },
      PREPARING: { label: "قيد التحضير", tone: "amber" },
      OUT_FOR_DELIVERY: { label: "الموزع في الطريق", tone: "teal" },
      DELIVERED: { label: "تم التسليم بنجاح", tone: "emerald" },
      CANCELLED: { label: "ملغى · أُعيد للمخزون", tone: "red" },
    },
    licensePrefix: "ترخيص",
    clearSearchAria: "مسح البحث",
    facilityFilterAria: "اختر الصيدلية",
    allPharmaciesOption: "كل الصيدليات",
    allCategoriesBtn: "كل الأقسام",
    allTypesChip: "كل الأنواع",
    otcReadyChip: "بدون وصفة",
    rxOnlyChip: "بوصفة طبية",
    inStockOnlyChip: "المتوفر فقط",
    itemsWord: "منتجات",
    itemWord: "منتج",
    sortAria: "ترتيب المنتجات",
    sortRecommended: "الموصى به",
    sortPriceAsc: "الثمن: من الأرخص",
    sortPriceDesc: "الثمن: من الأغلى",
    sortNameAsc: "الاسم: أ إلى ي",
    emptyFilterPrefix: "لا توجد أدوية مطابقة لهذا البحث في",
    emptyFilterHint: "امسح البحث أو ارجع إلى كل الأقسام.",
    resetCatalogBtn: "إرجاع كل الأدوية",
    rxRequiredBadge: "يتطلب وصفة",
    otcShortBadge: "حر",
    detailsForAriaPrefix: "تفاصيل",
    detailsBtn: "التفاصيل",
    qrRxTooltip: "يتطلب إرفاق وصفة طبية برمز QR عند التأكيد",
    qrRxShort: "وصفة QR",
    outOfStock: "نفد المخزون",
    onlyLeftPrefix: "بقي فقط",
    onlyLeftSuffix: "علب",
    inStockSuffix: "متوفرة",
    decreasePrefix: "نقص",
    increasePrefix: "زِد",
    inCartSuffix: "في السلة",
    clearBagBtn: "تفريغ",
    switchCartPrefix: "تغيير السلة إلى",
    switchCartBodyPrefix:
      "يتم تجهيز كل طلب من صيدلية واحدة. التغيير سيستبدل سلتك الحالية بـ",
    switchAndAddBtn: "تبديل وإضافة",
    keepBagBtn: "إبقاء السلة",
    fulfillingViaPrefix: "من صيدلية",
    bagHintPickup: "• الاستلام من الصيدلية مجاني (~20 دقيقة).",
    bagHintCourier: "• توصيل سريع للبيت مع تتبع مباشر.",
    bagHintRx: "• الأدوية بوصفة تتحقق من رمز QR الطبيب.",
    removeItemAria: "إزالة المنتج",
    attachRxHeading: "إرفاق الوصفة الطبية (ضروري للدواء)",
    signInWord: "سجل الدخول",
    toAttachRxSuffix: "لإرفاق وصفتك الطبية المعتمدة.",
    noActiveRxPrefix: "لا توجد وصفات فعالة في حسابك.",
    bookConsultLink: "احجز موعد طبيب",
    toReceiveRxSuffix: "للحصول على وصفة إلكترونية.",
    selectIssuedRxOption: "-- اختر الوصفة الطبية --",
    pharmacyPickupTitle: "سحب من الصيدلية",
    freeCounterSub: "مجاني · من الصيدلية",
    courierDispatchTitle: "توصيل للمنزل",
    pickupOnlyRxSub: "سحب مباشر فقط (وصفة)",
    calculatedAtCheckout: "يُحسب عند التأكيد",
    defaultRegulationTitle: "قانون صرف الأدوية",
    rxPickupNotice:
      "أدوية الوصفة الطبية تستوجب السحب حضورياً من الصيدلية المعتمدة. أزلها إن أردت التوصيل المنزلي للمنتجات الحرة فقط.",
    deliveryAddressLabel: "عنوان التوصيل",
    detectingGps: "تحديد الموقع...",
    autoGpsPin: "موقعي GPS",
    addressPlaceholder: "الحي، الشارع، العمارة، الطابق...",
    gpsLockedPrefix: "تم تحديد GPS",
    gpsLockedSuffix: "لتوجيه الموزع",
    paymentChannelLabel: "طريقة الأداء",
    activePolicyLabel: "بطاقة التأمين:",
    noInsurancePrefix: "لم تحفظ بطاقة تأمين بعد — أضفها في",
    myCareLink: "فضاء صحتي",
    pharmacistNoteLabel: "ملاحظة للصيدلي (اختياري)",
    pharmacistNotePlaceholder: "حساسية معينة أو توجيهات التوصيل",
    subtotalLabel: "المجموع الجزئي",
    courierFeeLabel: "واجب التوصيل",
    freeWord: "مجاني",
    quotedByServer: "يُحدد عند الطلب",
    totalLabel: "المجموع الكلي",
    processingCheckout: "جاري تأكيد الطلب...",
    inBagWord: "في السلة",
    reviewCheckout: "مراجعة الطلب ←",
    ordersSubtitle: "متابعة تجهيز الطلبات، التوصيل المباشر والفواتير الرسمية.",
    filterAllPrefix: "الكل",
    filterActive: "الجارية",
    filterDelivered: "المسلمة",
    filterCancelled: "الملغاة",
    officialReceiptPrefix: "وصل صيدلية رسمي",
    issuedPrefix: "صدر في",
    printReceiptBtn: "طباعة الوصل",
    closeBtn: "إغلاق",
    patientLabel: "المريض:",
    pharmacyLabel: "الصيدلية:",
    channelLabel: "الدفع:",
    pendingWord: "معلق",
    courierShortLabel: "التوصيل:",
    totalPaidLabel: "المبلغ المؤدى:",
    noOrdersYet: "لا توجد طلبات صيدلية مسجلة حالياً.",
    noMatchingOrders: "لا توجد طلبات مطابقة لهذا الفلتر.",
    orderNumberPrefix: "طلب رقم #",
    qrRxLinkedBadge: "وصفة QR مرفقة",
    trackCourierBtn: "تتبع الموزع",
    receiptBtn: "الفاتورة",
    prepareBtn: "تجهيز",
    dispatchCourierBtn: "إرسال مع الموزع",
    markDeliveredBtn: "تأكيد التسليم",
    cancelBtn: "إلغاء",
    stepPaid: "مؤدى",
    stepPreparing: "قيد التجهيز",
    stepEnRoute: "في الطريق",
    stepDelivered: "تم التسليم",
    stepCompleted: "مكتمل",
    modalProductDetailsAria: "تفاصيل الدواء",
    modalCloseAria: "إغلاق نافذة الدواء",
    modalRxBadge: "يتطلب وصفة طبية",
    modalOtcBadge: "متاح بدون وصفة",
    modalColdChainBadge: "حفظ مبرد 2-8°",
    modalActiveIngredient: "المادة الفعالة",
    modalFormStrength: "الشكل والتركيز",
    modalAvailability: "المخزون",
    modalUnitsReadySuffix: "وحدة جاهزة",
    modalDispensingGuidanceHeading: "إرشاد الصيدلي قبل الصرف",
    modalAcceptedCoverage: "التأمينات المقبولة:",
    modalUnitPriceLabel: "ثمن العلبة",
    modalDecreaseQtyAria: "نقص الكمية",
    modalIncreaseQtyAria: "زيادة الكمية",
    modalMaxInCart: "الحد الأقصى في السلة",
    modalAddPrefix: "أضف",
    modalToCartSuffix: "للسلة",
    dispenseDeskTitle: "مكتب فحص وصرف الوصفات برمز QR",
    dispenseDeskSub: "امسح أو الصق رمز الوصفة الموقع قبل تسليم الدواء.",
    qrTokenLabel: "رمز QR للوصفة",
    verifyQrBtn: "التحقق من الوصفة",
    prescriberLabel: "الطبيب الواصف:",
    daysWord: "أيام",
    clinicalNotePrefix: "ملاحظة الطبيب:",
    dispensingNoteLabel: "ملاحظة الصرف / رقم الدفعة (اختياري)",
    dispensingNotePlaceholder: "رقم الدفعة / بديل جنيس / نصيحة للمريض",
    confirmDispenseBtn: "تأكيد صرف الدواء",
    dispensingRecordPrefix: "سجل الصرف:",
    activeQueueHeading: "الوصفات الطبية في الانتظار",
    readyToDispenseWord: "جاهزة للصرف",
    completedWord: "مصروفة",
    queueFilterAll: "الكل",
    queueFilterReady: "جاهزة",
    queueFilterDispensed: "مصروفة",
    queueSearchPlaceholder: "ابحث بالمريض، الطبيب أو الدواء...",
    queueEmptyNone:
      "لا توجد وصفات في الانتظار حالياً. يُصدر الأطباء الوصفات من فضاء الطبيب.",
    queueEmptyFiltered: "لا توجد وصفات مطابقة للبحث.",
    kpiActiveSkus: "الأدوية المسجلة",
    kpiLowStock: "مخزون منخفض (<= 10)",
    kpiOutOfStock: "نفد المخزون",
    kpiRxControlled: "أدوية بوصفة",
    addMedHeading: "إضافة دواء جديد للمخزون",
    skuPlaceholder: "رمز SKU (مثال: MA-AZITH-500)",
    medNamePlaceholder: "اسم الدواء أو المنتج",
    genericPlaceholder: "المادة الفعالة (اختياري)",
    dosageFormPlaceholder: "الشكل (مثال: علبة / 16 قرص)",
    strengthPlaceholder: "التركيز (مثال: 500 ملغ)",
    priceWord: "الثمن",
    initialStockPlaceholder: "الكمية الأولية",
    requiresRxLabel: "يتطلب وصفة طبية إلكترونية (Rx)",
    addCatalogBtn: "إضافة إلى قائمة الصيدلية",
    liveInventoryHeading: "مراقبة وتعديل المخزون المباشر",
    lowOutOnlyBtn: "المنخفض والمنتهي فقط",
    filterInventoryPlaceholder: "تصفية بالاسم، المادة الفعالة أو الرمز...",
    emptyInventory: "لا توجد منتجات مطابقة.",
    leftWord: "متبقية",
    unitsPlus10: "+10 وحدات",
    editStockPriceAria: "تعديل المخزون والثمن لـ",
    exactStockLabel: "الكمية الدقيقة",
    saveBtn: "حفظ",
  },
};
