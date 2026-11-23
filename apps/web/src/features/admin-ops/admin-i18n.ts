import type { LocaleCode } from "@medisync/contracts";

export interface AdminCopy {
  header: {
    guestLabel: string;
    jurisdictionAria: string;
    allRegionsOption: string;
    hospitalReceptionLink: string;
    refreshBtn: string;
    signInBtn: string;
    guardTitle: string;
    guardRoles: string;
    guardPrimaryBtn: string;
    overviewMetricsAria: string;
    tabsAria: string;
  };
  kpis: {
    pendingStaffVerify: string;
    totalUsersDetail: (count: number) => string;
    pendingLicenses: string;
    totalFacilitiesDetail: (count: number) => string;
    syncRequired: string;
    activeDispatches: string;
    liveEmsDetail: string;
    bookedVisits: string;
    confirmedCheckedInDetail: string;
    issuedRxQr: string;
    awaitingPharmacyDetail: string;
    openLabOrders: string;
    orderedSampledDetail: string;
    openDisputes: string;
    disputesQueueDetail: string;
  };
  tabs: {
    overview: string;
    facilities: (count: number) => string;
    users: (count: number) => string;
    dispatches: (count: number) => string;
    disputes: (count: number) => string;
    audit: (count: number) => string;
  };
  overview: {
    pendingQueueTitle: (count: number) => string;
    pendingQueueSubtitle: string;
    openStaffQueueBtn: string;
    statusPrefix: string;
    inspectCredentialsBtn: string;
    rejectSuspendBtn: string;
    verifyActivateBtn: string;
    recentActivityTitle: string;
    tamperEvidentBadge: string;
    auditOnPrefix: string;
    auditActorPrefix: string;
    emptyOverviewHint: string;
  };
  facilities: {
    heading: string;
    showingCount: (shown: number, total: number) => string;
    searchPlaceholder: string;
    searchAria: string;
    kindAria: string;
    allTypesOption: string;
    hospitalsOption: string;
    clinicsOption: string;
    pharmaciesOption: string;
    labsOption: string;
    filterAll: string;
    filterPending: string;
    filterVerified: string;
    filterSuspended: string;
    emptyFilter: string;
    licensePrefix: string;
    verifyBtn: string;
    suspendBtn: string;
    submittedDocsTitle: (count: number) => string;
    inspectBtn: string;
    approveBtn: string;
    rejectBtn: string;
  };
  users: {
    heading: (count: number) => string;
    roleReasonAria: string;
    roleReasonPlaceholder: string;
    defaultRoleReason: string;
    provisionBtn: string;
    searchPlaceholder: string;
    searchAria: string;
    roleFilterAria: string;
    allRolesOption: string;
    filterAllStatuses: string;
    filterPending: string;
    filterActive: string;
    filterSuspended: string;
    emptyFilter: string;
    noEmail: string;
    statusPendingApproval: string;
    statusSuspended: string;
    statusVerifiedActive: string;
    statusActive: string;
    credentialsBtn: string;
    inspectBtn: string;
    approveBtn: string;
    rejectBtn: string;
    roleSelectAria: (name: string) => string;
    countrySelectAria: (name: string) => string;
    facilitySelectAria: (name: string) => string;
    noFacilityLinkedOption: string;
    selfDemotionBlocked: string;
    applyRoleBtn: string;
    verifyActivateBtn: string;
    reactivateBtn: string;
    suspendBtn: string;
  };
  dispatches: {
    heading: string;
    empty: string;
    statusSelectAria: (id: string) => string;
    driverSelectAria: (id: string) => string;
    keepUnassignedOption: string;
    overridePlaceholder: string;
    commitBtn: string;
    facilityPrefix: string;
    dispatchPrefix: string;
  };
  disputes: {
    formHeading: string;
    categoryLabel: string;
    targetLabel: string;
    targetPlaceholder: string;
    targetEmpty: string;
    subjectLabel: string;
    subjectPlaceholder: string;
    descriptionLabel: string;
    descriptionPlaceholder: string;
    submitBtn: string;
    queueHeading: (count: number) => string;
    filterAll: string;
    empty: string;
    reporterPrefix: string;
    resolutionNotePrefix: string;
    resolutionPlaceholder: string;
    markUnderReviewBtn: string;
    resolveBtn: string;
    dismissBtn: string;
  };
  audit: {
    heading: (count: number) => string;
    exportCsvBtn: string;
    allActionsBtn: string;
    actionInputPlaceholder: string;
    resourceInputPlaceholder: string;
    applyFilterBtn: string;
    empty: string;
    actorPrefix: string;
  };
  signInModal: {
    ariaLabel: string;
    title: string;
    closeAria: string;
    emailLabel: string;
    passwordLabel: string;
    passwordPlaceholder: string;
    cancelBtn: string;
    verifyingBtn: string;
    submitBtn: string;
  };
  provisionModal: {
    ariaLabel: string;
    title: string;
    closeAria: string;
    fullNameLabel: string;
    workEmailLabel: string;
    accountRoleLabel: string;
    countryLabel: string;
    tempPasswordLabel: string;
    tempPasswordPlaceholder: string;
    mobilePhoneLabel: string;
    primaryFacilityLabel: (country: string) => string;
    unassignedOption: string;
    preVerifyLabel: string;
    cancelBtn: string;
    submittingBtn: string;
    submitBtn: string;
    failedMsg: (err: string) => string;
    successMsg: (name: string, roleLabel: string, country: string) => string;
  };
  enums: {
    facilityVerification: Record<string, string>;
    reviewStatus: Record<string, string>;
    accountStatus: Record<string, string>;
    disputeStatus: Record<string, string>;
    disputeCategory: Record<string, string>;
  };
  messages: {
    docReviewFailed: (err: string) => string;
    docMarked: (file: string, status: string) => string;
    credReviewFailed: (err: string) => string;
    invalidLoginInput: string;
    authUnreachable: string;
    authFailed: (err: string) => string;
    signedInMsg: (name: string, role: string, country: string) => string;
    signedOutRevoked: string;
    facilityStatusRejected: (err: string) => string;
    facilityStatusUpdated: (name: string, status: string) => string;
    roleUpdateRejected: (err: string) => string;
    roleReassigned: (name: string, role: string, country: string) => string;
    staffVerifyFailed: (err: string) => string;
    staffVerifyUpdated: (
      name: string,
      roleLabel: string,
      status: string,
      verified: boolean,
    ) => string;
    dispatchOverrideFailed: (err: string) => string;
    dispatchOverridden: (shortId: string, status: string) => string;
    disputeFilingFailed: (err: string) => string;
    disputeLogged: (subject: string, status: string) => string;
    disputeResolveFailed: (err: string) => string;
    disputeTransitioned: (shortId: string, status: string) => string;
    auditQueryFailed: (err: string) => string;
  };
}

export const ADMIN_COPY: Record<LocaleCode, AdminCopy> = {
  en: {
    header: {
      guestLabel: "Operations Gate",
      jurisdictionAria: "Jurisdiction scope",
      allRegionsOption: "All Regions",
      hospitalReceptionLink: "Hospital Reception →",
      refreshBtn: "Refresh Live Status",
      signInBtn: "Admin Sign In",
      guardTitle: "Master Operations & Compliance Center",
      guardRoles: "Platform Operations & Hospital Administrators",
      guardPrimaryBtn: "Sign In as Operations Admin",
      overviewMetricsAria: "Operational overview metrics",
      tabsAria: "Admin workspace views",
    },
    kpis: {
      pendingStaffVerify: "Pending Staff Verify",
      totalUsersDetail: (count) => `${count} total users`,
      pendingLicenses: "Pending Licenses",
      totalFacilitiesDetail: (count) => `${count} total facilities`,
      syncRequired: "Sync required",
      activeDispatches: "Active Dispatches",
      liveEmsDetail: "Live EMS pipeline",
      bookedVisits: "Booked Visits",
      confirmedCheckedInDetail: "Confirmed & checked-in",
      issuedRxQr: "Issued Rx QR",
      awaitingPharmacyDetail: "Awaiting pharmacy scan",
      openLabOrders: "Open Lab Orders",
      orderedSampledDetail: "Ordered or sampled",
      openDisputes: "Open Disputes",
      disputesQueueDetail: "Safety & service quality queue",
    },
    tabs: {
      overview: "Overview",
      facilities: (count) => `Facilities (${count})`,
      users: (count) => `Staff & Users (${count})`,
      dispatches: (count) => `Dispatches (${count})`,
      disputes: (count) => `Disputes (${count})`,
      audit: (count) => `Activity Log (${count})`,
    },
    overview: {
      pendingQueueTitle: (count) => `Pending Staff Verification Queue (${count})`,
      pendingQueueSubtitle:
        "Self-registered healthcare staff waiting for Admin verification before booking, dispensing, or dispatch unlocks.",
      openStaffQueueBtn: "Open Staff Queue",
      statusPrefix: "Status:",
      inspectCredentialsBtn: "Inspect Credentials",
      rejectSuspendBtn: "Reject / Suspend",
      verifyActivateBtn: "Verify & Activate",
      recentActivityTitle: "Recent Activity & Compliance Log",
      tamperEvidentBadge: "Tamper-evident record",
      auditOnPrefix: "on",
      auditActorPrefix: "Actor",
      emptyOverviewHint:
        "Sign in as a Platform Admin or Hospital Admin and click Refresh to inspect live network activity and metrics.",
    },
    facilities: {
      heading: "License Verification & Suspension",
      showingCount: (shown, total) => `Showing ${shown} of ${total}`,
      searchPlaceholder: "Filter by facility name, license, or street...",
      searchAria: "Search facilities",
      kindAria: "Filter facility kind",
      allTypesOption: "All Types",
      hospitalsOption: "Hospitals",
      clinicsOption: "Clinics",
      pharmaciesOption: "Pharmacies",
      labsOption: "Diagnostic Labs",
      filterAll: "All",
      filterPending: "Pending Review",
      filterVerified: "Verified",
      filterSuspended: "Suspended",
      emptyFilter: "No facilities match the active filter in this scope.",
      licensePrefix: "License",
      verifyBtn: "Verify",
      suspendBtn: "Suspend",
      submittedDocsTitle: (count) =>
        `Submitted Certifications & Photos (${count})`,
      inspectBtn: "Inspect",
      approveBtn: "Approve",
      rejectBtn: "Reject",
    },
    users: {
      heading: (count) => `Team Roles & Regional Access (${count})`,
      roleReasonAria: "Audit reason for role changes",
      roleReasonPlaceholder: "Reason recorded in audit log",
      defaultRoleReason: "Standard permission review",
      provisionBtn: "Provision Staff Account",
      searchPlaceholder: "Search user name, email, phone, or UUID...",
      searchAria: "Search staff and users",
      roleFilterAria: "Filter users by role",
      allRolesOption: "All Roles",
      filterAllStatuses: "All Statuses",
      filterPending: "Pending",
      filterActive: "Active",
      filterSuspended: "Suspended",
      emptyFilter: "No user directory rows match your filter in this scope.",
      noEmail: "No email",
      statusPendingApproval: "Pending Approval",
      statusSuspended: "Suspended",
      statusVerifiedActive: "Verified & Active",
      statusActive: "Active",
      credentialsBtn: "Credentials",
      inspectBtn: "Inspect",
      approveBtn: "Approve",
      rejectBtn: "Reject",
      roleSelectAria: (name) => `Role for ${name}`,
      countrySelectAria: (name) => `CountryCode for ${name}`,
      facilitySelectAria: (name) => `Facility for ${name}`,
      noFacilityLinkedOption: "No Facility Linked",
      selfDemotionBlocked: "Self-Demotion Blocked",
      applyRoleBtn: "Apply Role",
      verifyActivateBtn: "Verify & Activate",
      reactivateBtn: "Reactivate",
      suspendBtn: "Suspend",
    },
    dispatches: {
      heading: "Live Dispatch Manual Overrides",
      empty: "No active medical transport requests in this region.",
      statusSelectAria: (id) => `Override status for ${id}`,
      driverSelectAria: (id) => `Assign driver for ${id}`,
      keepUnassignedOption: "Keep / Unassigned",
      overridePlaceholder: "Override note (min 3 chars)",
      commitBtn: "Commit Override",
      facilityPrefix: "Facility:",
      dispatchPrefix: "Dispatch:",
    },
    disputes: {
      formHeading: "Report Care Issue or Service Dispute",
      categoryLabel: "Category",
      targetLabel: "Affected Facility or Dispatch (Optional)",
      targetPlaceholder: "Filter by facility or dispatch...",
      targetEmpty: "General platform incident",
      subjectLabel: "Subject",
      subjectPlaceholder: "Summary of clinical, dispatch, or compliance issue",
      descriptionLabel: "Detailed Incident Description",
      descriptionPlaceholder: "Provide timeline, facility, or incident details...",
      submitBtn: "Submit Dispute Ticket",
      queueHeading: (count) => `Active Disputes Queue (${count})`,
      filterAll: "All",
      empty: "No disputes recorded in this scope.",
      reporterPrefix: "Reporter",
      resolutionNotePrefix: "Resolution Note:",
      resolutionPlaceholder: "Resolution decision note...",
      markUnderReviewBtn: "Mark Under Review",
      resolveBtn: "Resolve",
      dismissBtn: "Dismiss",
    },
    audit: {
      heading: (count) => `Searchable Activity Log (${count})`,
      exportCsvBtn: "Export CSV",
      allActionsBtn: "All Actions",
      actionInputPlaceholder: "Filter action (e.g. USER_ROLE_UPDATED)",
      resourceInputPlaceholder: "Resource type (e.g. dispatch_request)",
      applyFilterBtn: "Apply Audit Filter",
      empty: "No audit events match the active filter.",
      actorPrefix: "Actor",
    },
    signInModal: {
      ariaLabel: "Operations Sign In",
      title: "Sign In for Operations",
      closeAria: "Close sign in dialog",
      emailLabel: "Email Address",
      passwordLabel: "Password",
      passwordPlaceholder: "Minimum 10 characters",
      cancelBtn: "Cancel",
      verifyingBtn: "Verifying...",
      submitBtn: "Sign In to Admin Desk",
    },
    provisionModal: {
      ariaLabel: "Provision Staff or Admin Account",
      title: "Provision Staff or Admin Account",
      closeAria: "Close provision dialog",
      fullNameLabel: "Full Name *",
      workEmailLabel: "Work Email *",
      accountRoleLabel: "Account Role *",
      countryLabel: "Jurisdiction / Country *",
      tempPasswordLabel: "Temporary Password * (min 8 chars)",
      tempPasswordPlaceholder: "Min 8 characters",
      mobilePhoneLabel: "Mobile Phone (Optional)",
      primaryFacilityLabel: (country) => `Primary Workplace Facility (${country})`,
      unassignedOption: "Independent / Unassigned",
      preVerifyLabel: "Pre-verify ministry credentials on creation",
      cancelBtn: "Cancel",
      submittingBtn: "Creating Account...",
      submitBtn: "Provision Account",
      failedMsg: (err) => `Staff provisioning failed (${err}).`,
      successMsg: (name, roleLabel, country) =>
        `Provisioned ${name} (${roleLabel} · ${country}).`,
    },
    enums: {
      facilityVerification: {
        PENDING_REVIEW: "PENDING_REVIEW",
        VERIFIED: "VERIFIED",
        SUSPENDED: "SUSPENDED",
      },
      reviewStatus: {
        PENDING: "PENDING",
        APPROVED: "APPROVED",
        REJECTED: "REJECTED",
      },
      accountStatus: {
        PENDING_APPROVAL: "PENDING_APPROVAL",
        ACTIVE: "ACTIVE",
        SUSPENDED: "SUSPENDED",
      },
      disputeStatus: {
        OPEN: "OPEN",
        UNDER_REVIEW: "UNDER_REVIEW",
        RESOLVED: "RESOLVED",
        DISMISSED: "DISMISSED",
      },
      disputeCategory: {
        DISPATCH_DELAY: "DISPATCH_DELAY",
        NO_SHOW: "NO_SHOW",
        BILLING: "BILLING",
        CLINICAL_QUALITY: "CLINICAL_QUALITY",
        PHARMACY_ISSUE: "PHARMACY_ISSUE",
        PRIVACY_CONCERN: "PRIVACY_CONCERN",
        OTHER: "OTHER",
      },
    },
    messages: {
      docReviewFailed: (err) => `Document review failed: ${err}`,
      docMarked: (file, status) => `${file} marked ${status}.`,
      credReviewFailed: (err) => `Credential review failed: ${err}`,
      invalidLoginInput: "Enter a valid operator email address and password.",
      authUnreachable:
        "Authentication service is temporarily unreachable. Please try again shortly.",
      authFailed: (err) => `Authentication failed (${err}).`,
      signedInMsg: (name, role, country) =>
        `Signed in as ${name} (${role} · ${country}).`,
      signedOutRevoked: "Signed out and revoked session token.",
      facilityStatusRejected: (err) =>
        `Facility status change rejected (${err}).`,
      facilityStatusUpdated: (name, status) =>
        `Updated "${name}" status to ${status}.`,
      roleUpdateRejected: (err) => `Role update rejected (${err}).`,
      roleReassigned: (name, role, country) =>
        `Reassigned ${name} to ${role} (${country}).`,
      staffVerifyFailed: (err) => `Staff verification update failed (${err}).`,
      staffVerifyUpdated: (name, roleLabel, status, verified) =>
        `${name} (${roleLabel}) is now ${status}${verified ? " & Credential Verified" : ""}.`,
      dispatchOverrideFailed: (err) => `Dispatch override failed (${err}).`,
      dispatchOverridden: (shortId, status) =>
        `Dispatch ${shortId} status updated to ${status} on live boards.`,
      disputeFilingFailed: (err) => `Dispute filing failed (${err}).`,
      disputeLogged: (subject, status) =>
        `Dispute "${subject}" logged (${status}).`,
      disputeResolveFailed: (err) => `Dispute resolution failed (${err}).`,
      disputeTransitioned: (shortId, status) =>
        `Dispute ${shortId} transitioned to ${status}.`,
      auditQueryFailed: (err) => `Audit query failed (${err}).`,
    },
  },
  fr: {
    header: {
      guestLabel: "Portail Opérations",
      jurisdictionAria: "Périmètre régional",
      allRegionsOption: "Toutes les Régions",
      hospitalReceptionLink: "Accueil Hôpital →",
      refreshBtn: "Actualiser le Statut",
      signInBtn: "Connexion Admin",
      guardTitle: "Centre de Pilotage & Conformité",
      guardRoles: "Administrateurs Plateforme & Coordinateurs Hôpitaux",
      guardPrimaryBtn: "Se connecter en Administrateur",
      overviewMetricsAria: "Indicateurs opérationnels",
      tabsAria: "Vues d'administration",
    },
    kpis: {
      pendingStaffVerify: "Pros à valider",
      totalUsersDetail: (count) => `${count} comptes au total`,
      pendingLicenses: "Agréments en attente",
      totalFacilitiesDetail: (count) => `${count} établissements`,
      syncRequired: "Synchro requise",
      activeDispatches: "Ambulances actives",
      liveEmsDetail: "Flux urgence en direct",
      bookedVisits: "Visites planifiées",
      confirmedCheckedInDetail: "Confirmées & arrivées",
      issuedRxQr: "Ordonnances QR",
      awaitingPharmacyDetail: "En attente officine",
      openLabOrders: "Bilans Labo ouverts",
      orderedSampledDetail: "Prescrits ou prélevés",
      openDisputes: "Litiges ouverts",
      disputesQueueDetail: "Qualité & conformité",
    },
    tabs: {
      overview: "Vue d'ensemble",
      facilities: (count) => `Établissements (${count})`,
      users: (count) => `Équipe & Comptes (${count})`,
      dispatches: (count) => `Transports (${count})`,
      disputes: (count) => `Signalements (${count})`,
      audit: (count) => `Journal d'Audit (${count})`,
    },
    overview: {
      pendingQueueTitle: (count) =>
        `File de Validation des Professionnels (${count})`,
      pendingQueueSubtitle:
        "Comptes médicaux en attente de validation administrative avant l'ouverture des plannings, officines ou courses.",
      openStaffQueueBtn: "Ouvrir la liste",
      statusPrefix: "Statut :",
      inspectCredentialsBtn: "Voir les justificatifs",
      rejectSuspendBtn: "Refuser / Suspendre",
      verifyActivateBtn: "Valider & Activer",
      recentActivityTitle: "Activité Récente & Journal de Conformité",
      tamperEvidentBadge: "Registre infalsifiable",
      auditOnPrefix: "sur",
      auditActorPrefix: "Acteur",
      emptyOverviewHint:
        "Connectez-vous en Administrateur puis actualisez pour consulter l'activité réseau.",
    },
    facilities: {
      heading: "Validation d'Agréments & Suspensions",
      showingCount: (shown, total) => `Affichage ${shown} sur ${total}`,
      searchPlaceholder: "Filtrer par nom, agrément ou adresse...",
      searchAria: "Rechercher un établissement",
      kindAria: "Filtrer par type",
      allTypesOption: "Tous types",
      hospitalsOption: "Hôpitaux",
      clinicsOption: "Cliniques",
      pharmaciesOption: "Pharmacies",
      labsOption: "Laboratoires",
      filterAll: "Tous",
      filterPending: "En révision",
      filterVerified: "Vérifiés",
      filterSuspended: "Suspendus",
      emptyFilter: "Aucun établissement ne correspond au filtre.",
      licensePrefix: "Agrément",
      verifyBtn: "Valider",
      suspendBtn: "Suspendre",
      submittedDocsTitle: (count) => `Pièces & Photos déposées (${count})`,
      inspectBtn: "Inspecter",
      approveBtn: "Approuver",
      rejectBtn: "Refuser",
    },
    users: {
      heading: (count) => `Rôles d'Équipe & Accès Régionaux (${count})`,
      roleReasonAria: "Motif d'audit du changement",
      roleReasonPlaceholder: "Motif inscrit au journal d'audit",
      defaultRoleReason: "Revue standard des permissions",
      provisionBtn: "Créer un Compte Pro",
      searchPlaceholder: "Rechercher nom, e-mail, téléphone ou ID...",
      searchAria: "Rechercher un utilisateur",
      roleFilterAria: "Filtrer par rôle",
      allRolesOption: "Tous les rôles",
      filterAllStatuses: "Tous statuts",
      filterPending: "En attente",
      filterActive: "Actifs",
      filterSuspended: "Suspendus",
      emptyFilter: "Aucun utilisateur ne correspond au filtre.",
      noEmail: "Aucun e-mail",
      statusPendingApproval: "En attente",
      statusSuspended: "Suspendu",
      statusVerifiedActive: "Vérifié & Actif",
      statusActive: "Actif",
      credentialsBtn: "Justificatifs",
      inspectBtn: "Inspecter",
      approveBtn: "Approuver",
      rejectBtn: "Refuser",
      roleSelectAria: (name) => `Rôle pour ${name}`,
      countrySelectAria: (name) => `Pays pour ${name}`,
      facilitySelectAria: (name) => `Établissement pour ${name}`,
      noFacilityLinkedOption: "Aucun rattachement",
      selfDemotionBlocked: "Auto-rétrogradation bloquée",
      applyRoleBtn: "Appliquer le rôle",
      verifyActivateBtn: "Valider & Activer",
      reactivateBtn: "Réactiver",
      suspendBtn: "Suspendre",
    },
    dispatches: {
      heading: "Régulation Manuelle des Ambulances",
      empty: "Aucune demande de transport médical active dans cette région.",
      statusSelectAria: (id) => `Modifier statut pour ${id}`,
      driverSelectAria: (id) => `Assigner ambulancier pour ${id}`,
      keepUnassignedOption: "Conserver / Non assigné",
      overridePlaceholder: "Motif d'intervention (min 3 car.)",
      commitBtn: "Appliquer",
      facilityPrefix: "Site :",
      dispatchPrefix: "Course :",
    },
    disputes: {
      formHeading: "Signaler un Incident ou Litige de Soin",
      categoryLabel: "Catégorie",
      targetLabel: "Établissement ou Transport concerné (Optionnel)",
      targetPlaceholder: "Filtrer par site ou transport...",
      targetEmpty: "Incident général sur la plateforme",
      subjectLabel: "Objet",
      subjectPlaceholder: "Résumé de l'incident clinique ou logistique",
      descriptionLabel: "Description détaillée",
      descriptionPlaceholder: "Chronologie, lieu et contexte complet...",
      submitBtn: "Soumettre le Signalement",
      queueHeading: (count) => `File des Signalements (${count})`,
      filterAll: "Tous",
      empty: "Aucun signalement dans cette zone.",
      reporterPrefix: "Déclarant",
      resolutionNotePrefix: "Décision :",
      resolutionPlaceholder: "Note de résolution...",
      markUnderReviewBtn: "Mettre en examen",
      resolveBtn: "Résoudre",
      dismissBtn: "Classer sans suite",
    },
    audit: {
      heading: (count) => `Journal d'Audit Recherchable (${count})`,
      exportCsvBtn: "Exporter CSV",
      allActionsBtn: "Toutes actions",
      actionInputPlaceholder: "Filtrer action (ex. USER_ROLE_UPDATED)",
      resourceInputPlaceholder: "Type de ressource (ex. dispatch_request)",
      applyFilterBtn: "Filtrer l'audit",
      empty: "Aucun événement ne correspond au filtre.",
      actorPrefix: "Acteur",
    },
    signInModal: {
      ariaLabel: "Connexion Opérations",
      title: "Connexion Administration",
      closeAria: "Fermer la fenêtre",
      emailLabel: "Adresse E-mail",
      passwordLabel: "Mot de passe",
      passwordPlaceholder: "Minimum 10 caractères",
      cancelBtn: "Annuler",
      verifyingBtn: "Vérification...",
      submitBtn: "Accéder au Centre Admin",
    },
    provisionModal: {
      ariaLabel: "Créer un Compte Professionnel ou Admin",
      title: "Créer un Compte Professionnel ou Admin",
      closeAria: "Fermer",
      fullNameLabel: "Nom complet *",
      workEmailLabel: "E-mail professionnel *",
      accountRoleLabel: "Rôle du compte *",
      countryLabel: "Pays / Juridiction *",
      tempPasswordLabel: "Mot de passe provisoire * (8 car. min.)",
      tempPasswordPlaceholder: "8 caractères minimum",
      mobilePhoneLabel: "Téléphone mobile (Optionnel)",
      primaryFacilityLabel: (country) => `Établissement de rattachement (${country})`,
      unassignedOption: "Indépendant / Non rattaché",
      preVerifyLabel: "Pré-valider les justificatifs ministériels à la création",
      cancelBtn: "Annuler",
      submittingBtn: "Création...",
      submitBtn: "Créer le Compte",
      failedMsg: (err) => `Échec création du compte (${err}).`,
      successMsg: (name, roleLabel, country) =>
        `Compte créé : ${name} (${roleLabel} · ${country}).`,
    },
    enums: {
      facilityVerification: {
        PENDING_REVIEW: "En révision",
        VERIFIED: "Vérifié",
        SUSPENDED: "Suspendu",
      },
      reviewStatus: {
        PENDING: "En attente",
        APPROVED: "Approuvé",
        REJECTED: "Refusé",
      },
      accountStatus: {
        PENDING_APPROVAL: "En attente",
        ACTIVE: "Actif",
        SUSPENDED: "Suspendu",
      },
      disputeStatus: {
        OPEN: "Ouvert",
        UNDER_REVIEW: "En cours d'examen",
        RESOLVED: "Résolu",
        DISMISSED: "Classé",
      },
      disputeCategory: {
        DISPATCH_DELAY: "Retard ambulance",
        NO_SHOW: "Absence patient/praticien",
        BILLING: "Facturation",
        CLINICAL_QUALITY: "Qualité clinique",
        PHARMACY_ISSUE: "Problème officine",
        PRIVACY_CONCERN: "Confidentialité / Données",
        OTHER: "Autre",
      },
    },
    messages: {
      docReviewFailed: (err) => `Échec revue du document : ${err}`,
      docMarked: (file, status) => `${file} marqué : ${status}.`,
      credReviewFailed: (err) => `Échec revue du justificatif : ${err}`,
      invalidLoginInput:
        "Saisissez un e-mail administrateur et un mot de passe valides.",
      authUnreachable:
        "Service d'authentification momentanément indisponible.",
      authFailed: (err) => `Échec authentification (${err}).`,
      signedInMsg: (name, role, country) =>
        `Connecté : ${name} (${role} · ${country}).`,
      signedOutRevoked: "Déconnecté et session révoquée.",
      facilityStatusRejected: (err) =>
        `Changement de statut refusé (${err}).`,
      facilityStatusUpdated: (name, status) =>
        `Statut de « ${name} » mis à jour : ${status}.`,
      roleUpdateRejected: (err) => `Changement de rôle refusé (${err}).`,
      roleReassigned: (name, role, country) =>
        `${name} réassigné au rôle ${role} (${country}).`,
      staffVerifyFailed: (err) => `Échec validation compte (${err}).`,
      staffVerifyUpdated: (name, roleLabel, status, verified) =>
        `${name} (${roleLabel}) est maintenant ${status}${verified ? " & Justificatifs Validés" : ""}.`,
      dispatchOverrideFailed: (err) => `Échec intervention transport (${err}).`,
      dispatchOverridden: (shortId, status) =>
        `Transport ${shortId} passé à ${status}.`,
      disputeFilingFailed: (err) => `Échec enregistrement signalement (${err}).`,
      disputeLogged: (subject, status) =>
        `Signalement « ${subject} » enregistré (${status}).`,
      disputeResolveFailed: (err) => `Échec résolution (${err}).`,
      disputeTransitioned: (shortId, status) =>
        `Signalement ${shortId} passé à ${status}.`,
      auditQueryFailed: (err) => `Échec requête d'audit (${err}).`,
    },
  },
  ar: {
    header: {
      guestLabel: "بوابة الإدارة والعمليات",
      jurisdictionAria: "النطاق الإقليمي",
      allRegionsOption: "جميع المناطق",
      hospitalReceptionLink: "استقبال المستشفى ←",
      refreshBtn: "تحديث البيانات",
      signInBtn: "دخول الإدارة",
      guardTitle: "مركز القيادة، المراقبة والاعتماد الطبي",
      guardRoles: "مدراء العمليات على المنصة ومدراء المستشفيات",
      guardPrimaryBtn: "تسجيل الدخول كمدير عمليات",
      overviewMetricsAria: "مؤشرات الأداء العامة",
      tabsAria: "أقسام لوحة الإدارة",
    },
    kpis: {
      pendingStaffVerify: "مهنيون بانتظار التفعيل",
      totalUsersDetail: (count) => `من أصل ${count} مستخدم`,
      pendingLicenses: "تراخيص قيد المراجعة",
      totalFacilitiesDetail: (count) => `من أصل ${count} مؤسسة`,
      syncRequired: "يتطلب مزامنة",
      activeDispatches: "سيارات إسعاف نشطة",
      liveEmsDetail: "حركة النقل المباشرة",
      bookedVisits: "مواعيد محجوزة",
      confirmedCheckedInDetail: "مؤكدة وحاضرة",
      issuedRxQr: "وصفات QR صادرة",
      awaitingPharmacyDetail: "في انتظار الصيدلية",
      openLabOrders: "تحاليل مخبرية مفتوحة",
      orderedSampledDetail: "مطلوبة أو قيد التحليل",
      openDisputes: "شكايات مفتوحة",
      disputesQueueDetail: "مراقبة الجودة والسلامة",
    },
    tabs: {
      overview: "نظرة عامة",
      facilities: (count) => `المؤسسات الصحية (${count})`,
      users: (count) => `الأطقم والمستخدمون (${count})`,
      dispatches: (count) => `حركة الإسعاف (${count})`,
      disputes: (count) => `الشكايات والنزاعات (${count})`,
      audit: (count) => `سجل المراقبة (${count})`,
    },
    overview: {
      pendingQueueTitle: (count) => `لائحة المهنيين في انتظار المصادقة (${count})`,
      pendingQueueSubtitle:
        "أطباء، ممرضون، صيادلة وسائقون مسجلون ينتظرون مراجعة وثائقهم لتفعيل حساباتهم.",
      openStaffQueueBtn: "فتح لائحة الأطر",
      statusPrefix: "الحالة:",
      inspectCredentialsBtn: "معاينة الشهادات",
      rejectSuspendBtn: "رفض / تعليق",
      verifyActivateBtn: "اعتماد وتفعيل",
      recentActivityTitle: "أحدث العمليات وسجل الامتثال",
      tamperEvidentBadge: "سجل محمي غير قابل للتعديل",
      auditOnPrefix: "على",
      auditActorPrefix: "بواسطة",
      emptyOverviewHint:
        "سجل الدخول كمدير منصة أو مستشفى واضغط تحديث لعرض الإحصائيات المباشرة.",
    },
    facilities: {
      heading: "مراجعة التراخيص واعتماد المصحات والمختبرات",
      showingCount: (shown, total) => `عرض ${shown} من ${total}`,
      searchPlaceholder: "بحث بالاسم، رقم الترخيص أو الشارع...",
      searchAria: "البحث في المؤسسات الصحية",
      kindAria: "تصفية حسب نوع المؤسسة",
      allTypesOption: "جميع الأنواع",
      hospitalsOption: "مستشفيات",
      clinicsOption: "عيادات",
      pharmaciesOption: "صيدليات",
      labsOption: "مختبرات تحاليل",
      filterAll: "الكل",
      filterPending: "قيد المراجعة",
      filterVerified: "معتمدة",
      filterSuspended: "معلّقة",
      emptyFilter: "لا توجد مؤسسات مطابقة لهذا الفلتر.",
      licensePrefix: "ترخيص:",
      verifyBtn: "اعتماد",
      suspendBtn: "تعليق",
      submittedDocsTitle: (count) => `الوثائق والصور المرفوعة (${count})`,
      inspectBtn: "معاينة",
      approveBtn: "موافقة",
      rejectBtn: "رفض",
    },
    users: {
      heading: (count) => `الأدوار والصلاحيات الإقليمية (${count})`,
      roleReasonAria: "سبب التغيير في سجل المراقبة",
      roleReasonPlaceholder: "سبب التعديل الموثق في السجل",
      defaultRoleReason: "مراجعة صلاحيات اعتيادية",
      provisionBtn: "إنشاء حساب مهني جديد",
      searchPlaceholder: "بحث بالاسم، البريد، الهاتف أو المعرف...",
      searchAria: "البحث عن المستخدمين",
      roleFilterAria: "تصفية حسب الدور",
      allRolesOption: "جميع الأدوار",
      filterAllStatuses: "جميع الحالات",
      filterPending: "قيد الانتظار",
      filterActive: "نشط",
      filterSuspended: "معلّق",
      emptyFilter: "لا يوجد مستخدمون مطابقون للبحث.",
      noEmail: "بدون بريد إلكتروني",
      statusPendingApproval: "بانتظار الموافقة",
      statusSuspended: "معلّق",
      statusVerifiedActive: "موثّق ونشط",
      statusActive: "نشط",
      credentialsBtn: "الشهادات",
      inspectBtn: "معاينة",
      approveBtn: "موافقة",
      rejectBtn: "رفض",
      roleSelectAria: (name) => `تغيير دور ${name}`,
      countrySelectAria: (name) => `تغيير بلد ${name}`,
      facilitySelectAria: (name) => `تغيير مؤسسة ${name}`,
      noFacilityLinkedOption: "غير مرتبط بمؤسسة",
      selfDemotionBlocked: "تخفيض صلاحياتك ممنوع",
      applyRoleBtn: "تطبيق الدور",
      verifyActivateBtn: "اعتماد وتفعيل",
      reactivateBtn: "إعادة تفعيل",
      suspendBtn: "تعليق الحساب",
    },
    dispatches: {
      heading: "التحكم المباشر بطلبات الإسعاف والنقل",
      empty: "لا توجد طلبات نقل طبي نشطة في هذه المنطقة.",
      statusSelectAria: (id) => `تعديل حالة الطلب ${id}`,
      driverSelectAria: (id) => `تعيين سائق للطلب ${id}`,
      keepUnassignedOption: "إبقاء / بدون تعيين",
      overridePlaceholder: "ملاحظة التعديل الإداري (3 أحرف+)",
      commitBtn: "تثبيت التعديل",
      facilityPrefix: "مؤسسة:",
      dispatchPrefix: "طلب نقل:",
    },
    disputes: {
      formHeading: "تسجيل شكاية رعاية صحية أو مشكل خدمة",
      categoryLabel: "الفئة",
      targetLabel: "المؤسسة أو الرحلة المعنية (اختياري)",
      targetPlaceholder: "اختر مؤسسة أو طلب نقل...",
      targetEmpty: "حادثة عامة على المنصة",
      subjectLabel: "الموضوع",
      subjectPlaceholder: "ملخص المشكل السريري أو اللوجستي",
      descriptionLabel: "تفاصيل الحادثة",
      descriptionPlaceholder: "اذكر التوقيت، المؤسسة وباقي التفاصيل...",
      submitBtn: "إرسال الشكاية",
      queueHeading: (count) => `لائحة الشكايات والنزاعات (${count})`,
      filterAll: "الكل",
      empty: "لا توجد شكايات مسجلة في هذا النطاق.",
      reporterPrefix: "المبلّغ:",
      resolutionNotePrefix: "قرار المعالجة:",
      resolutionPlaceholder: "ملاحظة الحل أو القرار...",
      markUnderReviewBtn: "قيد الدراسة",
      resolveBtn: "تم الحل",
      dismissBtn: "حفظ / رفض",
    },
    audit: {
      heading: (count) => `سجل العمليات القابل للبحث (${count})`,
      exportCsvBtn: "تصدير CSV",
      allActionsBtn: "جميع الإجراءات",
      actionInputPlaceholder: "تصفية حسب العملية (مثل USER_ROLE_UPDATED)",
      resourceInputPlaceholder: "نوع المورد (مثل dispatch_request)",
      applyFilterBtn: "تطبيق الفلتر",
      empty: "لا توجد أحداث مطابقة لفلتر البحث.",
      actorPrefix: "المنفّذ",
    },
    signInModal: {
      ariaLabel: "تسجيل دخول الإدارة",
      title: "تسجيل الدخول لمركز العمليات",
      closeAria: "إغلاق نافذة الدخول",
      emailLabel: "البريد الإلكتروني الإداري",
      passwordLabel: "كلمة المرور",
      passwordPlaceholder: "10 أحرف على الأقل",
      cancelBtn: "إلغاء",
      verifyingBtn: "جاري التحقق...",
      submitBtn: "الدخول لمكتب الإدارة",
    },
    provisionModal: {
      ariaLabel: "إنشاء حساب مهني أو إداري",
      title: "إنشاء حساب مهني أو إداري",
      closeAria: "إغلاق النافذة",
      fullNameLabel: "الاسم الكامل *",
      workEmailLabel: "البريد المهني *",
      accountRoleLabel: "نوع الحساب والدور *",
      countryLabel: "البلد / النطاق *",
      tempPasswordLabel: "كلمة مرور مؤقتة * (8 أحرف على الأقل)",
      tempPasswordPlaceholder: "8 أحرف على الأقل",
      mobilePhoneLabel: "رقم الهاتف المحمول (اختياري)",
      primaryFacilityLabel: (country) => `المؤسسة الصحية الرئيسية (${country})`,
      unassignedOption: "مستقل / غير مرتبط بمؤسسة",
      preVerifyLabel: "اعتماد الشهادات والتراخيص مسبقاً عند الإنشاء",
      cancelBtn: "إلغاء",
      submittingBtn: "جاري الإنشاء...",
      submitBtn: "إنشاء الحساب الآن",
      failedMsg: (err) => `تعذر إنشاء الحساب (${err}).`,
      successMsg: (name, roleLabel, country) =>
        `تم إنشاء حساب ${name} (${roleLabel} · ${country}).`,
    },
    enums: {
      facilityVerification: {
        PENDING_REVIEW: "قيد المراجعة",
        VERIFIED: "معتمدة",
        SUSPENDED: "معلّقة",
      },
      reviewStatus: {
        PENDING: "قيد المراجعة",
        APPROVED: "مقبول",
        REJECTED: "مرفوض",
      },
      accountStatus: {
        PENDING_APPROVAL: "بانتظار التفعيل",
        ACTIVE: "نشط",
        SUSPENDED: "معلّق",
      },
      disputeStatus: {
        OPEN: "مفتوحة",
        UNDER_REVIEW: "قيد الدراسة",
        RESOLVED: "محلولة",
        DISMISSED: "مغلقة",
      },
      disputeCategory: {
        DISPATCH_DELAY: "تأخر الإسعاف",
        NO_SHOW: "تغيّب عن الموعد",
        BILLING: "مشكلة فوترة أو دفع",
        CLINICAL_QUALITY: "جودة الرعاية الطبية",
        PHARMACY_ISSUE: "مشكلة صيدلية",
        PRIVACY_CONCERN: "حماية الخصوصية",
        OTHER: "موضوع آخر",
      },
    },
    messages: {
      docReviewFailed: (err) => `تعذرت مراجعة الوثيقة: ${err}`,
      docMarked: (file, status) => `تم تعيين حالة ${file} إلى ${status}.`,
      credReviewFailed: (err) => `تعذرت مراجعة الشهادة: ${err}`,
      invalidLoginInput: "أدخل بريد المدير الإلكتروني وكلمة المرور بشكل صحيح.",
      authUnreachable: "خدمة الدخول غير متاحة مؤقتاً. حاول بعد قليل.",
      authFailed: (err) => `فشل تسجيل الدخول (${err}).`,
      signedInMsg: (name, role, country) =>
        `تم الدخول باسم ${name} (${role} · ${country}).`,
      signedOutRevoked: "تم تسجيل الخروج وإبطال الجلسة.",
      facilityStatusRejected: (err) => `تعذر تغيير حالة المؤسسة (${err}).`,
      facilityStatusUpdated: (name, status) =>
        `تم تحديث حالة "${name}" إلى ${status}.`,
      roleUpdateRejected: (err) => `تعذر تغيير الدور (${err}).`,
      roleReassigned: (name, role, country) =>
        `تم تعيين ${name} بدور ${role} (${country}).`,
      staffVerifyFailed: (err) => `تعذر تحديث التحقق (${err}).`,
      staffVerifyUpdated: (name, roleLabel, status, verified) =>
        `${name} (${roleLabel}) أصبح الآن ${status}${verified ? " ومعتمد الشهادات" : ""}.`,
      dispatchOverrideFailed: (err) => `تعذر تعديل رحلة الإسعاف (${err}).`,
      dispatchOverridden: (shortId, status) =>
        `تم تحديث طلب النقل ${shortId} إلى ${status}.`,
      disputeFilingFailed: (err) => `تعذر تسجيل الشكاية (${err}).`,
      disputeLogged: (subject, status) =>
        `تم تسجيل الشكاية "${subject}" (${status}).`,
      disputeResolveFailed: (err) => `تعذر تحديث الشكاية (${err}).`,
      disputeTransitioned: (shortId, status) =>
        `تم تحديث الشكاية ${shortId} إلى ${status}.`,
      auditQueryFailed: (err) => `فشل استعلام سجل المراقبة (${err}).`,
    },
  },
};
