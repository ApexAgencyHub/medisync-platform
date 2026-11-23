import type {
  LocaleCode,
  PublicSelfRegisterRole,
  StaffWorkerRole,
  UserRole,
} from "@medisync/contracts";

export interface PortalCopy {
  careRegionPrefix: string;
  licenseExampleLabel: string;
  tracksAriaLabel: string;
  workflowTabsAriaLabel: string;
  patientTrackTitle: string;
  patientTrackSubtitle: string;
  staffTrackTitle: string;
  staffTrackSubtitle: string;
  signedInAs: () => string;
  backToProfile: string;
  tabs: {
    signin: string;
    register: string;
    facility: string;
  };
  onboarding: {
    ariaLabel: string;
    checklistPrefix: string;
    headline: string;
    refreshBtn: string;
    step1Title: string;
    step1Body: (name: string) => string;
    step2Title: string;
    step2UploadedCount: (count: number) => string;
    step2BodyPrefix: string;
    step2LinkText: string;
    step2BodySuffix: string;
    step3Title: string;
    step3DriverBody: string;
    step3SelectAria: string;
    step3SelectPlaceholder: string;
    saveWorkplaceBtn: string;
    addOwnPlaceBtn: string;
    verifiedTitle: string;
    verifiedBody: (roleLabel: string) => string;
  };
  roleLabels: Record<PublicSelfRegisterRole, string>;
  roleSummaries: Record<StaffWorkerRole, string>;
  onboardingSummaries: {
    DOCTOR: string;
    NURSE: string;
    CLINIC_STAFF: string;
    DRIVER: string;
    PHARMACIST: string;
    LAB_TECH: string;
    default: string;
  };
  staffSignin: {
    introPrefix: string;
    introLink: string;
    introSuffix: string;
    workIdentifierLabel: string;
    workIdentifierPlaceholder: string;
    passwordLabel: string;
    hideCharsAria: string;
    revealCharsAria: string;
    togglePwTitle: string;
    submittingBtn: string;
    submitBtn: string;
  };
  staffRegister: {
    chooseFieldPrefix: string;
    adminVerificationRequired: string;
    instantActivation: string;
    roleCardsAria: string;
    adminVerifiedPill: string;
    instantPill: string;
    fullLegalNameLabel: string;
    fullNamePlaceholder: string;
    accountTypeLabel: string;
    workEmailRequiredLabel: string;
    workEmailOptionalLabel: string;
    workEmailPlaceholder: string;
    staffEmailHint: string;
    mobilePhoneLabel: string;
    passwordMin8Label: string;
    passwordMin8Placeholder: string;
    registeredForPrefix: string;
    networkSuffix: string;
    noteDoctor: string;
    noteDriver: string;
    noteStaff: string;
    notePatient: string;
    submittingBtn: string;
    submitBtn: string;
  };
  facilityForm: {
    officialNameLabel: string;
    officialNamePlaceholder: string;
    sectorLabel: string;
    ministryLicenseLabel: (country: string) => string;
    validFormat: string;
    checkFormat: (example: string) => string;
    streetAddressLabel: string;
    streetAddressPlaceholder: string;
    latLabel: string;
    latPlaceholder: string;
    lngLabel: string;
    lngPlaceholder: string;
    licenseProofLabel: string;
    licenseProofHint: string;
    photoLabel: string;
    photoHint: string;
    submittingBtn: string;
    submitBtn: string;
  };
  recovery: {
    verifyEmailBtn: string;
    verifyPhoneBtn: string;
    resetPasswordBtn: string;
    accountEmailLabel: string;
    mobileE164Label: string;
    sendOtpBtn: string;
    devOtpPrefix: string;
    otpCodeLabel: string;
    newPasswordLabel: string;
    newPasswordPlaceholder: string;
    submitResetBtn: string;
    submitVerifyBtn: string;
  };
  aside: {
    demoTitle: (country: string) => string;
    oneClickSwitch: string;
    signedInProfileTitle: string;
    signOutBtn: string;
    pendingTitle: string;
    pendingBody: (roleLabel: string) => string;
    verifiedStaffBanner: string;
    emailVerified: string;
    emailUnverified: string;
    phoneVerified: string;
    phoneUnverified: string;
    photoBtn: string;
    verifyPersonalCredentialsLabel: string;
    credCategoryOptions: {
      PRACTITIONER_LICENSE: string;
      MEDICAL_DEGREE: string;
      BOARD_CERTIFICATION: string;
      MALPRACTICE_POLICY: string;
      DRIVER_LICENSE: string;
      VEHICLE_INSPECTION: string;
      INSURANCE_CERTIFICATE: string;
      NATIONAL_ID: string;
    };
    credScanLabel: string;
    credScanHint: string;
    viewBtn: string;
    refreshBtn: string;
    noFacilitiesInRegion: string;
    facilityVerified: string;
    facilityPending: string;
    docsBtn: string;
    attachLicenseBtn: string;
    verifyFacilityBtn: string;
    previewBtn: string;
    reviewStatusLabels: {
      PENDING: string;
      PENDING_REVIEW: string;
      APPROVED: string;
      REJECTED: string;
    };
  };
  patientPanel: {
    bookingForLegend: string;
    bookingForLabel: string;
    myselfPatient: string;
    familyCaregiver: string;
    methodsAria: string;
    phoneMethodTab: string;
    emailMethodTab: string;
    googleMethodTab: string;
    phoneOptionLabel: string;
    smsOtpBtn: string;
    phonePasswordBtn: string;
    fullNameLabel: string;
    fullNameNewHint: string;
    fullNamePlaceholder: string;
    phoneNumberLabel: string;
    mobilePhoneNumberLabel: string;
    sendingSmsBtn: string;
    continuePhoneBtn: string;
    smsSentTitle: (phone: string) => string;
    devSmsPreview: (code: string) => string;
    otpCodeLabel: string;
    verifyingBtn: string;
    verifyEnterBtn: string;
    changeNumberBtn: string;
    signInWithPhoneTab: string;
    registerWithPhoneTab: string;
    phoneRegNamePlaceholder: string;
    passwordLabel: string;
    passwordPlaceholder: string;
    enterPasswordPlaceholder: string;
    hideCharsAria: string;
    revealCharsAria: string;
    togglePwTitle: string;
    createPhoneBtn: string;
    signInPhonePwBtn: string;
    emailSignInTab: string;
    createAccountTab: string;
    resetOrVerifyLink: string;
    optionalLabel: string;
    emailRegNamePlaceholder: string;
    patientEmailLabel: string;
    createEmailBtn: string;
    signInEmailBtn: string;
  };
  profileCard: {
    verifiedAccountBadge: string;
    activeAccountBadge: string;
    pendingVerificationBadge: string;
    accountProfileTitle: string;
    accountProfileSubtitle: string;
    switchAccountBtn: string;
    identitySectionTitle: string;
    lastLoginPrefix: string;
    fullNameLabel: string;
    mobileE164Label: string;
    primaryWorkplaceLabel: string;
    unassignedOption: string;
    noEmailSet: string;
    verifyEmailBtn: string;
    emailVerifiedBadge: string;
    verifySmsBtn: string;
    phoneVerifiedBadge: string;
    savingBtn: string;
    saveProfileBtn: string;
    enterOtpPrompt: (channel: "email" | "sms", hint?: string | null) => string;
    confirmCodeBtn: string;
    cancelBtn: string;
    securitySectionTitle: string;
    hidePasswordsBtn: string;
    showPasswordsBtn: string;
    currentPasswordPlaceholder: string;
    newPasswordPlaceholder: string;
    updatingBtn: string;
    updatePasswordBtn: string;
    revokeSessionsHint: string;
    revokeOtherSessionsBtn: string;
    signOutDeviceBtn: string;
  };
  messages: {
    invalidAvatarMime: string;
    avatarUploadFailed: (err: string) => string;
    avatarUploaded: string;
    invalidCredMime: string;
    credUploadFailed: (err: string) => string;
    credUploaded: (file: string, cat: string) => string;
    unsupportedDocFormat: string;
    facilityDocFailed: (err: string) => string;
    facilityDocUploaded: (file: string) => string;
    enterEmailFirst: string;
    otpRequestError: (err: string) => string;
    otpDispatched: (channel: string, mins: number) => string;
    passwordResetFailed: (err: string) => string;
    passwordUpdated: string;
    verificationFailed: (err: string) => string;
    verifiedCleanly: (kind: "email" | "phone") => string;
    pendingUploadAppend: string;
    invalidLoginFields: string;
    serviceUnreachable: (url: string) => string;
    signInRejected: (err: string) => string;
    signedInMsg: (name: string, role: string, country: string) => string;
    invalidRegisterFields: string;
    registerFailed: (err: string) => string;
    welcomeRegistered: (name: string, role: string) => string;
    workplaceFailed: (err: string) => string;
    workplaceSaved: string;
    workplaceCleared: string;
    refreshStatusFailed: (err: string) => string;
    stillPendingReview: string;
    adminApprovedMsg: string;
    facilitySignInFirst: string;
    facilityInvalidFields: string;
    facilityLicenseMismatch: (license: string, country: string) => string;
    facilityServiceDown: string;
    facilityRejected: (err: string) => string;
    facilityRegistered: (name: string, status: string, notes: string) => string;
    facilityVerifyFailed: (err: string) => string;
    facilityVerifiedMsg: (name: string) => string;
    signedOutRevoked: string;
    enterPhoneForSms: string;
    enterSmsOtp: string;
    phoneVerifyFailed: (err: string) => string;
    welcomePhonePatient: (name: string) => string;
    enterMobilePhone: string;
    enterEmailAddress: string;
    patientRegisterFailed: (err: string) => string;
    patientReadyMsg: (name: string, country: string) => string;
    enterCredentials: string;
    signedInPatientMsg: (name: string) => string;
    googleFailed: (err: string) => string;
    signedInGoogleMsg: (name: string) => string;
    fullNameMin2: string;
    profileUpdateFailed: (err: string) => string;
    profileSaved: string;
    profileSynced: string;
    emailRequiredForVerify: string;
    verifyCodeRequestFailed: (err: string) => string;
    verifyCodeReady: (kind: "email" | "sms", code?: string, channel?: string) => string;
    codeConfirmFailed: (err: string) => string;
    emailVerifiedNote: string;
    phoneVerifiedNote: string;
    emailVerifiedBanner: string;
    phoneVerifiedBanner: string;
    passwordChangeValidation: string;
    invalidCurrentPassword: string;
    noPasswordSetUseReset: string;
    passwordUpdateFailed: (err: string) => string;
    passwordRotated: string;
    passwordChangedRevoked: string;
    revokeFailed: (err: string) => string;
    otherSessionsRevoked: string;
    onlyThisBrowserSignedIn: string;
  };
}

export function getPortalOnboardingSummary(
  copy: PortalCopy,
  role: UserRole,
): string {
  switch (role) {
    case "DOCTOR":
      return copy.onboardingSummaries.DOCTOR;
    case "NURSE":
      return copy.onboardingSummaries.NURSE;
    case "CLINIC_STAFF":
      return copy.onboardingSummaries.CLINIC_STAFF;
    case "DRIVER":
      return copy.onboardingSummaries.DRIVER;
    case "PHARMACIST":
      return copy.onboardingSummaries.PHARMACIST;
    case "LAB_TECH":
      return copy.onboardingSummaries.LAB_TECH;
    default:
      return copy.onboardingSummaries.default;
  }
}

export function getCredentialCategoryLabel(
  copy: PortalCopy,
  category: string,
): string {
  const map = copy.aside.credCategoryOptions as Record<string, string>;
  return map[category] ?? category;
}

export function getReviewStatusLabel(
  copy: PortalCopy,
  status: string,
): string {
  const map = copy.aside.reviewStatusLabels as Record<string, string>;
  return map[status] ?? status;
}

export const PORTAL_COPY: Record<LocaleCode, PortalCopy> = {
  en: {
    careRegionPrefix: "Care Region:",
    licenseExampleLabel: "License Example:",
    tracksAriaLabel: "Portal access tracks",
    workflowTabsAriaLabel: "Portal workflow modes",
    patientTrackTitle: "Patient & Caregiver",
    patientTrackSubtitle: "Phone, Email or Google · Instant access",
    staffTrackTitle: "Healthcare Staff & Clinics",
    staffTrackSubtitle: "Doctors, nurses, drivers, pharmacies & labs",
    signedInAs: () => "Signed in as",
    backToProfile: "Back to Account Profile & Security",
    tabs: {
      signin: "Staff Sign In",
      register: "Join by Field",
      facility: "Register Facility",
    },
    onboarding: {
      ariaLabel: "Worker Verification Onboarding",
      checklistPrefix: "Onboarding Verification Checklist ·",
      headline: "Complete Your Papers & Workplace",
      refreshBtn: "Refresh Approval Status",
      step1Title: "1. Quick Auth Complete",
      step1Body: (name) =>
        `Signed in as ${name}. Next steps below are required before Administration activates your workspace.`,
      step2Title: "2. Verification Papers",
      step2UploadedCount: (count) => `${count} Uploaded`,
      step2BodyPrefix: "Use the",
      step2LinkText: "Verify Personal Credentials",
      step2BodySuffix: "panel to upload licenses, diplomas, or vehicle photos.",
      step3Title: "3. Workplace Location",
      step3DriverBody:
        "Drivers operate flexibly across verified pickup points and static clinics or hospitals on the live map.",
      step3SelectAria: "Choose Primary Workplace Location",
      step3SelectPlaceholder: "Select clinic or hospital...",
      saveWorkplaceBtn: "Save Workplace",
      addOwnPlaceBtn: "+ Add Own Place",
      verifiedTitle: "Administration Verified · Workspace Active",
      verifiedBody: (roleLabel) =>
        `Your ${roleLabel} account is verified and ready for live platform operations.`,
    },
    roleLabels: {
      PATIENT: "Patient",
      CAREGIVER: "Caregiver / Family",
      DOCTOR: "Physician / Specialist",
      NURSE: "Registered Nurse / Infirmier",
      CLINIC_STAFF: "Clinic Coordinator / Intake",
      HOSPITAL_ADMIN: "Hospital Administrator",
      DRIVER: "Medical Transport Driver",
      PHARMACIST: "Licensed Pharmacist",
      LAB_TECH: "Diagnostic Lab Technologist",
    },
    roleSummaries: {
      DOCTOR: "Clinic/Video consultations, schedules, notes & QR E-Rx",
      NURSE: "Home nursing visits, vitals, wound care & lab orders",
      DRIVER: "Receive live Fast Book pings & route fees",
      CLINIC_STAFF: "Manage clinic doctors & intake queue",
      HOSPITAL_ADMIN: "Manage emergency hub beds & fleet",
      PHARMACIST: "Verify QR scripts, inventory & pharmacy sales",
      LAB_TECH: "Receive diagnostic panels & upload reports",
    },
    onboardingSummaries: {
      DOCTOR:
        "Upload Medical Degree & National Practitioner License, and select or add your practice clinic/office.",
      NURSE:
        "Upload State Nursing / Infirmier Diploma & Practicing License, then link your clinic or home-care hub.",
      CLINIC_STAFF:
        "Upload Healthcare Coordination Certificate and select the clinic or infirmary where you work.",
      DRIVER:
        "Upload your Driver License and Vehicle Inspection Photo for live dispatch approval.",
      PHARMACIST:
        "Upload your Pharmacy Dispensing License and link your pharmacy location.",
      LAB_TECH:
        "Upload your Laboratory Accreditation / Diploma and link your diagnostic lab.",
      default:
        "Upload your professional credentials for Administration verification.",
    },
    staffSignin: {
      introPrefix:
        "Dedicated sign-in for doctors, nurses, pharmacists, lab staff, ambulance drivers, and facility administrators. Patients sign in at",
      introLink: "Patient Access",
      introSuffix: ".",
      workIdentifierLabel: "Work Email or Phone Number",
      workIdentifierPlaceholder: "dr.karim@clinic.ma or +212600112233",
      passwordLabel: "Password",
      hideCharsAria: "Hide entered characters",
      revealCharsAria: "Reveal entered characters",
      togglePwTitle: "Toggle password visibility",
      submittingBtn: "Verifying Credentials...",
      submitBtn: "Sign In as Staff Member",
    },
    staffRegister: {
      chooseFieldPrefix: "Choose Your Field ·",
      adminVerificationRequired: "Admin Verification Required",
      instantActivation: "Instant Activation",
      roleCardsAria: "Account role cards",
      adminVerifiedPill: "Admin Verified",
      instantPill: "Instant",
      fullLegalNameLabel: "Full Legal Name",
      fullNamePlaceholder: "Dr. Amina Benali",
      accountTypeLabel: "Account Type",
      workEmailRequiredLabel: "Work Email *",
      workEmailOptionalLabel: "Work Email (or use phone)",
      workEmailPlaceholder: "amina@hospital.ma",
      staffEmailHint:
        "Required for staff credentials & paper verification updates.",
      mobilePhoneLabel: "Mobile Phone (optional)",
      passwordMin8Label: "Password (min 8 chars)",
      passwordMin8Placeholder: "Minimum 8 characters",
      registeredForPrefix: "Registered for",
      networkSuffix: "network.",
      noteDoctor:
        "Verification step: You will sign in normally as Pending Verification; upload your National Medical License and Clinic photo in credentials below so Administration activates your booking slots.",
      noteDriver:
        "Verification step: After signing up, upload your Driver License and Vehicle Inspection Photo so Administration activates live Fast-Book dispatch alerts & payouts.",
      noteStaff:
        "Verification step: Staff accounts authenticate normally on registration, then upload their facility authorization or license certificate below until verified by Administration.",
      notePatient:
        "Patients & Caregivers activate immediately — saved bookmarks, visit deadlines, and doctor-shared documents sync once signed in.",
      submittingBtn: "Creating Account...",
      submitBtn: "Create Account",
    },
    facilityForm: {
      officialNameLabel: "Facility Official Name",
      officialNamePlaceholder: "Clinique Atlas Casablanca",
      sectorLabel: "Facility Sector",
      ministryLicenseLabel: (country) => `Ministry License (${country})`,
      validFormat: "Valid Format",
      checkFormat: (example) => `Check Format (${example})`,
      streetAddressLabel: "Street Address",
      streetAddressPlaceholder: "18 Boulevard d'Anfa, Casablanca",
      latLabel: "Map Latitude",
      latPlaceholder: "e.g. 33.5731",
      lngLabel: "Map Longitude",
      lngPlaceholder: "e.g. -7.5898",
      licenseProofLabel: "Ministry License Proof (Optional)",
      licenseProofHint: "PDF, PNG, JPEG or WebP certificate",
      photoLabel: "Facility Exterior / Lobby Photo",
      photoHint: "PNG, JPEG or WebP photo",
      submittingBtn: "Uploading & Indexing Facility...",
      submitBtn: "Submit Facility for Verification",
    },
    recovery: {
      verifyEmailBtn: "Verify Email",
      verifyPhoneBtn: "Verify SMS Phone",
      resetPasswordBtn: "Reset Password",
      accountEmailLabel: "Account Email",
      mobileE164Label: "Mobile Number (E.164)",
      sendOtpBtn: "Send 6-Digit OTP Code",
      devOtpPrefix: "Dev OTP:",
      otpCodeLabel: "6-Digit OTP Code",
      newPasswordLabel: "New Password",
      newPasswordPlaceholder: "Min 8 characters",
      submitResetBtn: "Confirm OTP & Reset Password",
      submitVerifyBtn: "Confirm Verification Code",
    },
    aside: {
      demoTitle: (country) => `Quick Demo Accounts (${country})`,
      oneClickSwitch: "1-Click Switch",
      signedInProfileTitle: "Signed-In Profile",
      signOutBtn: "Sign Out",
      pendingTitle: "Pending Administration Verification",
      pendingBody: (roleLabel) =>
        `Your ${roleLabel} account is signed in, but functional clinical, pharmacy, lab & dispatch tools stay locked until an Ops Admin verifies your uploaded license or board certificate below.`,
      verifiedStaffBanner: "Administration Verified & Active Staff Account",
      emailVerified: "Email Verified",
      emailUnverified: "Email Unverified",
      phoneVerified: "Phone Verified",
      phoneUnverified: "Phone Unverified",
      photoBtn: "Photo",
      verifyPersonalCredentialsLabel: "Verify Personal Credentials",
      credCategoryOptions: {
        PRACTITIONER_LICENSE: "Practitioner License",
        MEDICAL_DEGREE: "Medical / Nursing Degree",
        BOARD_CERTIFICATION: "Board / Specialty Cert",
        MALPRACTICE_POLICY: "Malpractice Insurance",
        DRIVER_LICENSE: "Driver License",
        VEHICLE_INSPECTION: "Vehicle Inspection Photo",
        INSURANCE_CERTIFICATE: "Vehicle Insurance Cert",
        NATIONAL_ID: "National ID / CIN",
      },
      credScanLabel: "Credential Scan (PDF / Image)",
      credScanHint: "Upload license or board diploma",
      viewBtn: "View",
      refreshBtn: "Refresh",
      noFacilitiesInRegion:
        "No registered healthcare facilities in your region yet.",
      facilityVerified: "Verified",
      facilityPending: "Pending Review",
      docsBtn: "Docs",
      attachLicenseBtn: "+ Attach License",
      verifyFacilityBtn: "Verify Facility",
      previewBtn: "Preview",
      reviewStatusLabels: {
        PENDING: "Pending",
        PENDING_REVIEW: "Pending Review",
        APPROVED: "Approved",
        REJECTED: "Rejected",
      },
    },
    patientPanel: {
      bookingForLegend: "Booking For",
      bookingForLabel: "Booking For ·",
      myselfPatient: "Myself (Patient)",
      familyCaregiver: "Family Caregiver",
      methodsAria: "Patient authentication methods",
      phoneMethodTab: "Phone Number",
      emailMethodTab: "Email",
      googleMethodTab: "Google",
      phoneOptionLabel: "Phone sign-in option:",
      smsOtpBtn: "6-Digit SMS Code (No Password)",
      phonePasswordBtn: "Phone + Password",
      fullNameLabel: "Full Name",
      fullNameNewHint: "(needed for new accounts)",
      fullNamePlaceholder: "Salma Benali",
      phoneNumberLabel: "Phone Number",
      mobilePhoneNumberLabel: "Mobile Phone Number",
      sendingSmsBtn: "Sending SMS...",
      continuePhoneBtn: "Continue with Phone Number",
      smsSentTitle: (phone) => `Enter the 6-digit SMS code sent to ${phone}`,
      devSmsPreview: (code) => `Dev SMS Preview Code: ${code}`,
      otpCodeLabel: "6-Digit Verification Code",
      verifyingBtn: "Verifying...",
      verifyEnterBtn: "Verify & Enter Patient Portal",
      changeNumberBtn: "Change Number",
      signInWithPhoneTab: "Sign In with Phone",
      registerWithPhoneTab: "Register with Phone Number",
      phoneRegNamePlaceholder: "Nadia El Fassi",
      passwordLabel: "Password",
      passwordPlaceholder: "Minimum 8 characters",
      enterPasswordPlaceholder: "Enter password",
      hideCharsAria: "Hide entered characters",
      revealCharsAria: "Reveal entered characters",
      togglePwTitle: "Toggle password visibility",
      createPhoneBtn: "Create Patient Account (Phone)",
      signInPhonePwBtn: "Sign In with Phone & Password",
      emailSignInTab: "Patient Email Sign In",
      createAccountTab: "Create Patient Account",
      resetOrVerifyLink: "Reset password / verify OTP",
      optionalLabel: "(optional)",
      emailRegNamePlaceholder: "Amine El Idrissi",
      patientEmailLabel: "Patient Email Address",
      createEmailBtn: "Create Patient Account (Email)",
      signInEmailBtn: "Sign In as Patient (Email)",
    },
    profileCard: {
      verifiedAccountBadge: "Verified Account",
      activeAccountBadge: "Active Account",
      pendingVerificationBadge: "Pending Verification",
      accountProfileTitle: "Account Profile & Security Settings",
      accountProfileSubtitle:
        "Update contact info, confirm verification badges, rotate password, or invalidate sessions on other devices.",
      switchAccountBtn: "Switch Account",
      identitySectionTitle: "Identity & Contact Information",
      lastLoginPrefix: "Last login:",
      fullNameLabel: "Full Name",
      mobileE164Label: "Mobile Phone (E.164)",
      primaryWorkplaceLabel: "Primary Workplace Facility",
      unassignedOption: "Independent / Unassigned",
      noEmailSet: "No email set",
      verifyEmailBtn: "Verify Email",
      emailVerifiedBadge: "Email Verified",
      verifySmsBtn: "Verify SMS Phone",
      phoneVerifiedBadge: "Phone Verified",
      savingBtn: "Saving...",
      saveProfileBtn: "Save Profile",
      enterOtpPrompt: (channel, hint) =>
        `Enter 6-digit ${channel === "email" ? "email" : "SMS"} OTP${hint ? ` (${hint})` : ""}:`,
      confirmCodeBtn: "Confirm Code",
      cancelBtn: "Cancel",
      securitySectionTitle: "Password & Session Security",
      hidePasswordsBtn: "Hide Passwords",
      showPasswordsBtn: "Show Passwords",
      currentPasswordPlaceholder: "Current password",
      newPasswordPlaceholder: "New password (min 8 chars)",
      updatingBtn: "Updating...",
      updatePasswordBtn: "Update Password",
      revokeSessionsHint:
        "Revoking other sessions immediately invalidates JWT tokens issued on other browsers or phones.",
      revokeOtherSessionsBtn: "Revoke Other Sessions",
      signOutDeviceBtn: "Sign Out This Device",
    },
    messages: {
      invalidAvatarMime: "Profile avatar must be a PNG, JPEG, or WebP image.",
      avatarUploadFailed: (err) => `Avatar upload failed: ${err}`,
      avatarUploaded: "Profile photo uploaded and verified.",
      invalidCredMime: "Credential document must be PDF, PNG, JPEG, or WebP.",
      credUploadFailed: (err) => `Credential upload failed: ${err}`,
      credUploaded: (file, cat) =>
        `Uploaded ${file} (${cat}) for verification.`,
      unsupportedDocFormat:
        "Unsupported document format. Use PDF, PNG, JPEG, or WebP.",
      facilityDocFailed: (err) => `Facility document upload failed: ${err}`,
      facilityDocUploaded: (file) => `Uploaded ${file} for ops review.`,
      enterEmailFirst: "Enter account email first.",
      otpRequestError: (err) => `OTP request error: ${err}`,
      otpDispatched: (channel, mins) =>
        `Verification code dispatched via ${channel} (expires in ${mins}m).`,
      passwordResetFailed: (err) => `Password reset failed: ${err}`,
      passwordUpdated:
        "Password updated cleanly. Sign in with your new credentials.",
      verificationFailed: (err) => `Verification failed: ${err}`,
      verifiedCleanly: (kind) =>
        `${kind === "email" ? "Email" : "Phone"} verified cleanly.`,
      pendingUploadAppend:
        "Please upload your verification documents and select your workplace below.",
      invalidLoginFields:
        "Enter a valid work email or phone number and password.",
      serviceUnreachable: (url) =>
        `Service unreachable at ${url}. Please check backend availability.`,
      signInRejected: (err) => {
        if (err === "USE_STAFF_PORTAL") {
          return "Practitioners, pharmacists, labs, drivers, and clinic staff must sign in via MediSync Pro (/pro).";
        }
        if (err === "USE_PATIENT_PORTAL") {
          return "Patient and caregiver accounts must sign in via Patient Access (/portal).";
        }
        return `Sign-in rejected (${err}).`;
      },
      signedInMsg: (name, role, country) =>
        `Signed in as ${name} (${role} · ${country}).`,
      invalidRegisterFields:
        "Provide your full name, a valid email or mobile number, and a password (min 8 chars).",
      registerFailed: (err) => `Registration failed (${err}).`,
      welcomeRegistered: (name, role) =>
        `Welcome ${name}! Your ${role} account is ready.`,
      workplaceFailed: (err) =>
        `Could not update workplace selection (${err}).`,
      workplaceSaved: "Primary workplace location saved to your profile.",
      workplaceCleared: "Workplace assignment cleared.",
      refreshStatusFailed: (err) => `Could not refresh account status (${err}).`,
      stillPendingReview:
        "Still awaiting Administration review. Ensure all required documents are uploaded.",
      adminApprovedMsg:
        "Approved! Administration verified your credentials and activated your workspace.",
      facilitySignInFirst:
        "Sign in or register with a clinical or admin role before registering a medical facility.",
      facilityInvalidFields:
        "Complete all facility fields and supply valid GPS coordinates (-90..90 lat, -180..180 lng).",
      facilityLicenseMismatch: (license, country) =>
        `License "${license}" does not match jurisdiction pattern for ${country}.`,
      facilityServiceDown:
        "Unable to reach the submission service right now. Please try again in a moment.",
      facilityRejected: (err) => `Facility submission rejected (${err}).`,
      facilityRegistered: (name, status, notes) =>
        `Facility "${name}" registered (${status})${notes ? ` · ${notes}` : ""}.`,
      facilityVerifyFailed: (err) => `Verification update failed (${err}).`,
      facilityVerifiedMsg: (name) =>
        `Verified "${name}" for public patient discovery.`,
      signedOutRevoked: "Signed out and revoked server token.",
      enterPhoneForSms:
        "Enter your mobile phone number to receive a 6-digit SMS code.",
      enterSmsOtp:
        "Enter the 6-digit SMS verification code sent to your phone.",
      phoneVerifyFailed: (err) => `Phone verification failed: ${err}`,
      welcomePhonePatient: (name) =>
        `Welcome ${name}. Patient session active via verified phone.`,
      enterMobilePhone: "Enter your mobile phone number.",
      enterEmailAddress: "Enter your email address.",
      patientRegisterFailed: (err) => `Patient registration failed: ${err}`,
      patientReadyMsg: (name, country) =>
        `Patient account ready for ${name} (${country}).`,
      enterCredentials: "Enter your phone or email and password.",
      signedInPatientMsg: (name) =>
        `Signed in as ${name}. Patient account is ready.`,
      googleFailed: (err) => `Google Sign-In failed: ${err}`,
      signedInGoogleMsg: (name) => `Signed in with Google as ${name}.`,
      fullNameMin2: "Full name must be at least 2 characters.",
      profileUpdateFailed: (err) => `Profile update failed (${err}).`,
      profileSaved: "Personal account profile saved.",
      profileSynced: "Account profile details updated and synced.",
      emailRequiredForVerify:
        "An account email is required before triggering inline contact verification.",
      verifyCodeRequestFailed: (err) =>
        `Verification code request failed (${err}).`,
      verifyCodeReady: (kind, code, channel) =>
        code
          ? `6-digit ${kind === "email" ? "email" : "SMS"} code ready (Dev preview: ${code}).`
          : `Sent 6-digit verification code via ${channel ?? "contact"}.`,
      codeConfirmFailed: (err) => `Code confirmation failed (${err}).`,
      emailVerifiedNote: "Email address verified.",
      phoneVerifiedNote: "Mobile phone number verified.",
      emailVerifiedBanner: "Email verified on your MediSync account.",
      phoneVerifiedBanner: "Phone number verified on your MediSync account.",
      passwordChangeValidation:
        "Enter your current password and a new password of at least 8 characters.",
      invalidCurrentPassword: "Current password is incorrect.",
      noPasswordSetUseReset:
        "OTP/Google account has no password set yet. Use Reset Password.",
      passwordUpdateFailed: (err) => `Password update failed (${err}).`,
      passwordRotated:
        "Password rotated. Older sessions on other devices have been logged out.",
      passwordChangedRevoked:
        "Password changed and older device tokens revoked.",
      revokeFailed: (err) => `Session revocation failed (${err}).`,
      otherSessionsRevoked:
        "All other signed-in browsers and devices were revoked immediately.",
      onlyThisBrowserSignedIn:
        "All other sessions revoked. Only this browser stays signed in.",
    },
  },
  fr: {
    careRegionPrefix: "Région de soins :",
    licenseExampleLabel: "Exemple d'agrément :",
    tracksAriaLabel: "Portails d'accès",
    workflowTabsAriaLabel: "Modes du portail professionnel",
    patientTrackTitle: "Patient & Aidant Familial",
    patientTrackSubtitle: "Téléphone, E-mail ou Google · Accès immédiat",
    staffTrackTitle: "Personnel Médical & Cliniques",
    staffTrackSubtitle: "Médecins, infirmiers, ambulanciers, pharmacies & labos",
    signedInAs: () => "Connecté en tant que",
    backToProfile: "Retour au Profil & Sécurité",
    tabs: {
      signin: "Connexion Pro",
      register: "Créer par Spécialité",
      facility: "Déclarer Établissement",
    },
    onboarding: {
      ariaLabel: "Liste de vérification d'intégration",
      checklistPrefix: "Vérification d'intégration ·",
      headline: "Complétez vos justificatifs et votre lieu d'exercice",
      refreshBtn: "Actualiser le statut",
      step1Title: "1. Compte authentifié",
      step1Body: (name) =>
        `Connecté en tant que ${name}. Complétez les étapes ci-dessous avant l'activation par l'administration.`,
      step2Title: "2. Justificatifs professionnels",
      step2UploadedCount: (count) => `${count} déposé(s)`,
      step2BodyPrefix: "Utilisez le panneau",
      step2LinkText: "Vérifier mes justificatifs",
      step2BodySuffix: "pour téléverser licences, diplômes ou véhicule.",
      step3Title: "3. Établissement de rattachement",
      step3DriverBody:
        "Les chauffeurs opèrent librement entre les points de prise en charge, cliniques et hôpitaux de la carte.",
      step3SelectAria: "Choisir l'établissement principal",
      step3SelectPlaceholder: "Sélectionner une clinique ou hôpital...",
      saveWorkplaceBtn: "Enregistrer le lieu",
      addOwnPlaceBtn: "+ Ajouter un établissement",
      verifiedTitle: "Compte Vérifié · Espace Actif",
      verifiedBody: (roleLabel) =>
        `Votre profil ${roleLabel} est vérifié et prêt pour les opérations en direct.`,
    },
    roleLabels: {
      PATIENT: "Patient",
      CAREGIVER: "Aidant Familial",
      DOCTOR: "Médecin / Spécialiste",
      NURSE: "Infirmier(ère) d'État",
      CLINIC_STAFF: "Accueil & Coordination Clinique",
      HOSPITAL_ADMIN: "Coordinateur Hôpital",
      DRIVER: "Transport Médical / Ambulance",
      PHARMACIST: "Pharmacien Titulaire",
      LAB_TECH: "Technicien de Laboratoire",
    },
    roleSummaries: {
      DOCTOR: "Consultations cabinet/vidéo, agenda, notes & E-Rx QR",
      NURSE: "Soins à domicile, constantes, pansements & bilans",
      DRIVER: "Alertes Fast Book en direct & courses médicales",
      CLINIC_STAFF: "Gestion de file d'attente et médecins du centre",
      HOSPITAL_ADMIN: "Pilotage des urgences, lits & flotte",
      PHARMACIST: "Ordonnances QR, stocks & ventes officine",
      LAB_TECH: "Réception de bilans & publication des résultats",
    },
    onboardingSummaries: {
      DOCTOR:
        "Déposez votre diplôme de médecine et votre numéro d'ordre, puis rattachez votre clinique ou cabinet.",
      NURSE:
        "Déposez votre diplôme d'infirmier(ère) d'État et carte professionnelle, puis rattachez votre centre ou zone.",
      CLINIC_STAFF:
        "Déposez votre attestation de coordination et sélectionnez votre clinique ou centre médical.",
      DRIVER:
        "Déposez votre permis de conduire et la photo du véhicule sanitaire pour validation.",
      PHARMACIST:
        "Déposez votre licence officinale et liez votre pharmacie.",
      LAB_TECH:
        "Déposez votre accréditation de laboratoire et sélectionnez votre centre d'analyses.",
      default:
        "Déposez vos justificatifs professionnels pour vérification administrative.",
    },
    staffSignin: {
      introPrefix:
        "Accès professionnel réservé aux médecins, infirmiers, pharmaciens, laboratoires, ambulanciers et coordinateurs. Les patients utilisent",
      introLink: "l'Espace Patient",
      introSuffix: ".",
      workIdentifierLabel: "E-mail professionnel ou Téléphone",
      workIdentifierPlaceholder: "dr.karim@clinic.ma ou +212600112233",
      passwordLabel: "Mot de passe",
      hideCharsAria: "Masquer les caractères",
      revealCharsAria: "Afficher les caractères",
      togglePwTitle: "Afficher ou masquer le mot de passe",
      submittingBtn: "Vérification...",
      submitBtn: "Connexion Personnel Médical",
    },
    staffRegister: {
      chooseFieldPrefix: "Choisissez votre métier ·",
      adminVerificationRequired: "Validation requise",
      instantActivation: "Activation immédiate",
      roleCardsAria: "Choix du rôle professionnel",
      adminVerifiedPill: "Validé Admin",
      instantPill: "Immédiat",
      fullLegalNameLabel: "Nom complet officiel",
      fullNamePlaceholder: "Dr. Amina Benali",
      accountTypeLabel: "Type de compte",
      workEmailRequiredLabel: "E-mail professionnel *",
      workEmailOptionalLabel: "E-mail (ou téléphone)",
      workEmailPlaceholder: "amina@hospital.ma",
      staffEmailHint:
        "Requis pour le suivi de vérification des justificatifs.",
      mobilePhoneLabel: "Téléphone mobile (optionnel)",
      passwordMin8Label: "Mot de passe (8 car. min.)",
      passwordMin8Placeholder: "8 caractères minimum",
      registeredForPrefix: "Inscription sur le réseau",
      networkSuffix: ".",
      noteDoctor:
        "Vérification : vous accédez au portail en attente de validation ; déposez votre licence médicale et photo du cabinet ci-dessous pour activer la prise de rendez-vous.",
      noteDriver:
        "Vérification : déposez votre permis et la photo de l'ambulance/véhicule pour recevoir les alertes Fast Book en direct.",
      noteStaff:
        "Vérification : le compte s'authentifie dès l'inscription puis reste en revue administrative jusqu'à validation de votre justificatif ci-dessous.",
      notePatient:
        "Activation immédiate pour Patients & Aidants : favoris, rendez-vous et documents médicaux se synchronisent aussitôt.",
      submittingBtn: "Création du compte...",
      submitBtn: "Créer mon compte",
    },
    facilityForm: {
      officialNameLabel: "Nom officiel de l'établissement",
      officialNamePlaceholder: "Clinique Atlas Casablanca",
      sectorLabel: "Type d'établissement",
      ministryLicenseLabel: (country) => `Agrément Ministériel (${country})`,
      validFormat: "Format valide",
      checkFormat: (example) => `Vérifier le format (${example})`,
      streetAddressLabel: "Adresse complète",
      streetAddressPlaceholder: "18 Boulevard d'Anfa, Casablanca",
      latLabel: "Latitude GPS",
      latPlaceholder: "ex. 33.5731",
      lngLabel: "Longitude GPS",
      lngPlaceholder: "ex. -7.5898",
      licenseProofLabel: "Justificatif d'agrément (Optionnel)",
      licenseProofHint: "Certificat PDF, PNG, JPEG ou WebP",
      photoLabel: "Photo extérieure / Accueil",
      photoHint: "Photo PNG, JPEG ou WebP",
      submittingBtn: "Indexation de l'établissement...",
      submitBtn: "Soumettre l'établissement pour vérification",
    },
    recovery: {
      verifyEmailBtn: "Vérifier l'E-mail",
      verifyPhoneBtn: "Vérifier le SMS",
      resetPasswordBtn: "Réinitialiser mot de passe",
      accountEmailLabel: "E-mail du compte",
      mobileE164Label: "Numéro mobile (E.164)",
      sendOtpBtn: "Envoyer le code OTP (6 chiffres)",
      devOtpPrefix: "Code Test :",
      otpCodeLabel: "Code OTP à 6 chiffres",
      newPasswordLabel: "Nouveau mot de passe",
      newPasswordPlaceholder: "8 caractères minimum",
      submitResetBtn: "Confirmer OTP & Réinitialiser",
      submitVerifyBtn: "Valider le code de vérification",
    },
    aside: {
      demoTitle: (country) => `Comptes Démo Rapides (${country})`,
      oneClickSwitch: "Basculer en 1 clic",
      signedInProfileTitle: "Session Active",
      signOutBtn: "Déconnexion",
      pendingTitle: "En attente de validation administrative",
      pendingBody: (roleLabel) =>
        `Votre compte ${roleLabel} est connecté, mais les outils cliniques, pharmacie, laboratoire et transport restent verrouillés jusqu'à validation de votre justificatif ci-dessous.`,
      verifiedStaffBanner: "Compte professionnel vérifié et actif",
      emailVerified: "E-mail vérifié",
      emailUnverified: "E-mail non vérifié",
      phoneVerified: "Téléphone vérifié",
      phoneUnverified: "Téléphone non vérifié",
      photoBtn: "Photo",
      verifyPersonalCredentialsLabel: "Vérifier mes justificatifs",
      credCategoryOptions: {
        PRACTITIONER_LICENSE: "Licence / Ordre professionnel",
        MEDICAL_DEGREE: "Diplôme médical / infirmier",
        BOARD_CERTIFICATION: "Certificat de spécialité",
        MALPRACTICE_POLICY: "Assurance RCP",
        DRIVER_LICENSE: "Permis de conduire",
        VEHICLE_INSPECTION: "Contrôle technique véhicule",
        INSURANCE_CERTIFICATE: "Attestation d'assurance véhicule",
        NATIONAL_ID: "Carte Nationale (CIN)",
      },
      credScanLabel: "Scan du justificatif (PDF / Image)",
      credScanHint: "Déposer licence ou diplôme",
      viewBtn: "Voir",
      refreshBtn: "Actualiser",
      noFacilitiesInRegion:
        "Aucun établissement enregistré dans cette région pour le moment.",
      facilityVerified: "Vérifié",
      facilityPending: "En révision",
      docsBtn: "Pièces",
      attachLicenseBtn: "+ Joindre Agrément",
      verifyFacilityBtn: "Valider l'établissement",
      previewBtn: "Aperçu",
      reviewStatusLabels: {
        PENDING: "En attente",
        PENDING_REVIEW: "En révision",
        APPROVED: "Approuvé",
        REJECTED: "Refusé",
      },
    },
    patientPanel: {
      bookingForLegend: "Compte pour",
      bookingForLabel: "Pour ·",
      myselfPatient: "Moi-même (Patient)",
      familyCaregiver: "Aidant Familial",
      methodsAria: "Méthodes de connexion patient",
      phoneMethodTab: "Téléphone",
      emailMethodTab: "E-mail",
      googleMethodTab: "Google",
      phoneOptionLabel: "Option de connexion SMS :",
      smsOtpBtn: "Code SMS 6 chiffres (Sans mot de passe)",
      phonePasswordBtn: "Téléphone + Mot de passe",
      fullNameLabel: "Nom complet",
      fullNameNewHint: "(requis pour un nouveau compte)",
      fullNamePlaceholder: "Salma Benali",
      phoneNumberLabel: "Numéro de téléphone",
      mobilePhoneNumberLabel: "Numéro de mobile",
      sendingSmsBtn: "Envoi du SMS...",
      continuePhoneBtn: "Continuer avec ce numéro",
      smsSentTitle: (phone) =>
        `Saisissez le code SMS à 6 chiffres envoyé au ${phone}`,
      devSmsPreview: (code) => `Code SMS de test : ${code}`,
      otpCodeLabel: "Code de vérification à 6 chiffres",
      verifyingBtn: "Vérification...",
      verifyEnterBtn: "Valider et accéder au portail",
      changeNumberBtn: "Changer de numéro",
      signInWithPhoneTab: "Connexion Téléphone",
      registerWithPhoneTab: "Inscription Téléphone",
      phoneRegNamePlaceholder: "Nadia El Fassi",
      passwordLabel: "Mot de passe",
      passwordPlaceholder: "8 caractères minimum",
      enterPasswordPlaceholder: "Saisir le mot de passe",
      hideCharsAria: "Masquer les caractères",
      revealCharsAria: "Afficher les caractères",
      togglePwTitle: "Afficher ou masquer le mot de passe",
      createPhoneBtn: "Créer mon compte Patient (Téléphone)",
      signInPhonePwBtn: "Se connecter (Téléphone + Mot de passe)",
      emailSignInTab: "Connexion par E-mail",
      createAccountTab: "Créer un compte Patient",
      resetOrVerifyLink: "Réinitialiser mot de passe / OTP",
      optionalLabel: "(optionnel)",
      emailRegNamePlaceholder: "Amine El Idrissi",
      patientEmailLabel: "Adresse E-mail Patient",
      createEmailBtn: "Créer mon compte Patient (E-mail)",
      signInEmailBtn: "Se connecter (E-mail)",
    },
    profileCard: {
      verifiedAccountBadge: "Compte vérifié",
      activeAccountBadge: "Compte actif",
      pendingVerificationBadge: "En attente de validation",
      accountProfileTitle: "Profil du compte & Paramètres de sécurité",
      accountProfileSubtitle:
        "Mettez à jour vos coordonnées, vérifiez vos badges, modifiez votre mot de passe ou révoquez les autres appareils.",
      switchAccountBtn: "Changer de compte",
      identitySectionTitle: "Identité & Coordonnées",
      lastLoginPrefix: "Dernière connexion :",
      fullNameLabel: "Nom complet",
      mobileE164Label: "Téléphone mobile (E.164)",
      primaryWorkplaceLabel: "Établissement principal",
      unassignedOption: "Indépendant / Non rattaché",
      noEmailSet: "Aucun e-mail défini",
      verifyEmailBtn: "Vérifier E-mail",
      emailVerifiedBadge: "E-mail vérifié",
      verifySmsBtn: "Vérifier SMS",
      phoneVerifiedBadge: "Téléphone vérifié",
      savingBtn: "Enregistrement...",
      saveProfileBtn: "Enregistrer le profil",
      enterOtpPrompt: (channel, hint) =>
        `Saisissez le code ${channel === "email" ? "e-mail" : "SMS"} à 6 chiffres${hint ? ` (${hint})` : ""} :`,
      confirmCodeBtn: "Confirmer",
      cancelBtn: "Annuler",
      securitySectionTitle: "Mot de passe & Sessions",
      hidePasswordsBtn: "Masquer",
      showPasswordsBtn: "Afficher",
      currentPasswordPlaceholder: "Mot de passe actuel",
      newPasswordPlaceholder: "Nouveau mot de passe (8 car. min.)",
      updatingBtn: "Mise à jour...",
      updatePasswordBtn: "Mettre à jour",
      revokeSessionsHint:
        "Révoquer les autres sessions déconnecte immédiatement les autres navigateurs et téléphones.",
      revokeOtherSessionsBtn: "Déconnecter les autres appareils",
      signOutDeviceBtn: "Déconnecter cet appareil",
    },
    messages: {
      invalidAvatarMime: "La photo de profil doit être au format PNG, JPEG ou WebP.",
      avatarUploadFailed: (err) => `Échec de l'envoi de l'avatar : ${err}`,
      avatarUploaded: "Photo de profil mise à jour et vérifiée.",
      invalidCredMime: "Le document doit être au format PDF, PNG, JPEG ou WebP.",
      credUploadFailed: (err) => `Échec de l'envoi du justificatif : ${err}`,
      credUploaded: (file, cat) =>
        `Justificatif ${file} (${cat}) envoyé pour vérification.`,
      unsupportedDocFormat:
        "Format non pris en charge. Utilisez PDF, PNG, JPEG ou WebP.",
      facilityDocFailed: (err) => `Échec de l'envoi du document : ${err}`,
      facilityDocUploaded: (file) => `Document ${file} envoyé pour validation.`,
      enterEmailFirst: "Saisissez d'abord l'adresse e-mail du compte.",
      otpRequestError: (err) => `Erreur demande OTP : ${err}`,
      otpDispatched: (channel, mins) =>
        `Code de vérification envoyé via ${channel} (expire dans ${mins} min).`,
      passwordResetFailed: (err) => `Échec de la réinitialisation : ${err}`,
      passwordUpdated:
        "Mot de passe mis à jour. Connectez-vous avec vos nouveaux identifiants.",
      verificationFailed: (err) => `Échec de vérification : ${err}`,
      verifiedCleanly: (kind) =>
        `${kind === "email" ? "Adresse e-mail" : "Numéro de téléphone"} vérifié avec succès.`,
      pendingUploadAppend:
        "Veuillez téléverser vos justificatifs et sélectionner votre établissement ci-dessous.",
      invalidLoginFields:
        "Saisissez un e-mail professionnel ou téléphone valide et votre mot de passe.",
      serviceUnreachable: (url) =>
        `Serveur inaccessible à ${url}. Vérifiez la disponibilité du backend.`,
      signInRejected: (err) => {
        if (err === "USE_STAFF_PORTAL") {
          return "Les praticiens, pharmaciens, laboratoires, chauffeurs et administratifs doivent se connecter sur MediSync Pro (/pro).";
        }
        if (err === "USE_PATIENT_PORTAL") {
          return "Les comptes patients et aidants doivent se connecter depuis l'Espace Patient (/portal).";
        }
        return `Connexion refusée (${err}).`;
      },
      signedInMsg: (name, role, country) =>
        `Connecté en tant que ${name} (${role} · ${country}).`,
      invalidRegisterFields:
        "Indiquez votre nom complet, un e-mail ou téléphone valide et un mot de passe (8 car. min.).",
      registerFailed: (err) => `Échec de l'inscription (${err}).`,
      welcomeRegistered: (name, role) =>
        `Bienvenue ${name} ! Votre compte ${role} est prêt.`,
      workplaceFailed: (err) =>
        `Impossible d'enregistrer l'établissement (${err}).`,
      workplaceSaved: "Lieu d'exercice principal enregistré.",
      workplaceCleared: "Rattachement à l'établissement retiré.",
      refreshStatusFailed: (err) =>
        `Actualisation du statut impossible (${err}).`,
      stillPendingReview:
        "Toujours en attente de validation administrative. Vérifiez vos justificatifs.",
      adminApprovedMsg:
        "Approuvé ! L'administration a validé votre dossier et activé votre espace.",
      facilitySignInFirst:
        "Connectez-vous d'abord avec un compte médical ou administrateur.",
      facilityInvalidFields:
        "Complétez tous les champs de l'établissement avec des coordonnées GPS valides.",
      facilityLicenseMismatch: (license, country) =>
        `L'agrément « ${license} » ne correspond pas au format requis pour ${country}.`,
      facilityServiceDown:
        "Service d'enregistrement momentanément indisponible.",
      facilityRejected: (err) => `Soumission refusée (${err}).`,
      facilityRegistered: (name, status, notes) =>
        `Établissement « ${name} » enregistré (${status})${notes ? ` · ${notes}` : ""}.`,
      facilityVerifyFailed: (err) => `Échec de la validation (${err}).`,
      facilityVerifiedMsg: (name) =>
        `« ${name} » est désormais vérifié pour l'annuaire patient.`,
      signedOutRevoked: "Déconnecté et jeton de session révoqué.",
      enterPhoneForSms:
        "Saisissez votre numéro de mobile pour recevoir le code SMS à 6 chiffres.",
      enterSmsOtp: "Saisissez le code SMS à 6 chiffres reçu sur votre mobile.",
      phoneVerifyFailed: (err) => `Échec vérification SMS : ${err}`,
      welcomePhonePatient: (name) =>
        `Bienvenue ${name}. Session patient activée par téléphone.`,
      enterMobilePhone: "Saisissez votre numéro de téléphone.",
      enterEmailAddress: "Saisissez votre adresse e-mail.",
      patientRegisterFailed: (err) => `Échec inscription patient : ${err}`,
      patientReadyMsg: (name, country) =>
        `Compte patient prêt pour ${name} (${country}).`,
      enterCredentials:
        "Saisissez votre téléphone ou e-mail ainsi que votre mot de passe.",
      signedInPatientMsg: (name) =>
        `Connecté en tant que ${name}. Accès patient immédiat.`,
      googleFailed: (err) => `Échec connexion Google : ${err}`,
      signedInGoogleMsg: (name) => `Connecté avec Google en tant que ${name}.`,
      fullNameMin2: "Le nom complet doit contenir au moins 2 caractères.",
      profileUpdateFailed: (err) => `Échec mise à jour profil : ${err}`,
      profileSaved: "Profil personnel enregistré.",
      profileSynced: "Informations du profil mises à jour.",
      emailRequiredForVerify:
        "Un e-mail est requis sur le compte avant de lancer une vérification.",
      verifyCodeRequestFailed: (err) => `Demande de code échouée (${err}).`,
      verifyCodeReady: (kind, code, channel) =>
        code
          ? `Code ${kind === "email" ? "e-mail" : "SMS"} prêt (aperçu : ${code}).`
          : `Code de vérification envoyé par ${channel ?? "canal sécurisé"}.`,
      codeConfirmFailed: (err) => `Validation du code échouée (${err}).`,
      emailVerifiedNote: "Adresse e-mail vérifiée.",
      phoneVerifiedNote: "Numéro de mobile vérifié.",
      emailVerifiedBanner: "E-mail vérifié sur votre compte MediSync.",
      phoneVerifiedBanner: "Téléphone vérifié sur votre compte MediSync.",
      passwordChangeValidation:
        "Saisissez le mot de passe actuel et un nouveau mot de passe d'au moins 8 caractères.",
      invalidCurrentPassword: "Le mot de passe actuel est incorrect.",
      noPasswordSetUseReset:
        "Compte OTP/Google sans mot de passe. Utilisez Réinitialiser mot de passe.",
      passwordUpdateFailed: (err) => `Échec mise à jour mot de passe (${err}).`,
      passwordRotated:
        "Mot de passe modifié. Les autres appareils ont été déconnectés.",
      passwordChangedRevoked:
        "Mot de passe changé et anciennes sessions révoquées.",
      revokeFailed: (err) => `Échec révocation des sessions (${err}).`,
      otherSessionsRevoked:
        "Toutes les autres sessions actives ont été révoquées.",
      onlyThisBrowserSignedIn:
        "Autres sessions révoquées. Seul ce navigateur reste connecté.",
    },
  },
  ar: {
    careRegionPrefix: "نطاق الرعاية:",
    licenseExampleLabel: "مثال الترخيص:",
    tracksAriaLabel: "مسارات الدخول للمنصة",
    workflowTabsAriaLabel: "خيارات حساب المهنيين والمؤسسات",
    patientTrackTitle: "المريض ومرافق العائلة",
    patientTrackSubtitle: "الهاتف، البريد الإلكتروني أو جوجل · دخول فوري",
    staffTrackTitle: "الأطباء والأطقم الصحية والمصحات",
    staffTrackSubtitle: "أطباء، ممرضون، سائقو إسعاف، صيادلة ومختبرات",
    signedInAs: () => "مسجل الدخول باسم",
    backToProfile: "العودة للملف الشخصي والأمان",
    tabs: {
      signin: "دخول المهنيين",
      register: "إنشاء حسب التخصص",
      facility: "تسجيل مصحة أو مختبر",
    },
    onboarding: {
      ariaLabel: "مراحل تفعيل حساب المهنيين",
      checklistPrefix: "لائحة تفعيل الحساب المهني ·",
      headline: "أكمل وثائقك ومقر العمل لتفعيل الصلاحيات الكاملة",
      refreshBtn: "تحديث حالة القبول",
      step1Title: "1. تم تأكيد الهوية الأولية",
      step1Body: (name) =>
        `تم تسجيل دخولك باسم ${name}. أكمل الخطوات التالية ليتم تفعيل مساحة عملك من طرف الإدارة.`,
      step2Title: "2. وثائق الاعتماد المهنية",
      step2UploadedCount: (count) => `${count} مرفوعة`,
      step2BodyPrefix: "استعمل خانة",
      step2LinkText: "تأكيد الشهادات والتراخيص",
      step2BodySuffix: "لرفع رخصة المزاولة أو الدبلوم أو وثائق سيارة الإسعاف.",
      step3Title: "3. مقر العمل (العيادة أو المستشفى)",
      step3DriverBody:
        "يعمل السائقون بمرونة بين نقاط الاستلام المحددة والمصحات والمستشفيات الظاهرة على الخريطة.",
      step3SelectAria: "اختيار مقر العمل الرئيسي",
      step3SelectPlaceholder: "اختر العيادة أو المستشفى...",
      saveWorkplaceBtn: "حفظ مقر العمل",
      addOwnPlaceBtn: "+ إضافة مقر عمل جديد",
      verifiedTitle: "الحساب مُعتمد من الإدارة · المساحة مفعّلة",
      verifiedBody: (roleLabel) =>
        `تمت المصادقة على حسابك (${roleLabel}) ويمكنك الآن بدء العمل مباشرة على المنصة.`,
    },
    roleLabels: {
      PATIENT: "مريض",
      CAREGIVER: "مرافق عائلي",
      DOCTOR: "طبيب / أخصائي",
      NURSE: "ممرض(ة) مجاز(ة)",
      CLINIC_STAFF: "طاقم تنسيق واستقبال العيادة",
      HOSPITAL_ADMIN: "مدير ومنسق مستشفى",
      DRIVER: "سائق إسعاف وتوصيل طبي",
      PHARMACIST: "صيدلي مرخّص",
      LAB_TECH: "تقني مختبر التحاليل",
    },
    roleSummaries: {
      DOCTOR: "استشارات العيادة والفيديو، الجداول، التقرير الطبي ووصفة QR",
      NURSE: "التمريض المنزلي، قياس العلامات الحيوية، العناية بالجروح والتحاليل",
      DRIVER: "استقبال طلبات الإسعاف المباشرة وتتبع المسار",
      CLINIC_STAFF: "إدارة لائحة الانتظار وأطباء العيادة",
      HOSPITAL_ADMIN: "تدبير أسرّة الطوارئ وأسطول النقل",
      PHARMACIST: "قراءة وصفات QR، المخزون ومبيعات الصيدلية",
      LAB_TECH: "استقبال تحاليل المرضى وإرسال النتائج",
    },
    onboardingSummaries: {
      DOCTOR:
        "قم برفع شهادة الدكتوراه ورخصة المزاولة الوطنية، ثم اختر أو أضف العيادة أو المستشفى.",
      NURSE:
        "قم برفع دبلوم التمريض ورخصة المزاولة، ثم ربط الحساب بالعيادة أو مركز الرعاية المنزلية.",
      CLINIC_STAFF:
        "قم برفع شهادة التنسيق الإداري واختر العيادة أو المصحة التي تعمل بها.",
      DRIVER:
        "قم برفع رخصة السياقة وصورة فحص المركبة لتفعيل استقبال طلبات النقل المباشرة.",
      PHARMACIST: "قم برفع رخصة الصيدلة وربط الحساب بمقر الصيدلية.",
      LAB_TECH: "قم برفع اعتماد المختبر أو الدبلوم وربط الحساب بمقر المختبر.",
      default: "قم برفع الوثائق المهنية المطلوبة لمراجعتها وتفعيلها من طرف الإدارة.",
    },
    staffSignin: {
      introPrefix:
        "تسجيل دخول مخصص للأطباء، الممرضين، الصيادلة، تقنيي المختبر، سائقي الإسعاف ومدراء المصحات. للمرضى وعائلاتهم يرجى الدخول عبر",
      introLink: "بوابة المرضى",
      introSuffix: ".",
      workIdentifierLabel: "البريد المهني أو رقم الهاتف",
      workIdentifierPlaceholder: "dr.karim@clinic.ma أو +212600112233",
      passwordLabel: "كلمة المرور",
      hideCharsAria: "إخفاء الأحرف المدخلة",
      revealCharsAria: "إظهار الأحرف المدخلة",
      togglePwTitle: "إظهار أو إخفاء كلمة المرور",
      submittingBtn: "جاري التحقق من البيانات...",
      submitBtn: "تسجيل الدخول كمهني صحي",
    },
    staffRegister: {
      chooseFieldPrefix: "اختر تخصصك المهني ·",
      adminVerificationRequired: "يتطلب مراجعة الإدارة",
      instantActivation: "تفعيل فوري",
      roleCardsAria: "اختيار التخصص المهني",
      adminVerifiedPill: "بموافقة الإدارة",
      instantPill: "فوري",
      fullLegalNameLabel: "الاسم الكامل الرسمي",
      fullNamePlaceholder: "د. أمينة بنعلي",
      accountTypeLabel: "نوع الحساب",
      workEmailRequiredLabel: "البريد الإلكتروني المهني *",
      workEmailOptionalLabel: "البريد الإلكتروني (أو الهاتف)",
      workEmailPlaceholder: "amina@hospital.ma",
      staffEmailHint: "ضروري لإشعارات التحقق وتفعيل الحساب المهني.",
      mobilePhoneLabel: "رقم الهاتف المحمول (اختياري)",
      passwordMin8Label: "كلمة المرور (8 أحرف على الأقل)",
      passwordMin8Placeholder: "8 أحرف على الأقل",
      registeredForPrefix: "تسجيل ضمن شبكة",
      networkSuffix: "الصحية.",
      noteDoctor:
        "خطوة التحقق: ستدخل فوراً بحالة قيد المراجعة؛ ارفع رخصة المزاولة وصورة العيادة أسفله لتقوم الإدارة بتفعيل جدول المواعيد الخاص بك.",
      noteDriver:
        "خطوة التحقق: بعد إنشاء الحساب، ارفع رخصة السياقة وصورة المركبة الطبية لتفعيل إشعارات التنقل السريع.",
      noteStaff:
        "خطوة التحقق: يفتح الحساب بعد التسجيل لرفع شهادة العمل أو الترخيص أسفله ريثما تصادق الإدارة عليه.",
      notePatient:
        "يُفعّل حساب المريض والمرافق فوراً — لحفظ الأطباء المفضلين، مواعيد الزيارة والملفات الطبية المشتركة.",
      submittingBtn: "جاري إنشاء الحساب...",
      submitBtn: "إنشاء الحساب",
    },
    facilityForm: {
      officialNameLabel: "الاسم الرسمي للمؤسسة الصحية",
      officialNamePlaceholder: "مصحة الأطلس الدار البيضاء",
      sectorLabel: "نوع المؤسسة",
      ministryLicenseLabel: (country) => `رقم الترخيص الوزاري (${country})`,
      validFormat: "صيغة صحيحة",
      checkFormat: (example) => `تحقق من الصيغة (${example})`,
      streetAddressLabel: "العنوان الكامل",
      streetAddressPlaceholder: "18 شارع أنفا، الدار البيضاء",
      latLabel: "خط العرض (Latitude)",
      latPlaceholder: "مثال: 33.5731",
      lngLabel: "خط الطول (Longitude)",
      lngPlaceholder: "مثال: -7.5898",
      licenseProofLabel: "نسخة الترخيص الوزاري (اختياري)",
      licenseProofHint: "وثيقة PDF أو صورة PNG / JPEG / WebP",
      photoLabel: "صورة واجهة المؤسسة أو الاستقبال",
      photoHint: "صورة PNG أو JPEG أو WebP",
      submittingBtn: "جاري رفع وتسجيل المؤسسة...",
      submitBtn: "إرسال طلب تسجيل المؤسسة",
    },
    recovery: {
      verifyEmailBtn: "تأكيد البريد الإلكتروني",
      verifyPhoneBtn: "تأكيد رقم الهاتف SMS",
      resetPasswordBtn: "استعادة كلمة المرور",
      accountEmailLabel: "البريد الإلكتروني للحساب",
      mobileE164Label: "رقم الهاتف المحمول (E.164)",
      sendOtpBtn: "إرسال رمز التحقق (6 أرقام)",
      devOtpPrefix: "رمز تجريبي:",
      otpCodeLabel: "رمز التحقق من 6 أرقام",
      newPasswordLabel: "كلمة المرور الجديدة",
      newPasswordPlaceholder: "8 أحرف على الأقل",
      submitResetBtn: "تأكيد الرمز وتغيير كلمة المرور",
      submitVerifyBtn: "تأكيد رمز التحقق",
    },
    aside: {
      demoTitle: (country) => `حسابات تجريبية سريعة (${country})`,
      oneClickSwitch: "تبديل بنقرة",
      signedInProfileTitle: "الملف الشخصي النشط",
      signOutBtn: "تسجيل الخروج",
      pendingTitle: "في انتظار مصادقة الإدارة",
      pendingBody: (roleLabel) =>
        `حسابك (${roleLabel}) مسجل الدخول، لكن أدوات العيادة والصيدلية والمختبر والنقل تبقى مقفلة حتى تراجع الإدارة الرخصة المرفوعة أسفله.`,
      verifiedStaffBanner: "حساب مهني معتمد ومفعّل بالكامل",
      emailVerified: "البريد مؤكد",
      emailUnverified: "البريد غير مؤكد",
      phoneVerified: "الهاتف مؤكد",
      phoneUnverified: "الهاتف غير مؤكد",
      photoBtn: "صورة",
      verifyPersonalCredentialsLabel: "تأكيد الشهادات والتراخيص",
      credCategoryOptions: {
        PRACTITIONER_LICENSE: "رخصة مزاولة المهنة",
        MEDICAL_DEGREE: "الشهادة أو الدبلوم الصحي",
        BOARD_CERTIFICATION: "شهادة التخصص الطبي",
        MALPRACTICE_POLICY: "تأمين المسؤولية المهنية",
        DRIVER_LICENSE: "رخصة السياقة المهنية",
        VEHICLE_INSPECTION: "شهادة فحص المركبة",
        INSURANCE_CERTIFICATE: "شهادة تأمين المركبة",
        NATIONAL_ID: "البطاقة الوطنية (CIN)",
      },
      credScanLabel: "نسخة الوثيقة (PDF أو صورة)",
      credScanHint: "ارفع الرخصة أو الدبلوم",
      viewBtn: "عرض",
      refreshBtn: "تحديث",
      noFacilitiesInRegion: "لا توجد مؤسسات صحية مسجلة في هذه المنطقة حالياً.",
      facilityVerified: "معتمدة",
      facilityPending: "قيد المراجعة",
      docsBtn: "الوثائق",
      attachLicenseBtn: "+ إرفاق ترخيص",
      verifyFacilityBtn: "اعتماد المؤسسة",
      previewBtn: "معاينة",
      reviewStatusLabels: {
        PENDING: "قيد المراجعة",
        PENDING_REVIEW: "قيد المراجعة",
        APPROVED: "مقبول",
        REJECTED: "مرفوض",
      },
    },
    patientPanel: {
      bookingForLegend: "الحساب لـ",
      bookingForLabel: "الحساب لـ ·",
      myselfPatient: "لنـفسي (مريض)",
      familyCaregiver: "لمرافق عائلي",
      methodsAria: "طرق تسجيل دخول المريض",
      phoneMethodTab: "رقم الهاتف",
      emailMethodTab: "البريد الإلكتروني",
      googleMethodTab: "حساب جوجل",
      phoneOptionLabel: "خيار الدخول بالهاتف:",
      smsOtpBtn: "رمز SMS من 6 أرقام (بدون كلمة سر)",
      phonePasswordBtn: "الهاتف + كلمة المرور",
      fullNameLabel: "الاسم الكامل",
      fullNameNewHint: "(مطلوب للحسابات الجديدة)",
      fullNamePlaceholder: "سلمى بنعلي",
      phoneNumberLabel: "رقم الهاتف",
      mobilePhoneNumberLabel: "رقم الهاتف المحمول",
      sendingSmsBtn: "جاري إرسال الرسالة...",
      continuePhoneBtn: "المتابعة برقم الهاتف",
      smsSentTitle: (phone) =>
        `أدخل رمز التحقق المكون من 6 أرقام المرسل إلى ${phone}`,
      devSmsPreview: (code) => `رمز SMS التجريبي: ${code}`,
      otpCodeLabel: "رمز التحقق (6 أرقام)",
      verifyingBtn: "جاري التحقق...",
      verifyEnterBtn: "تأكيد والدخول لبوابة المريض",
      changeNumberBtn: "تغيير الرقم",
      signInWithPhoneTab: "الدخول بالهاتف",
      registerWithPhoneTab: "تسجيل حساب بالهاتف",
      phoneRegNamePlaceholder: "نادية الفاسي",
      passwordLabel: "كلمة المرور",
      passwordPlaceholder: "8 أحرف على الأقل",
      enterPasswordPlaceholder: "أدخل كلمة المرور",
      hideCharsAria: "إخفاء الأحرف",
      revealCharsAria: "إظهار الأحرف",
      togglePwTitle: "إظهار أو إخفاء كلمة المرور",
      createPhoneBtn: "إنشاء حساب مريض (بالهاتف)",
      signInPhonePwBtn: "الدخول بالهاتف وكلمة المرور",
      emailSignInTab: "الدخول بالبريد الإلكتروني",
      createAccountTab: "إنشاء حساب مريض جديد",
      resetOrVerifyLink: "استعادة كلمة المرور / تفعيل OTP",
      optionalLabel: "(اختياري)",
      emailRegNamePlaceholder: "أمين الإدريسي",
      patientEmailLabel: "البريد الإلكتروني للمريض",
      createEmailBtn: "إنشاء حساب مريض (بالبريد)",
      signInEmailBtn: "دخول المريض (بالبريد)",
    },
    profileCard: {
      verifiedAccountBadge: "حساب موثّق",
      activeAccountBadge: "حساب نشط",
      pendingVerificationBadge: "قيد المراجعة",
      accountProfileTitle: "الملف الشخصي وإعدادات الأمان",
      accountProfileSubtitle:
        "حدّث معلومات الاتصال، أكّد البريد والهاتف، غيّر كلمة المرور أو سجّل الخروج من باقي الأجهزة.",
      switchAccountBtn: "تبديل الحساب",
      identitySectionTitle: "الهوية ومعلومات الاتصال",
      lastLoginPrefix: "آخر دخول:",
      fullNameLabel: "الاسم الكامل",
      mobileE164Label: "رقم الهاتف (الصيغة الدولية)",
      primaryWorkplaceLabel: "المؤسسة الصحية الرئيسية",
      unassignedOption: "مستقل / غير مرتبط بمؤسسة",
      noEmailSet: "لم يتم تعيين بريد إلكتروني",
      verifyEmailBtn: "تأكيد البريد",
      emailVerifiedBadge: "البريد مؤكد",
      verifySmsBtn: "تأكيد الهاتف SMS",
      phoneVerifiedBadge: "الهاتف مؤكد",
      savingBtn: "جاري الحفظ...",
      saveProfileBtn: "حفظ البيانات",
      enterOtpPrompt: (channel, hint) =>
        `أدخل رمز ${channel === "email" ? "البريد الإلكتروني" : "رسالة SMS"} من 6 أرقام${hint ? ` (${hint})` : ""}:`,
      confirmCodeBtn: "تأكيد الرمز",
      cancelBtn: "إلغاء",
      securitySectionTitle: "كلمة المرور وأمان الجلسات",
      hidePasswordsBtn: "إخفاء",
      showPasswordsBtn: "إظهار",
      currentPasswordPlaceholder: "كلمة المرور الحالية",
      newPasswordPlaceholder: "كلمة مرور جديدة (8 أحرف+)",
      updatingBtn: "جاري التحديث...",
      updatePasswordBtn: "تحديث كلمة المرور",
      revokeSessionsHint:
        "تسجيل الخروج من الأجهزة الأخرى يبطل فوراً الجلسات المفتوحة على أي هاتف أو متصفح آخر.",
      revokeOtherSessionsBtn: "إنهاء الجلسات الأخرى",
      signOutDeviceBtn: "تسجيل الخروج من هذا الجهاز",
    },
    messages: {
      invalidAvatarMime: "صورة الملف الشخصي يجب أن تكون PNG أو JPEG أو WebP.",
      avatarUploadFailed: (err) => `تعذر رفع الصورة: ${err}`,
      avatarUploaded: "تم رفع الصورة الشخصية وحفظها.",
      invalidCredMime: "يجب أن تكون الوثيقة بصيغة PDF أو PNG أو JPEG أو WebP.",
      credUploadFailed: (err) => `تعذر رفع الوثيقة: ${err}`,
      credUploaded: (file, cat) => `تم رفع ${file} (${cat}) للمراجعة.`,
      unsupportedDocFormat:
        "صيغة الملف غير مدعومة. استعمل PDF أو PNG أو JPEG أو WebP.",
      facilityDocFailed: (err) => `تعذر رفع وثيقة المؤسسة: ${err}`,
      facilityDocUploaded: (file) => `تم رفع ${file} لمراجعة الإدارة.`,
      enterEmailFirst: "أدخل البريد الإلكتروني للحساب أولاً.",
      otpRequestError: (err) => `خطأ في طلب رمز التحقق: ${err}`,
      otpDispatched: (channel, mins) =>
        `تم إرسال رمز التحقق عبر ${channel} (صالح لمدة ${mins} دقيقة).`,
      passwordResetFailed: (err) => `تعذر تغيير كلمة المرور: ${err}`,
      passwordUpdated: "تم تحديث كلمة المرور بنجاح. سجل الدخول الآن.",
      verificationFailed: (err) => `فشل التحقق: ${err}`,
      verifiedCleanly: (kind) =>
        `تم تأكيد ${kind === "email" ? "البريد الإلكتروني" : "رقم الهاتف"} بنجاح.`,
      pendingUploadAppend:
        "يرجى رفع وثائق الاعتماد واختيار مقر العمل أسفله لتفعيل الحساب.",
      invalidLoginFields: "أدخل البريد المهني أو رقم الهاتف وكلمة المرور بشكل صحيح.",
      serviceUnreachable: (url) =>
        `تعذر الاتصال بالخادم على ${url}. تأكد من تشغيل الخدمة.`,
      signInRejected: (err) => {
        if (err === "USE_STAFF_PORTAL") {
          return "يجب على الأطباء والصيادلة وموظفي العيادات والمختبرات وسائقي الإسعاف الدخول عبر بوابة المهنيين Pro (/pro).";
        }
        if (err === "USE_PATIENT_PORTAL") {
          return "يجب على المرضى ومرافقي العائلات الدخول عبر بوابة المرضى (/portal).";
        }
        return `تم رفض تسجيل الدخول (${err}).`;
      },
      signedInMsg: (name, role, country) =>
        `تم تسجيل الدخول باسم ${name} (${role} · ${country}).`,
      invalidRegisterFields:
        "أدخل الاسم الكامل، بريداً أو رقماً صحيحاً، وكلمة مرور من 8 أحرف على الأقل.",
      registerFailed: (err) => `تعذر إنشاء الحساب (${err}).`,
      welcomeRegistered: (name, role) =>
        `مرحباً ${name}! حسابك (${role}) جاهز الآن.`,
      workplaceFailed: (err) => `تعذر حفظ مقر العمل (${err}).`,
      workplaceSaved: "تم حفظ مقر العمل الرئيسي في ملفك.",
      workplaceCleared: "تمت إزالة ربط مقر العمل.",
      refreshStatusFailed: (err) => `تعذر تحديث حالة الحساب (${err}).`,
      stillPendingReview:
        "الحساب ما زال قيد مراجعة الإدارة. تأكد من رفع جميع الوثائق المطلوبة.",
      adminApprovedMsg:
        "تمت الموافقة! قامت الإدارة بتفعيل شهاداتك وفتح مساحة العمل.",
      facilitySignInFirst:
        "يرجى تسجيل الدخول بحساب مهني أو إداري قبل تسجيل مؤسسة صحية.",
      facilityInvalidFields:
        "أكمل جميع بيانات المؤسسة مع إحداثيات موقع صحيحة على الخريطة.",
      facilityLicenseMismatch: (license, country) =>
        `رقم الترخيص "${license}" لا يطابق الصيغة المعتمدة لـ ${country}.`,
      facilityServiceDown: "تعذر الوصول لخدمة تسجيل المؤسسات حالياً.",
      facilityRejected: (err) => `تم رفض تسجيل المؤسسة (${err}).`,
      facilityRegistered: (name, status, notes) =>
        `تم تسجيل "${name}" (${status})${notes ? ` · ${notes}` : ""}.`,
      facilityVerifyFailed: (err) => `تعذر اعتماد المؤسسة (${err}).`,
      facilityVerifiedMsg: (name) =>
        `تم اعتماد "${name}" وإظهارها للمرضى على المنصة.`,
      signedOutRevoked: "تم تسجيل الخروج وإبطال الجلسة.",
      enterPhoneForSms: "أدخل رقم هاتفك المحمول لاستلام رمز SMS من 6 أرقام.",
      enterSmsOtp: "أدخل رمز التحقق المكون من 6 أرقام المرسل لهاتفك.",
      phoneVerifyFailed: (err) => `فشل التحقق من الهاتف: ${err}`,
      welcomePhonePatient: (name) =>
        `مرحباً ${name}. تم تفعيل جلسة المريض عبر الهاتف المؤكد.`,
      enterMobilePhone: "أدخل رقم هاتفك المحمول.",
      enterEmailAddress: "أدخل عنوان بريدك الإلكتروني.",
      patientRegisterFailed: (err) => `تعذر تسجيل حساب المريض: ${err}`,
      patientReadyMsg: (name, country) =>
        `حساب المريض جاهز لـ ${name} (${country}).`,
      enterCredentials: "أدخل الهاتف أو البريد وكلمة المرور.",
      signedInPatientMsg: (name) =>
        `تم الدخول باسم ${name}. حساب المريض مفعّل بالكامل.`,
      googleFailed: (err) => `فشل الدخول عبر جوجل: ${err}`,
      signedInGoogleMsg: (name) => `تم تسجيل الدخول بحساب جوجل: ${name}.`,
      fullNameMin2: "الاسم الكامل يجب أن يكون حرفين على الأقل.",
      profileUpdateFailed: (err) => `فشل تحديث الملف (${err}).`,
      profileSaved: "تم حفظ بيانات الحساب الشخصي.",
      profileSynced: "تم تحديث ومزامنة معلومات الحساب.",
      emailRequiredForVerify:
        "يلزم وجود بريد إلكتروني في الحساب قبل بدء التحقق المباشر.",
      verifyCodeRequestFailed: (err) => `فشل طلب رمز التحقق (${err}).`,
      verifyCodeReady: (kind, code, channel) =>
        code
          ? `رمز ${kind === "email" ? "البريد" : "SMS"} جاهز (تجريبي: ${code}).`
          : `تم إرسال رمز من 6 أرقام عبر ${channel ?? "القناة المعتمدة"}.`,
      codeConfirmFailed: (err) => `تعذر تأكيد الرمز (${err}).`,
      emailVerifiedNote: "تم تأكيد البريد الإلكتروني.",
      phoneVerifiedNote: "تم تأكيد رقم الهاتف.",
      emailVerifiedBanner: "تم تأكيد بريدك الإلكتروني في حساب MediSync.",
      phoneVerifiedBanner: "تم تأكيد رقم هاتفك في حساب MediSync.",
      passwordChangeValidation:
        "أدخل كلمة المرور الحالية وكلمة مرور جديدة من 8 أحرف على الأقل.",
      invalidCurrentPassword: "كلمة المرور الحالية غير صحيحة.",
      noPasswordSetUseReset:
        "لا توجد كلمة مرور لحسابات OTP/جوجل بعد. استعمل استعادة كلمة المرور.",
      passwordUpdateFailed: (err) => `فشل تحديث كلمة المرور (${err}).`,
      passwordRotated:
        "تم تغيير كلمة المرور وإخراج جميع الأجهزة الأخرى تلقائياً.",
      passwordChangedRevoked: "تم تغيير كلمة المرور وإبطال جلسات الأجهزة الأخرى.",
      revokeFailed: (err) => `فشل إنهاء الجلسات (${err}).`,
      otherSessionsRevoked: "تم إنهاء جميع الجلسات على الأجهزة الأخرى فوراً.",
      onlyThisBrowserSignedIn: "تم إنهاء باقي الجلسات. هذا المتصفح فقط بقي متصلاً.",
    },
  },
};
