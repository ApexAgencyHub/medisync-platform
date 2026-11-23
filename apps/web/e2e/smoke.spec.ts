import { test, expect } from "@playwright/test";

const VIEWPORTS = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "widescreen", width: 1920, height: 1080 },
  { name: "mobile", width: 390, height: 844 },
] as const;

for (const vp of VIEWPORTS) {
  test(`smoke: renders MediSync Global cleanly without errors or overflow (${vp.name})`, async ({
    page,
  }) => {
    const pageErrors: string[] = [];
    const consoleErrors: string[] = [];
    const badResponses: string[] = [];

    page.on("pageerror", (err) => pageErrors.push(err.message));
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
    page.on("response", (res) => {
      if (res.status() >= 400) {
        badResponses.push(`${res.status()} ${res.url()}`);
      }
    });

    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.goto("/", { waitUntil: "networkidle" });

    await expect(
      page.getByRole("heading", { name: /Global medical coordination/i }),
    ).toBeVisible();

    // Verify transparent logo mark, interactive map-styled home hero (with zero 3D canvas), and all images loaded cleanly
    const logoLoaded = await page
      .locator('img[alt="MediSync Global emblem"]')
      .evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0);
    await expect(page.locator("canvas")).toHaveCount(0);
    const mapHeroBox = await page
      .locator('[data-home-map-hero="true"] [role="region"][aria-label*="street map" i]')
      .boundingBox();
    expect(logoLoaded).toBe(true);
    await expect
      .poll(async () =>
        page
          .locator("main img")
          .evaluateAll((imgs: HTMLImageElement[]) =>
            imgs.length > 0 &&
            imgs.every((img) => img.complete && img.naturalWidth > 0),
          ),
      )
      .toBe(true);
    expect(mapHeroBox).not.toBeNull();
    expect(mapHeroBox!.width).toBeGreaterThan(300);
    expect(mapHeroBox!.height).toBeGreaterThan(300);

    // Verify all bundled studio medical portraits, facilities, vehicles, and pharmacy WebPs serve cleanly
    const mediaPaths = [
      "/media/avatars/doctor-female.webp",
      "/media/avatars/doctor-male.webp",
      "/media/avatars/nurse-infirmier.webp",
      "/media/avatars/pharmacist.webp",
      "/media/avatars/lab-tech.webp",
      "/media/avatars/driver-ems.webp",
      "/media/avatars/patient.webp",
      "/media/facilities/clinic-interior.webp",
      "/media/facilities/hospital-hub.webp",
      "/media/facilities/pharmacy-interior.webp",
      "/media/vehicles/medical-transport-car.webp",
      "/media/vehicles/ambulance-van.webp",
      "/media/products/otc-medication.webp",
      "/media/products/rx-prescription.webp",
      "/media/products/medical-device.webp",
      "/media/products/wellness-supplement.webp",
      "/media/products/pediatric-care.webp",
      "/media/products/cold-chain.webp",
      "/media/scenes/telehealth-video.webp",
      "/media/scenes/diagnostic-imaging-lab.webp",
      "/media/scenes/home-nursing-visit.webp",
      "/media/scenes/ehr-digital-records.webp",
      "/media/icons/icon-consultation.webp",
      "/media/icons/icon-telehealth.webp",
      "/media/icons/icon-home-care.webp",
      "/media/icons/icon-diagnostics.webp",
      "/media/icons/icon-pharmacy.webp",
      "/media/icons/icon-ambulance.webp",
      "/media/icons/icon-ehr.webp",
      "/media/icons/icon-staff-verify.webp",
    ];
    const decodedCount = await page.evaluate(async (paths) => {
      const results = await Promise.all(
        paths.map(
          (src) =>
            new Promise<boolean>((resolve) => {
              const img = new Image();
              img.onload = () => resolve(img.naturalWidth > 0);
              img.onerror = () => resolve(false);
              img.src = src;
            }),
        ),
      );
      return results.filter(Boolean).length;
    }, mediaPaths);
    expect(decodedCount).toBe(mediaPaths.length);

    // Helper: opens the right-aligned Sidebar Menu and selects a workspace link
    const navigateTo = async (linkLabel: string) => {
      await page
        .getByRole("button", { name: /Open navigation and language menu/i })
        .click();
      await page
        .getByRole("navigation", { name: "Sidebar Workspace Navigation" })
        .getByRole("link", { name: linkLabel, exact: true })
        .click();
    };

    // Verify clean stripped header: logo/name on the left, menu button on the right, no extra nav/language toggles
    await expect(page.locator("header nav")).toHaveCount(0);
    await expect(
      page
        .locator("header")
        .getByRole("group", { name: "Interface language selector" }),
    ).toHaveCount(0);
    const logoBox = await page
      .locator('header img[alt="MediSync Global emblem"]')
      .boundingBox();
    const menuBox = await page
      .locator("header")
      .getByRole("button", { name: /Open navigation and language menu/i })
      .boundingBox();
    expect(logoBox).not.toBeNull();
    expect(menuBox).not.toBeNull();
    expect(menuBox!.x).toBeGreaterThan(logoBox!.x);

    // Confirm clicking a live facility pin on the map-styled home hero opens the map preview card (and NO image zoom modal)
    const firstHomePin = page
      .locator('[data-home-map-hero="true"] button[data-map-pin="true"]')
      .first();
    await expect(firstHomePin).toBeVisible();
    await firstHomePin.click();
    await expect(page.locator('[data-home-pin-preview="true"]')).toBeVisible();
    await page
      .locator('[data-home-pin-preview="true"]')
      .getByRole("button", { name: /Close map pin preview/i })
      .click();
    await expect(page.locator('[data-home-pin-preview="true"]')).toHaveCount(0);
    await expect(
      page.getByRole("dialog", { name: /Image preview:/i }),
    ).toHaveCount(0);

    // Verify immediate care action launcher above the fold & sidebar multilingual switcher
    await expect(
      page.getByRole("link", { name: /Find Care on Map/i }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: /Open navigation and language menu/i })
      .click();
    const langGroup = page.getByRole("group", {
      name: "Interface language selector",
    });
    await langGroup.getByRole("button", { name: /Français/i }).click();
    await page.getByRole("button", { name: /Fermer le menu/i }).click();
    await expect(
      page.getByRole("link", { name: /Explorer la carte des soins/i }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: /Ouvrir le menu et les langues/i })
      .click();
    const sidebarNav = page.getByRole("navigation", {
      name: "Sidebar Workspace Navigation",
    });
    await expect(sidebarNav.locator('a[href="/driver"]')).toHaveCount(0);
    await expect(sidebarNav.locator('a[href="/clinical"]')).toHaveCount(0);
    await expect(sidebarNav.locator('a[href="/nurse"]')).toHaveCount(0);
    await expect(sidebarNav.locator('a[href="/hospital"]')).toHaveCount(0);
    await expect(sidebarNav.locator('a[href="/lab"]')).toHaveCount(0);
    await expect(sidebarNav.locator('a[href="/admin"]')).toHaveCount(0);
    await expect(sidebarNav.locator('a[href="/pro"]')).toHaveCount(0);
    await expect(
      page.getByRole("link", { name: /Personnel Médical & Partenaires/i }),
    ).toBeVisible();
    await langGroup.getByRole("button", { name: /English/i }).click();
    await page.getByRole("button", { name: /Close menu/i }).click();

    await expect(
      page.getByRole("link", { name: /Join as Medical Partner \/ Driver/i }),
    ).toBeVisible();

    // Verify Morocco (MA) is active natively with hotline 141 and no region switcher buttons
    await expect(page.getByText(/Care Region: Morocco/i).first()).toBeVisible();
    await expect(page.getByText(/141 \/ 15/).first()).toBeVisible();
    await expect(
      page.getByRole("group", { name: "Country region switcher" }),
    ).toHaveCount(0);

    const hasOverflowHome = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    );
    expect(hasOverflowHome, "Horizontal scroll overflow on /").toBe(false);

    // Navigate to Dedicated Care Profiles & Fleet Directory (/profiles)
    await navigateTo("Profiles");
    await expect(
      page.getByRole("heading", {
        name: /Care Providers, Clinics, Hospitals & Transport Units/i,
      }),
    ).toBeVisible();
    await expect(page.getByText("Morocco", { exact: true }).first()).toBeVisible();

    const inspectTriggers = page.getByRole("button", {
      name: /^Inspect /i,
    });
    if ((await inspectTriggers.count()) > 0) {
      await inspectTriggers.first().click();
      const splitModal = page.getByRole("dialog", { name: /Image preview:/i });
      await expect(splitModal).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(splitModal).toBeHidden();
    }

    const hasOverflowProfiles = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    );
    expect(hasOverflowProfiles, "Horizontal scroll overflow on /profiles").toBe(
      false,
    );

    // Navigate to Patient Sign In (/portal) — strictly isolated Consumer Access
    await navigateTo("Patient Sign In");
    await expect(
      page.getByRole("heading", { name: /Sign In to MediSync Care/i }),
    ).toBeVisible();

    // Consumer portal must NOT mix Healthcare Staff / Clinic tabs into patient sign-in
    await expect(
      page.getByRole("tab", { name: /Healthcare Staff/i }),
    ).toHaveCount(0);
    await expect(page.getByLabel("Account role cards")).toHaveCount(0);
    await expect(page.getByLabel("Patient care region")).toHaveCount(0);

    const patientMethods = page.getByRole("tablist", {
      name: "Patient authentication methods",
    });
    await expect(
      patientMethods.getByRole("tab", { name: "Phone Number", exact: true }),
    ).toBeVisible();
    await expect(
      patientMethods.getByRole("tab", { name: "Email", exact: true }),
    ).toBeVisible();
    await expect(
      patientMethods.getByRole("tab", { name: "Google", exact: true }),
    ).toBeVisible();

    const hasOverflowPortal = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    );
    expect(hasOverflowPortal, "Horizontal scroll overflow on /portal").toBe(
      false,
    );

    // Navigate via dedicated partner link to MediSync Pro (/pro) — Staff & Facility Portal
    await page.getByRole("link", { name: /Go to MediSync Pro/i }).click();
    await expect(page).toHaveURL(/\/pro$/);
    await expect(
      page.getByRole("heading", { name: /MediSync Pro — Staff & Partner Portal/i }),
    ).toBeVisible();

    // Pro portal must NOT show consumer Patient track tabs
    await expect(
      page.getByRole("tab", { name: /Patient & Caregiver/i }),
    ).toHaveCount(0);

    // Verify Care Region defaults cleanly to Morocco (MA) and test tabs + live license validation
    await expect(page.getByText(/Care Region:\s*Morocco/i).first()).toBeVisible();
    await expect(page.getByLabel(/Work Email or Phone Number/i)).toBeVisible();
    await page.getByRole("tab", { name: /Join by Field/i }).click();
    await expect(page.getByLabel(/Mobile Phone/i)).toBeVisible();
    await expect(page.getByLabel("Account Type")).toBeVisible();
    await expect(page.getByLabel("Account Type")).not.toContainText("OPS_ADMIN");
    await expect(page.getByLabel("Account Type")).not.toContainText("Patient");
    await expect(
      page.getByRole("radiogroup", { name: "Account role cards" }),
    ).toBeVisible();
    await page
      .getByRole("radio", { name: /Medical Transport Driver/i })
      .click();
    await expect(
      page.getByText(/upload your Driver License and Vehicle Inspection Photo/i),
    ).toBeVisible();
    await expect(
      page.getByText(/Admin Verification Required/i).first(),
    ).toBeVisible();

    await page.getByRole("tab", { name: /Register Facility/i }).click();
    const licenseInput = page.getByLabel(/Ministry License \(MA\)/i);
    await licenseInput.fill("BADFORMAT");
    await expect(page.getByText(/Check Format/i)).toBeVisible();
    await licenseInput.fill("MA-CLIN-90812");
    await expect(page.getByText("Valid Format")).toBeVisible();
    await expect(page.locator("#fac-license-file")).toBeAttached();
    await expect(page.locator("#fac-photo-file")).toBeAttached();

    // Verify quick-demo staff/doctor portraits load cleanly when backend is active on /pro
    const proAvatars = page.locator('img[src*="/media/avatars/"]');
    if ((await proAvatars.count()) > 0) {
      const firstProAvatar = proAvatars.first();
      await firstProAvatar.scrollIntoViewIfNeeded();
      await expect
        .poll(async () =>
          firstProAvatar.evaluate(
            (img: HTMLImageElement) => img.complete && img.naturalWidth > 0,
          ),
        )
        .toBe(true);
    }

    const hasOverflowPro = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    );
    expect(hasOverflowPro, "Horizontal scroll overflow on /pro").toBe(
      false,
    );

    // Navigate from /pro to Live Medical Map & Dispatch Console (/map)
    await navigateTo("Live Map");
    await expect(
      page.getByRole("searchbox", { name: /Search facilities or doctors/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Search This Area/i }),
    ).toHaveCount(0);

    // Verify slippy street-map tiles render without broken images
    await expect
      .poll(async () =>
        page
          .locator('img[src^="/api/map-tiles/"]')
          .first()
          .evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0),
      )
      .toBe(true);

    await expect(page.getByText(/Casablanca Central Metro/i)).toBeVisible();
    await expect(page.getByRole("button", { name: "Pan north" })).toHaveCount(0);

    const mapPhotoPins = page.locator('[role="region"] img[src*="/media/"]');
    if ((await mapPhotoPins.count()) > 0) {
      await expect
        .poll(async () =>
          mapPhotoPins
            .first()
            .evaluate(
              (img: HTMLImageElement) => img.complete && img.naturalWidth > 0,
            ),
        )
        .toBe(true);
    }

    await expect(
      page.getByRole("button", { name: /All Sectors/i }),
    ).toHaveCount(0);
    const modeDropdown = page.locator('button[role="combobox"]', {
      hasText: /Ambulances & Drivers/i,
    });
    await expect(modeDropdown).toBeVisible();

    await modeDropdown.click();
    await page
      .getByRole("listbox", { name: "Service category options" })
      .getByRole("option", { name: "Hospitals" })
      .click();
    await page.getByRole("button", { name: "Zoom in viewport" }).click();

    await page.getByRole("button", { name: "Expand full-screen map" }).click();
    await expect(
      page.getByRole("button", { name: "Exit full-screen map" }),
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(
      page.getByRole("button", { name: "Expand full-screen map" }),
    ).toBeVisible();

    await page
      .locator('button[role="combobox"]', { hasText: /Hospitals/i })
      .click();
    await page
      .getByRole("listbox", { name: "Service category options" })
      .getByRole("option", { name: "Doctors & Nurses" })
      .click();

    await page
      .locator('button[role="combobox"]', { hasText: /Doctors & Nurses/i })
      .click();
    await page
      .getByRole("listbox", { name: "Service category options" })
      .getByRole("option", { name: "Ambulances & Drivers" })
      .click();

    await expect(
      page.getByRole("button", { name: /1-Tap Fast Book/i }),
    ).toBeVisible();

    const hasOverflowMap = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    );
    expect(hasOverflowMap, "Horizontal scroll overflow on /map").toBe(false);

    // Navigate from /map to Multi-Clinic Booking Engine (/booking)
    await navigateTo("Booking");
    await expect(
      page.getByRole("heading", {
        name: /Doctor Appointments & Clinic Hours/i,
      }),
    ).toBeVisible();
    await expect(
      page.getByText(/Publish Multi-Clinic Shift Window/i),
    ).toHaveCount(0);

    await expect(
      page.getByText(/Available Practitioners & Time Windows/i),
    ).toBeVisible();
    await expect(page.getByText(/MAD/i).first()).toBeVisible();

    const doctorAvatars = page.locator('img[src*="/media/avatars/"]');
    if ((await doctorAvatars.count()) > 0) {
      const firstDoctorAvatar = doctorAvatars.first();
      await firstDoctorAvatar.scrollIntoViewIfNeeded();
      await expect
        .poll(async () =>
          firstDoctorAvatar.evaluate(
            (img: HTMLImageElement) => img.complete && img.naturalWidth > 0,
          ),
        )
        .toBe(true);
    }

    const hasOverflowBooking = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    );
    expect(hasOverflowBooking, "Horizontal scroll overflow on /booking").toBe(
      false,
    );

    // Verify unauthenticated visitor sees Role Access Gate on protected /clinical rather than raw clinical inputs
    await page.goto("/clinical");
    await expect(
      page.getByRole("heading", {
        name: /Clinical Care, QR E-Prescriptions & Diagnostic Labs/i,
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", {
        name: /Clinical Care & Consultation Desk — Sign-In Required/i,
      }),
    ).toBeVisible();
    await expect(page.locator("select#clin-patient-uuid")).toHaveCount(0);
    await expect(
      page.getByText(/Publish Multi-Clinic Shift Window/i),
    ).toHaveCount(0);

    const hasOverflowClinical = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    );
    expect(hasOverflowClinical, "Horizontal scroll overflow on /clinical").toBe(
      false,
    );

    // Navigate from /clinical back to public Pharmacy Storefront (/pharmacy)
    await navigateTo("Pharmacy");
    await expect(
      page.getByRole("heading", {
        name: /Online Pharmacy Catalog & Courier Checkout/i,
      }),
    ).toBeVisible();
    await expect(page.locator("#pharma-search")).toBeVisible();
    await expect(page.locator("#pharma-facility-filter")).toBeVisible();
    await expect(
      page.getByRole("tab", { name: /Pharmacist Stock Manager/i }),
    ).toHaveCount(0);

    const productThumbs = page.locator('img[src*="/media/products/"]');
    if ((await productThumbs.count()) > 0) {
      const firstProductThumb = productThumbs.first();
      await firstProductThumb.scrollIntoViewIfNeeded();
      await expect
        .poll(async () =>
          firstProductThumb.evaluate(
            (img: HTMLImageElement) => img.complete && img.naturalWidth > 0,
          ),
        )
        .toBe(true);
    }

    // Verify EN / FR / AR bilingual toggle in Sidebar Menu updates document dir="rtl" cleanly then resets to EN
    await page
      .getByRole("button", { name: /Open navigation and language menu/i })
      .click();
    await langGroup.getByRole("button", { name: /العربية/i }).click();
    const htmlDir = await page.evaluate(() => document.documentElement.dir);
    expect(htmlDir).toBe("rtl");
    await langGroup.getByRole("button", { name: /English/i }).click();
    await page.getByRole("button", { name: /Close menu/i }).click();

    const hasOverflowPharmacy = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    );
    expect(hasOverflowPharmacy, "Horizontal scroll overflow on /pharmacy").toBe(
      false,
    );

    // Verify unauthenticated direct visit to /hospital and /admin shows Role Sign-In Gates (no internal ops tabs)
    await page.goto("/hospital");
    await expect(
      page.getByRole("heading", {
        name: /Hospital & Clinic Reception Command — Sign-In Required/i,
      }),
    ).toBeVisible();

    await page.goto("/admin");
    await expect(
      page.getByRole("heading", {
        name: "Master Operations & Compliance Center",
        exact: true,
      }),
    ).toBeVisible();
    await expect(page.getByText("MAD", { exact: true })).toBeVisible();
    await expect(
      page.getByRole("heading", {
        name: /Master Operations & Compliance Center — Sign-In Required/i,
      }),
    ).toBeVisible();
    await expect(page.locator("select#admin-dispute-target")).toHaveCount(0);

    const hasOverflowAdmin = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    );

    // Navigate back from /admin to Welcoming Patient Homepage (/patient)
    await navigateTo("My Care");
    await expect(
      page.getByRole("heading", {
        name: /Find Care, Track Visits & Open the Live Map/i,
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("navigation", { name: "Patient homepage menu" }),
    ).toBeVisible();

    const patientSearchBox = page.getByRole("searchbox", {
      name: /Search doctors, ambulances, clinics, pharmacies, or services/i,
    });
    await expect(patientSearchBox).toBeVisible();
    await patientSearchBox.fill("Ambulance");
    await expect(
      page.getByText(/Emergency Ambulance & Medical Transport/i),
    ).toBeVisible();
    await patientSearchBox.fill("");

    await expect(
      page.getByText(/Your private clinical documents stay protected/i),
    ).toBeVisible();

    const hasOverflowPatient = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    );

    // Trigger 1-Tap Fast Book from /map and verify live pickup tracking persists across reload on /patient
    await page.getByRole("link", { name: /1-Tap Fast Book Ride/i }).click();
    await expect(
      page.getByRole("heading", { name: /1-Tap Fast Book/i }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: /Fast Book Nearest Driver/i })
      .click();
    await expect(
      page.getByText(/1-Tap Fast Book.*broadcasted/i),
    ).toBeVisible();

    await navigateTo("My Care");
    await page.waitForURL("**/patient");
    await expect(
      page.getByRole("heading", {
        name: /Find Care, Track Visits & Open the Live Map/i,
      }),
    ).toBeVisible();
    await page.reload();
    await expect(
      page.getByRole("heading", {
        name: /Find Care, Track Visits & Open the Live Map/i,
      }),
    ).toBeVisible();
    await expect(
      page.getByText(/Medical Pickup (Alert|Request)/i).first(),
    ).toBeVisible();

    expect(pageErrors, "Unexpected uncaught page errors").toEqual([]);
    expect(consoleErrors, "Unexpected console.error logs").toEqual([]);
    expect(badResponses, "Unexpected >= 400 HTTP responses").toEqual([]);
    expect(hasOverflowAdmin, "Horizontal scroll overflow on /admin").toBe(
      false,
    );
    expect(hasOverflowPatient, "Horizontal scroll overflow on /patient").toBe(
      false,
    );
  });
}

test.describe("driver workspace: relay map, accept/refuse & admin gate", () => {
  const DRIVER_ID = "11111111-1111-4111-8111-111111111111";
  const PATIENT_ID = "22222222-2222-4222-8222-222222222222";
  const OWNER_ID = "33333333-3333-4333-8333-333333333333";
  const HOSPITAL_ID = "44444444-4444-4444-8444-444444444444";
  const PHARMACY_ID = "55555555-5555-4555-8555-555555555555";
  const CLIENT_A_ID = "66666666-6666-4666-8666-666666666666";
  const CLIENT_B_ID = "77777777-7777-4777-8777-777777777777";
  const NOW_ISO = "2026-11-14T12:00:00.000Z";

  test("unauthenticated visitor sees clean driver portal access gate on /driver", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/driver", { waitUntil: "networkidle" });
    await expect(
      page.getByRole("heading", {
        name: /Sign in with your verified driver account/i,
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /Register or Sign In as Driver/i }),
    ).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    );
    expect(overflow).toBe(false);
  });

  test("pending unverified driver sees compulsory admin verification notice on /driver", async ({
    page,
  }) => {
    await page.addInitScript(
      ({ driverId, nowIso }) => {
        window.localStorage.setItem(
          "medisync.session.v1",
          JSON.stringify({
            token: "test-pending-driver-jwt",
            user: {
              id: driverId,
              email: "pending.driver@medisync.ma",
              fullName: "Youssef Pending Driver",
              role: "DRIVER",
              countryCode: "MA",
              facilityId: null,
              avatarUrl: null,
              emailVerified: true,
              phone: "+212600000111",
              phoneVerified: true,
              authProvider: "LOCAL",
              accountStatus: "PENDING_APPROVAL",
              credentialVerified: false,
              lastLoginAtIso: nowIso,
              createdAtIso: nowIso,
            },
          }),
        );
      },
      { driverId: DRIVER_ID, nowIso: NOW_ISO },
    );

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/driver", { waitUntil: "networkidle" });
    await expect(
      page.getByText(/Awaiting Administration Approval|Verification Required/i).first(),
    ).toBeVisible();
    await expect(page.getByText(/Incoming & Active Clients/i)).toHaveCount(0);
  });

  for (const vp of [
    { name: "desktop", width: 1440, height: 900 },
    { name: "mobile", width: 390, height: 844 },
  ] as const) {
    test(`verified driver views clients & destination hospitals on shared map, accepts and refuses (${vp.name})`, async ({
      page,
    }) => {
      const pageErrors: string[] = [];
      const consoleErrors: string[] = [];
      page.on("pageerror", (err) => pageErrors.push(err.message));
      page.on("console", (msg) => {
        if (msg.type() === "error") consoleErrors.push(msg.text());
      });

      const serverDispatches = [
        {
          id: CLIENT_A_ID,
          countryCode: "MA",
          patientUserId: PATIENT_ID,
          driverUserId: null as string | null,
          targetFacilityId: HOSPITAL_ID,
          pickupLat: 33.584,
          pickupLng: -7.624,
          pickupAddress: "Boulevard d'Anfa Pickup 12",
          urgency: "EMERGENCY",
          status: "REQUESTED",
          notes: "Acute chest pain · Rapid transport to CHU",
          createdAtIso: NOW_ISO,
          updatedAtIso: NOW_ISO,
        },
        {
          id: CLIENT_B_ID,
          countryCode: "MA",
          patientUserId: PATIENT_ID,
          driverUserId: null as string | null,
          targetFacilityId: HOSPITAL_ID,
          pickupLat: 33.579,
          pickupLng: -7.632,
          pickupAddress: "Maarif Rue Jura Pickup 8",
          urgency: "URGENT",
          status: "REQUESTED",
          notes: "Wheelchair hospital transfer",
          createdAtIso: NOW_ISO,
          updatedAtIso: NOW_ISO,
        },
      ];
      const declinedIds = new Set<string>();

      await page.route("**/api/backend-status", (route) =>
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ online: true }),
        }),
      );
      await page.route("**/v1/users/me/media*", (route) =>
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ documents: [] }),
        }),
      );
      await page.route("**/v1/directory/facilities*", (route) =>
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ facilities: [] }),
        }),
      );
      await page.route("**/v1/directory/drivers*", (route) =>
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ drivers: [] }),
        }),
      );
      await page.route("**/v1/maps/facilities/viewport*", (route) =>
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            queryMs: 4,
            facilities: [
              {
                id: HOSPITAL_ID,
                name: "CHU Ibn Rochd",
                kind: "HOSPITAL",
                countryCode: "MA",
                licenseNumber: "MA-HOSP-101",
                verificationStatus: "VERIFIED",
                lat: 33.575,
                lng: -7.619,
                address: "1 Rue des Hopitaux, Casablanca",
                ownerUserId: OWNER_ID,
                createdAtIso: NOW_ISO,
                openStatus: "OPEN",
                is24_7: true,
                acceptsEmergency: true,
                specialties: ["Emergency"],
                phone: "+212522222222",
                distanceMeters: 620,
              },
              {
                id: PHARMACY_ID,
                name: "Pharmacie Excluded From Driver View",
                kind: "PHARMACY",
                countryCode: "MA",
                licenseNumber: "MA-PHARM-999",
                verificationStatus: "VERIFIED",
                lat: 33.588,
                lng: -7.615,
                address: "Rue Mozart, Casablanca",
                ownerUserId: OWNER_ID,
                createdAtIso: NOW_ISO,
                openStatus: "OPEN",
                is24_7: false,
                acceptsEmergency: false,
                specialties: [],
                phone: null,
                distanceMeters: 400,
              },
            ],
          }),
        }),
      );
      await page.route("**/v1/dispatch/drivers/nearby*", (route) =>
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            queryMs: 2,
            drivers: [
              {
                driverId: DRIVER_ID,
                countryCode: "MA",
                lat: 33.583,
                lng: -7.627,
                headingDeg: 90,
                status: "AVAILABLE",
                distanceKm: 0.4,
                recordedAtIso: NOW_ISO,
              },
            ],
          }),
        }),
      );
      await page.route("**/v1/dispatch/requests?*", (route) =>
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            dispatches: serverDispatches.filter((d) => !declinedIds.has(d.id)),
          }),
        }),
      );
      await page.route("**/v1/dispatch/requests/*/decline", (route) => {
        const parts = route.request().url().split("/");
        const id = parts[parts.length - 2]!;
        declinedIds.add(id);
        const found = serverDispatches.find((d) => d.id === id);
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            declined: true,
            dispatchId: id,
            releasedToQueue: false,
            ...(found ? { dispatch: found } : {}),
          }),
        });
      });
      await page.route("**/v1/dispatch/requests/*/status", (route) => {
        const parts = route.request().url().split("/");
        const id = parts[parts.length - 2]!;
        const body = route.request().postDataJSON() as { status: string };
        const found = serverDispatches.find((d) => d.id === id)!;
        found.status = body.status;
        if (body.status === "ASSIGNED") {
          found.driverUserId = DRIVER_ID;
        }
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ dispatch: found }),
        });
      });
      await page.route("**/v1/dispatch/stream*", (route) =>
        route.fulfill({
          status: 200,
          contentType: "text/event-stream",
          body: `event: snapshot\ndata: ${JSON.stringify({ type: "snapshot", countryCode: "MA", timestampIso: NOW_ISO })}\n\n`,
        }),
      );

      await page.addInitScript(
        ({ driverId, nowIso }) => {
          window.localStorage.setItem(
            "medisync.session.v1",
            JSON.stringify({
              token: "test-verified-driver-jwt",
              user: {
                id: driverId,
                email: "verified.driver@medisync.ma",
                fullName: "Karim Verified Driver",
                role: "DRIVER",
                countryCode: "MA",
                facilityId: null,
                avatarUrl: null,
                emailVerified: true,
                phone: "+212600000222",
                phoneVerified: true,
                authProvider: "LOCAL",
                accountStatus: "ACTIVE",
                credentialVerified: true,
                lastLoginAtIso: nowIso,
                createdAtIso: nowIso,
              },
            }),
          );
        },
        { driverId: DRIVER_ID, nowIso: NOW_ISO },
      );

      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto("/driver", { waitUntil: "networkidle" });

      await expect(
        page.getByRole("heading", { name: /Driver Relay Workspace/i }),
      ).toBeVisible();

      // Patient-only chrome and non-destination categories are hidden in Driver Workspace
      await expect(
        page.getByRole("heading", { name: /1-Tap Fast Book/i }),
      ).toHaveCount(0);
      await expect(
        page.getByRole("button", { name: "Doctors & Nurses" }),
      ).toHaveCount(0);
      await expect(
        page.getByText(/Pharmacie Excluded From Driver View/i),
      ).toHaveCount(0);

      // Client pins & destination hospital pin render on shared map
      await expect(
        page.getByRole("button", {
          name: /Client pickup Boulevard d'Anfa Pickup 12/i,
        }),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: /CHU Ibn Rochd/i }),
      ).toBeVisible();

      if (vp.name === "mobile") {
        const expandBtn = page.getByRole("button", { name: /Details & Fleet/i });
        if (await expandBtn.isVisible()) {
          await expandBtn.click();
        }
      }

      // Focused client card shows destination facility
      await expect(
        page.getByText(/Take Client To: CHU Ibn Rochd/i).first(),
      ).toBeVisible();

      // Refuse secondary client request (Maarif) -> disappears cleanly from feed
      const refuseBtnForMaarif = page
        .locator("li", { hasText: "Maarif Rue Jura Pickup 8" })
        .getByRole("button", { name: /^Refuse$/i });
      await refuseBtnForMaarif.click();
      await expect(
        page.getByText(/Client pickup declined/i),
      ).toBeVisible();

      // Accept primary client request -> advances to ASSIGNED -> Start En Route
      await page
        .getByRole("button", { name: /^Accept Client$/i })
        .first()
        .click();
      await expect(
        page.getByRole("button", { name: /Start En Route/i }).first(),
      ).toBeVisible();
      await page
        .getByRole("button", { name: /Start En Route/i })
        .first()
        .click();
      await expect(
        page.getByRole("button", { name: /Mark Arrived at Pickup/i }).first(),
      ).toBeVisible();

      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth,
      );
      expect(overflow, `Horizontal overflow on /driver (${vp.name})`).toBe(
        false,
      );
      expect(pageErrors).toEqual([]);
      expect(consoleErrors).toEqual([]);
    });
  }

  test("driver map stays unbloated like patient map, opens hospital card on pin click, receives live SSE demand, and auto-refuses when 60s window expires", async ({
    page,
  }) => {
    const LIVE_EXPIRING_ID = "88888888-8888-4888-8888-888888888888";
    const pageErrors: string[] = [];
    const consoleErrors: string[] = [];
    const declinedPayloads: Array<{ id: string; reason?: string }> = [];

    page.on("pageerror", (err) => pageErrors.push(err.message));
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });

    await page.route("**/api/backend-status", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ online: true }),
      }),
    );
    await page.route("**/v1/users/me/media*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ documents: [] }),
      }),
    );
    await page.route("**/v1/directory/facilities*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ facilities: [] }),
      }),
    );
    await page.route("**/v1/directory/drivers*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ drivers: [] }),
      }),
    );
    await page.route("**/v1/maps/facilities/viewport*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          queryMs: 3,
          facilities: [
            {
              id: HOSPITAL_ID,
              name: "CHU Ibn Rochd",
              kind: "HOSPITAL",
              countryCode: "MA",
              licenseNumber: "MA-HOSP-101",
              verificationStatus: "VERIFIED",
              lat: 33.575,
              lng: -7.619,
              address: "1 Rue des Hopitaux, Casablanca",
              ownerUserId: OWNER_ID,
              createdAtIso: NOW_ISO,
              openStatus: "OPEN",
              is24_7: true,
              acceptsEmergency: true,
              specialties: ["Emergency"],
              phone: "+212522222222",
              distanceMeters: 620,
            },
          ],
        }),
      }),
    );
    await page.route("**/v1/dispatch/drivers/nearby*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ queryMs: 2, drivers: [] }),
      }),
    );
    let liveDispatch: {
      id: string;
      countryCode: string;
      patientUserId: string;
      driverUserId: null;
      targetFacilityId: string;
      pickupLat: number;
      pickupLng: number;
      pickupAddress: string;
      urgency: "EMERGENCY";
      status: "REQUESTED";
      notes: string;
      createdAtIso: string;
      updatedAtIso: string;
      offerExpiresAtIso: string;
      offerWindowSeconds: number;
    } | null = null;
    await page.route("**/v1/dispatch/requests?*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          dispatches:
            liveDispatch &&
            !declinedPayloads.some((p) => p.id === liveDispatch!.id)
              ? [liveDispatch]
              : [],
        }),
      }),
    );
    await page.route("**/v1/dispatch/requests/*/decline", (route) => {
      const parts = route.request().url().split("/");
      const id = parts[parts.length - 2]!;
      const body = (route.request().postDataJSON() ?? {}) as { reason?: string };
      declinedPayloads.push({ id, ...(body.reason ? { reason: body.reason } : {}) });
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          declined: true,
          dispatchId: id,
          releasedToQueue: false,
        }),
      });
    });

    // Deliver a live demand over SSE on first connection with a short remaining window (<= 60s)
    let streamHits = 0;
    await page.route("**/v1/dispatch/stream*", (route) => {
      streamHits += 1;
      const snapshotFrame = `event: snapshot\ndata: ${JSON.stringify({ type: "snapshot", countryCode: "MA", timestampIso: new Date().toISOString() })}\n\n`;
      if (streamHits > 1) {
        return route.fulfill({
          status: 200,
          contentType: "text/event-stream",
          body: snapshotFrame,
        });
      }
      const expiresAtIso = new Date(Date.now() + 2600).toISOString();
      liveDispatch = {
        id: LIVE_EXPIRING_ID,
        countryCode: "MA",
        patientUserId: PATIENT_ID,
        driverUserId: null,
        targetFacilityId: HOSPITAL_ID,
        pickupLat: 33.584,
        pickupLng: -7.624,
        pickupAddress: "Corniche Ain Diab Live Call",
        urgency: "EMERGENCY",
        status: "REQUESTED",
        notes: "Live urgent pickup",
        createdAtIso: new Date().toISOString(),
        updatedAtIso: new Date().toISOString(),
        offerExpiresAtIso: expiresAtIso,
        offerWindowSeconds: 60,
      };
      return route.fulfill({
        status: 200,
        contentType: "text/event-stream",
        body:
          snapshotFrame +
          `event: dispatch.updated\ndata: ${JSON.stringify({ type: "dispatch.updated", dispatch: liveDispatch })}\n\n`,
      });
    });

    await page.addInitScript(
      ({ driverId, nowIso }) => {
        window.localStorage.setItem(
          "medisync.session.v1",
          JSON.stringify({
            token: "test-verified-driver-jwt",
            user: {
              id: driverId,
              email: "verified.driver@medisync.ma",
              fullName: "Karim Verified Driver",
              role: "DRIVER",
              countryCode: "MA",
              facilityId: null,
              avatarUrl: null,
              emailVerified: true,
              phone: "+212600000222",
              phoneVerified: true,
              authProvider: "LOCAL",
              accountStatus: "ACTIVE",
              credentialVerified: true,
              lastLoginAtIso: nowIso,
              createdAtIso: nowIso,
            },
          }),
        );
      },
      { driverId: DRIVER_ID, nowIso: NOW_ISO },
    );

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/driver", { waitUntil: "domcontentloaded" });

    // Unbloated UI: no permanent hospital directory sidebar, no manual GPS lat/lng form
    await expect(
      page.getByText(/Destination Hospitals & Clinics/i),
    ).toHaveCount(0);
    await expect(page.getByText(/Manual GPS Coordinates/i)).toHaveCount(0);
    await expect(page.getByLabel(/^Latitude$/i)).toHaveCount(0);

    // Live SSE demand appears immediately with countdown badge & progress bar
    await expect(page.getByText(/Corniche Ain Diab Live Call/i).first()).toBeVisible();
    const countdownBadge = page.locator('[data-offer-countdown="true"]');
    await expect(countdownBadge).toBeVisible();
    await expect(
      page.getByRole("progressbar", { name: /Auto-refuses in/i }),
    ).toBeVisible();
    const countdownNum = Number.parseInt(
      (await countdownBadge.innerText()).replace(/\D/g, ""),
      10,
    );
    expect(countdownNum).toBeGreaterThan(0);
    expect(countdownNum).toBeLessThanOrEqual(60);

    // Do nothing: demand auto-refuses when timer hits 0s and calls /decline with AUTO_TIMEOUT_60S
    await expect
      .poll(() => declinedPayloads.some((p) => p.id === LIVE_EXPIRING_ID), {
        timeout: 6000,
      })
      .toBe(true);
    expect(declinedPayloads[0]?.reason).toBe("AUTO_TIMEOUT_60S");
    await expect(page.getByText(/Corniche Ain Diab Live Call/i)).toHaveCount(0);
    await expect(
      page.getByText(/Online · Receiving live demands/i),
    ).toBeVisible();

    // Clicking a hospital pin on /driver opens clean MapEntityDetailsCard (driver mode, no patient booking links)
    await page.getByRole("button", { name: /CHU Ibn Rochd/i }).click();
    const facilityDialog = page.getByRole("dialog", {
      name: /CHU Ibn Rochd details/i,
    });
    await expect(facilityDialog).toBeVisible();
    await expect(
      facilityDialog.getByRole("link", { name: /Navigate to Facility/i }),
    ).toBeVisible();
    await expect(
      facilityDialog.getByRole("link", { name: /Book Appointment/i }),
    ).toHaveCount(0);
    await expect(
      facilityDialog.getByRole("button", { name: /Fast Book EMS Here/i }),
    ).toHaveCount(0);

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("driver responsive layout: zero top-bar clipping on 1024px FR, zero duplicate GPS/overflow on 768px tablet, mobile live-offer alert stays visible over Trips, and 409 DISPATCH_OFFER_EXPIRED is handled gracefully", async ({
    page,
  }) => {
    const EXPIRED_ACCEPT_ID = "99999999-9999-4999-8999-999999999991";
    const SECOND_DEMAND_ID = "99999999-9999-4999-8999-999999999992";
    const THIRD_DEMAND_ID = "99999999-9999-4999-8999-999999999993";
    const pageErrors: string[] = [];
    const consoleErrors: string[] = [];

    page.on("pageerror", (err) => pageErrors.push(err.message));
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });

    const expIso = (sec: number) => new Date(Date.now() + sec * 1000).toISOString();
    let activeDispatches = [
      {
        id: EXPIRED_ACCEPT_ID,
        countryCode: "MA",
        patientUserId: PATIENT_ID,
        driverUserId: null,
        targetFacilityId: HOSPITAL_ID,
        pickupLat: 33.584,
        pickupLng: -7.624,
        pickupAddress: "Boulevard d'Anfa Boundary Test",
        urgency: "EMERGENCY",
        status: "REQUESTED",
        notes: "Accept right at 60s boundary",
        createdAtIso: NOW_ISO,
        updatedAtIso: NOW_ISO,
        offerExpiresAtIso: expIso(45),
        offerWindowSeconds: 60,
        offerRemainingMs: 45_000,
      },
      {
        id: SECOND_DEMAND_ID,
        countryCode: "MA",
        patientUserId: PATIENT_ID,
        driverUserId: null,
        targetFacilityId: HOSPITAL_ID,
        pickupLat: 33.579,
        pickupLng: -7.632,
        pickupAddress: "Maarif Second Queue Demand",
        urgency: "URGENT",
        status: "REQUESTED",
        notes: "Transfer to hospital",
        createdAtIso: NOW_ISO,
        updatedAtIso: NOW_ISO,
        offerExpiresAtIso: expIso(32),
        offerWindowSeconds: 60,
        offerRemainingMs: 32_000,
      },
      {
        id: THIRD_DEMAND_ID,
        countryCode: "MA",
        patientUserId: PATIENT_ID,
        driverUserId: null,
        targetFacilityId: HOSPITAL_ID,
        pickupLat: 33.588,
        pickupLng: -7.612,
        pickupAddress: "Gauthier Third Courier Demand",
        urgency: "ROUTINE",
        status: "REQUESTED",
        notes: "Pharmacy Courier OTC order",
        createdAtIso: NOW_ISO,
        updatedAtIso: NOW_ISO,
        offerExpiresAtIso: expIso(25),
        offerWindowSeconds: 60,
        offerRemainingMs: 25_000,
      },
    ];

    await page.route("**/api/backend-status", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ online: true }),
      }),
    );
    await page.route("**/v1/users/me/media*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ documents: [] }),
      }),
    );
    await page.route("**/v1/directory/facilities*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ facilities: [] }),
      }),
    );
    await page.route("**/v1/directory/drivers*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ drivers: [] }),
      }),
    );
    await page.route("**/v1/directory/**", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ facilities: [], doctors: [], drivers: [] }),
      }),
    );
    await page.route("**/v1/maps/facilities/viewport*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          queryMs: 3,
          facilities: [
            {
              id: HOSPITAL_ID,
              name: "CHU Ibn Rochd",
              kind: "HOSPITAL",
              countryCode: "MA",
              licenseNumber: "MA-HOSP-101",
              verificationStatus: "VERIFIED",
              lat: 33.575,
              lng: -7.619,
              address: "1 Rue des Hopitaux, Casablanca",
              ownerUserId: OWNER_ID,
              createdAtIso: NOW_ISO,
              openStatus: "OPEN",
              is24_7: true,
              acceptsEmergency: true,
              specialties: ["Emergency"],
              phone: "+212522222222",
              distanceMeters: 620,
            },
          ],
        }),
      }),
    );
    await page.route("**/v1/dispatch/drivers/nearby*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          queryMs: 2,
          drivers: [
            {
              driverId: DRIVER_ID,
              countryCode: "MA",
              lat: 33.583,
              lng: -7.627,
              headingDeg: 90,
              status: "AVAILABLE",
              distanceKm: 0.4,
              recordedAtIso: NOW_ISO,
            },
          ],
        }),
      }),
    );
    await page.route("**/v1/dispatch/requests?*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ dispatches: activeDispatches }),
      }),
    );
    await page.route("**/v1/dispatch/requests/*/status", (route) => {
      activeDispatches = activeDispatches.filter(
        (d) => d.id !== EXPIRED_ACCEPT_ID,
      );
      return route.fulfill({
        status: 409,
        contentType: "application/json",
        body: JSON.stringify({
          error: "DISPATCH_OFFER_EXPIRED",
          message:
            "Dispatch offer expired after 60 seconds and was automatically refused.",
        }),
      });
    });
    await page.route("**/v1/dispatch/stream*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "text/event-stream",
        body: `event: snapshot\ndata: ${JSON.stringify({ type: "snapshot", countryCode: "MA", timestampIso: NOW_ISO })}\n\n`,
      }),
    );

    await page.addInitScript(
      ({ driverId, nowIso }) => {
        window.localStorage.setItem("medisync.locale.v1", "fr");
        window.localStorage.setItem(
          "medisync.session.v1",
          JSON.stringify({
            token: "test-verified-driver-jwt",
            user: {
              id: driverId,
              email: "verified.driver@medisync.ma",
              fullName: "Karim Benali",
              role: "DRIVER",
              countryCode: "MA",
              facilityId: null,
              avatarUrl: null,
              emailVerified: true,
              phone: "+212600000222",
              phoneVerified: true,
              authProvider: "LOCAL",
              accountStatus: "ACTIVE",
              credentialVerified: true,
              lastLoginAtIso: nowIso,
              createdAtIso: nowIso,
            },
          }),
        );
      },
      { driverId: DRIVER_ID, nowIso: NOW_ISO },
    );

    // 1. 1024x768 French: every top-bar control stays strictly within viewport (zero right clipping)
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.goto("/driver", { waitUntil: "networkidle" });
    await expect(
      page.getByText(/Boulevard d'Anfa Boundary Test/i).first(),
    ).toBeVisible();
    const rightMost1024 = await page.evaluate(() => {
      const section = document.querySelector("main section");
      if (!section) return 0;
      return Math.max(
        ...Array.from(section.querySelectorAll("button, input")).map(
          (el) => el.getBoundingClientRect().right,
        ),
        0,
      );
    });
    expect(rightMost1024).toBeLessThanOrEqual(1024);

    // 2. 768x900 tablet: hospital card open -> zero duplicate GPS buttons & zero HUD overflow
    await page.setViewportSize({ width: 768, height: 900 });
    const visibleGpsButtons = await page
      .locator('button[aria-label*="GPS" i]')
      .evaluateAll(
        (els) =>
          els.filter((el) => {
            const r = el.getBoundingClientRect();
            return r.width > 0 && r.height > 0;
          }).length,
      );
    expect(visibleGpsButtons).toBeLessThanOrEqual(2);
    await page.getByRole("button", { name: /CHU Ibn Rochd/i }).click();
    await expect(
      page.getByRole("dialog", { name: /CHU Ibn Rochd/i }),
    ).toBeVisible();
    await expect(page.locator('[data-driver-live-alert="true"]')).toBeVisible();
    await page.locator('[data-driver-live-alert="true"] button').click();
    await expect(page.locator('[data-driver-hud="true"]')).toBeVisible();

    // 3. 390x844 mobile: Trips drawer keeps live alert pill visible, tapping returns to demand card
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole("tab", { name: /Courses/i }).click();
    await expect(page.locator('[data-driver-live-alert="true"]')).toBeVisible();
    await page.locator('[data-driver-live-alert="true"] button').click();
    await expect(page.locator('[data-driver-hud="true"]')).toBeVisible();

    // 4. Clicking Accept right at 60s expiry (409 DISPATCH_OFFER_EXPIRED) cleanly removes offer & advances queue
    await page.getByRole("button", { name: /Accepter le client/i }).click();
    await expect(
      page.getByText(/Demande expirée après 60 s — refusée automatiquement/i),
    ).toBeVisible();
    await expect(
      page.getByText(/Boulevard d'Anfa Boundary Test/i),
    ).toHaveCount(0);
    await expect(
      page.getByText(/Maarif Second Queue Demand/i).first(),
    ).toBeVisible();

    expect(pageErrors).toEqual([]);
    expect(
      consoleErrors.filter((msg) => !/status of 409 \(Conflict\)/i.test(msg)),
    ).toEqual([]);
  });

  test("driver OFF_DUTY persists across reload with empty queue, and stale search query clears automatically when a live 60s SSE offer arrives", async ({
    page,
  }) => {
    const LIVE_SEARCH_CLEAR_ID = "99999999-9999-4999-8999-999999999994";
    const pageErrors: string[] = [];
    const consoleErrors: string[] = [];
    const pingStatuses: string[] = [];
    let serverOffDuty = false;
    let openServerOffer: {
      id: string;
      countryCode: string;
      patientUserId: string;
      driverUserId: null;
      targetFacilityId: string;
      pickupLat: number;
      pickupLng: number;
      pickupAddress: string;
      urgency: "EMERGENCY";
      status: "REQUESTED";
      notes: string;
      createdAtIso: string;
      updatedAtIso: string;
      offerExpiresAtIso: string;
      offerWindowSeconds: number;
      offerRemainingMs: number;
    } | null = null;

    let releaseLiveSseOffer: (() => void) | null = null;
    let holdNextSseForLiveOffer = false;

    page.on("pageerror", (err) => pageErrors.push(err.message));
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });

    await page.route("**/api/backend-status", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ online: true }),
      }),
    );
    await page.route("**/v1/users/me/media*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ documents: [] }),
      }),
    );
    await page.route("**/v1/directory/facilities*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ facilities: [] }),
      }),
    );
    await page.route("**/v1/directory/drivers*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ drivers: [] }),
      }),
    );
    await page.route("**/v1/directory/**", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ facilities: [], doctors: [], drivers: [] }),
      }),
    );
    await page.route("**/v1/maps/facilities/viewport*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          queryMs: 3,
          facilities: [
            {
              id: HOSPITAL_ID,
              name: "CHU Ibn Rochd",
              kind: "HOSPITAL",
              countryCode: "MA",
              licenseNumber: "MA-HOSP-101",
              verificationStatus: "VERIFIED",
              lat: 33.575,
              lng: -7.619,
              address: "1 Rue des Hopitaux, Casablanca",
              ownerUserId: OWNER_ID,
              createdAtIso: NOW_ISO,
              openStatus: "OPEN",
              is24_7: true,
              acceptsEmergency: true,
              specialties: ["Emergency"],
              phone: "+212522222222",
              distanceMeters: 620,
            },
          ],
        }),
      }),
    );
    await page.route("**/v1/dispatch/drivers/nearby*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ queryMs: 2, drivers: [] }),
      }),
    );
    await page.route("**/v1/dispatch/drivers/ping", (route) => {
      const body = route.request().postDataJSON() as {
        lat: number;
        lng: number;
        status: "AVAILABLE" | "ASSIGNED" | "EN_ROUTE" | "OFF_DUTY";
      };
      pingStatuses.push(body.status);
      serverOffDuty = body.status === "OFF_DUTY";
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          driver: {
            driverId: DRIVER_ID,
            countryCode: "MA",
            lat: body.lat,
            lng: body.lng,
            headingDeg: null,
            status: body.status,
            distanceKm: 0,
            recordedAtIso: new Date().toISOString(),
          },
        }),
      });
    });
    await page.route("**/v1/dispatch/requests?*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          dispatches: serverOffDuty || !openServerOffer ? [] : [openServerOffer],
          driverDutyStatus: serverOffDuty ? "OFF_DUTY" : "AVAILABLE",
        }),
      }),
    );
    await page.route("**/v1/dispatch/stream*", async (route) => {
      const snapshotFrame = `event: snapshot\ndata: ${JSON.stringify({ type: "snapshot", countryCode: "MA", timestampIso: new Date().toISOString() })}\n\n`;
      if (holdNextSseForLiveOffer) {
        holdNextSseForLiveOffer = false;
        await new Promise<void>((resolve) => {
          releaseLiveSseOffer = resolve;
        });
        openServerOffer = {
          id: LIVE_SEARCH_CLEAR_ID,
          countryCode: "MA",
          patientUserId: PATIENT_ID,
          driverUserId: null,
          targetFacilityId: HOSPITAL_ID,
          pickupLat: 33.584,
          pickupLng: -7.624,
          pickupAddress: "Corniche Live Search-Clear Pickup",
          urgency: "EMERGENCY",
          status: "REQUESTED",
          notes: "Live SSE call arriving while stale search text exists",
          createdAtIso: new Date().toISOString(),
          updatedAtIso: new Date().toISOString(),
          offerExpiresAtIso: new Date(Date.now() + 45_000).toISOString(),
          offerWindowSeconds: 60,
          offerRemainingMs: 45_000,
        };
        await route.fulfill({
          status: 200,
          contentType: "text/event-stream",
          body:
            snapshotFrame +
            `event: dispatch.updated\ndata: ${JSON.stringify({ type: "dispatch.updated", dispatch: openServerOffer })}\n\n`,
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "text/event-stream",
        body: snapshotFrame,
      });
    });

    await page.addInitScript(
      ({ driverId, nowIso }) => {
        window.localStorage.setItem(
          "medisync.session.v1",
          JSON.stringify({
            token: "test-verified-driver-jwt",
            user: {
              id: driverId,
              email: "verified.driver@medisync.ma",
              fullName: "Karim Verified Driver",
              role: "DRIVER",
              countryCode: "MA",
              facilityId: null,
              avatarUrl: null,
              emailVerified: true,
              phone: "+212600000222",
              phoneVerified: true,
              authProvider: "LOCAL",
              accountStatus: "ACTIVE",
              credentialVerified: true,
              lastLoginAtIso: nowIso,
              createdAtIso: nowIso,
            },
          }),
        );
      },
      { driverId: DRIVER_ID, nowIso: NOW_ISO },
    );

    // 1. Toggle OFF_DUTY -> reload with 0 dispatches -> UI stays visually OFF_DUTY (not green Online)
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/driver", { waitUntil: "networkidle" });
    await expect(
      page.getByText(/Online · Receiving live demands/i),
    ).toBeVisible();

    await page.getByRole("button", { name: /^Off Duty$/i }).click();
    await expect.poll(() => pingStatuses[pingStatuses.length - 1]).toBe(
      "OFF_DUTY",
    );
    await expect(
      page.getByText(/Off Duty · Demands paused/i),
    ).toBeVisible();

    await page.reload({ waitUntil: "networkidle" });
    await expect(
      page.getByText(/Off Duty · Demands paused/i),
    ).toBeVisible();
    await expect(
      page.locator("main section").first().getByRole("button", { name: /^Off Duty$/i }),
    ).toBeVisible();
    await expect(
      page.getByText(/Online · Receiving live demands/i),
    ).toHaveCount(0);

    // 2. Toggle back Online -> prepare held SSE -> reload, type stale non-matching search -> live SSE offer clears search and renders immediately
    await page.getByRole("button", { name: /^Go Online$/i }).click();
    await expect.poll(() => pingStatuses[pingStatuses.length - 1]).toBe(
      "AVAILABLE",
    );
    await expect(
      page.getByText(/Online · Receiving live demands/i),
    ).toBeVisible();

    holdNextSseForLiveOffer = true;
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(
      page.getByText(/Online · Receiving live demands/i),
    ).toBeVisible();

    const driverSearchInput = page.getByRole("searchbox", {
      name: /Search medical centers, doctors, or pickup zone/i,
    });
    await driverSearchInput.fill("NonMatchingHospitalXYZ");
    await expect(driverSearchInput).toHaveValue("NonMatchingHospitalXYZ");

    await expect.poll(() => releaseLiveSseOffer !== null).toBe(true);
    releaseLiveSseOffer!();

    // Brand-new live SSE offer clears stale non-matching search and surfaces immediately with 60s countdown
    await expect(driverSearchInput).toHaveValue("");
    await expect(
      page.getByText(/Corniche Live Search-Clear Pickup/i).first(),
    ).toBeVisible();
    await expect(page.locator('[data-offer-countdown="true"]')).toBeVisible();
    await expect(
      page.getByRole("button", { name: /^Accept Client$/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /^Refuse$/i }),
    ).toBeVisible();

    // Manually filtering out the live offer offers a 1-tap Reset inside the HUD to reveal it again
    await driverSearchInput.fill("UnmatchedFilterAfterArrival");
    await expect(
      page.getByText(/Corniche Live Search-Clear Pickup/i),
    ).toHaveCount(0);
    await page
      .locator('[data-driver-hud="true"]')
      .getByRole("button", { name: /Clear map search/i })
      .click();
    await expect(driverSearchInput).toHaveValue("");
    await expect(
      page.getByText(/Corniche Live Search-Clear Pickup/i).first(),
    ).toBeVisible();

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("driver slow-network OFF_DUTY reload has zero green-Online flash, multi-tab SSE duty/mission sync clears stale search and resets En Route badge, and AR RTL OFF_DUTY persists cleanly", async ({
    page,
  }) => {
    const MULTITAB_OFFER_ID = "99999999-9999-4999-8999-999999999995";
    const COMPLETED_MISSION_ID = "99999999-9999-4999-8999-999999999996";
    const pageErrors: string[] = [];
    const consoleErrors: string[] = [];

    page.on("pageerror", (err) => pageErrors.push(err.message));
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });

    let serverDutyStatus: "OFF_DUTY" | "AVAILABLE" | "EN_ROUTE" = "OFF_DUTY";
    let delayRequestsMs = 450;
    let currentDispatches: Array<Record<string, unknown>> = [];
    let sseMode: "snapshot_only" | "hold_go_online" | "hold_mission_complete" =
      "snapshot_only";
    let releaseHeldSse: (() => void) | null = null;

    const incomingOffer = {
      id: MULTITAB_OFFER_ID,
      countryCode: "MA",
      patientUserId: PATIENT_ID,
      driverUserId: null,
      targetFacilityId: HOSPITAL_ID,
      pickupLat: 33.584,
      pickupLng: -7.624,
      pickupAddress: "Racine Multi-Tab Go-Online Offer",
      urgency: "EMERGENCY",
      status: "REQUESTED",
      notes: "Live offer synced from another tab",
      createdAtIso: NOW_ISO,
      updatedAtIso: NOW_ISO,
      offerExpiresAtIso: new Date(Date.now() + 50_000).toISOString(),
      offerWindowSeconds: 60,
      offerRemainingMs: 50_000,
    };

    const enRouteMission = {
      id: COMPLETED_MISSION_ID,
      countryCode: "MA",
      patientUserId: PATIENT_ID,
      driverUserId: DRIVER_ID,
      targetFacilityId: HOSPITAL_ID,
      pickupLat: 33.581,
      pickupLng: -7.621,
      pickupAddress: "Gauthier Active Mission Sync",
      urgency: "URGENT",
      status: "EN_ROUTE",
      notes: "Hospital transfer",
      createdAtIso: NOW_ISO,
      updatedAtIso: NOW_ISO,
    };

    await page.route("**/api/backend-status", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ online: true }),
      }),
    );
    await page.route("**/v1/users/me/media*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ documents: [] }),
      }),
    );
    await page.route("**/v1/directory/facilities*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ facilities: [] }),
      }),
    );
    await page.route("**/v1/directory/drivers*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ drivers: [] }),
      }),
    );
    await page.route("**/v1/directory/**", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ facilities: [], doctors: [], drivers: [] }),
      }),
    );
    await page.route("**/v1/maps/facilities/viewport*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          queryMs: 3,
          facilities: [
            {
              id: HOSPITAL_ID,
              name: "CHU Ibn Rochd",
              kind: "HOSPITAL",
              countryCode: "MA",
              licenseNumber: "MA-HOSP-101",
              verificationStatus: "VERIFIED",
              lat: 33.575,
              lng: -7.619,
              address: "1 Rue des Hopitaux, Casablanca",
              ownerUserId: OWNER_ID,
              createdAtIso: NOW_ISO,
              openStatus: "OPEN",
              is24_7: true,
              acceptsEmergency: true,
              specialties: ["Emergency"],
              phone: "+212522222222",
              distanceMeters: 620,
            },
          ],
        }),
      }),
    );
    await page.route("**/v1/dispatch/drivers/nearby*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ queryMs: 2, drivers: [] }),
      }),
    );
    await page.route("**/v1/dispatch/requests?*", async (route) => {
      if (delayRequestsMs > 0) {
        await new Promise((r) => setTimeout(r, delayRequestsMs));
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          dispatches: currentDispatches,
          driverDutyStatus: serverDutyStatus,
        }),
      });
    });
    await page.route("**/v1/dispatch/stream*", async (route) => {
      const snapshotFrame = `event: snapshot\ndata: ${JSON.stringify({ type: "snapshot", countryCode: "MA", timestampIso: new Date().toISOString() })}\n\n`;
      if (sseMode === "hold_go_online") {
        sseMode = "snapshot_only";
        await new Promise<void>((resolve) => {
          releaseHeldSse = resolve;
        });
        serverDutyStatus = "AVAILABLE";
        currentDispatches = [incomingOffer];
        await route.fulfill({
          status: 200,
          contentType: "text/event-stream",
          body:
            snapshotFrame +
            `event: driver.location\ndata: ${JSON.stringify({
              type: "driver.location",
              driver: {
                driverId: DRIVER_ID,
                countryCode: "MA",
                lat: 33.583,
                lng: -7.627,
                headingDeg: 90,
                status: "AVAILABLE",
                distanceKm: 0,
                recordedAtIso: new Date().toISOString(),
              },
            })}\n\n`,
        });
        return;
      }
      if (sseMode === "hold_mission_complete") {
        sseMode = "snapshot_only";
        await new Promise<void>((resolve) => {
          releaseHeldSse = resolve;
        });
        serverDutyStatus = "AVAILABLE";
        const completedMission = { ...enRouteMission, status: "COMPLETED" };
        currentDispatches = [completedMission];
        await route.fulfill({
          status: 200,
          contentType: "text/event-stream",
          body:
            snapshotFrame +
            `event: dispatch.updated\ndata: ${JSON.stringify({
              type: "dispatch.updated",
              dispatch: completedMission,
            })}\n\n`,
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "text/event-stream",
        body: snapshotFrame,
      });
    });

    await page.addInitScript(
      ({ driverId, nowIso }) => {
        window.localStorage.setItem(
          "medisync.session.v1",
          JSON.stringify({
            token: "test-verified-driver-jwt",
            user: {
              id: driverId,
              email: "verified.driver@medisync.ma",
              fullName: "Karim Verified Driver",
              role: "DRIVER",
              countryCode: "MA",
              facilityId: null,
              avatarUrl: null,
              emailVerified: true,
              phone: "+212600000222",
              phoneVerified: true,
              authProvider: "LOCAL",
              accountStatus: "ACTIVE",
              credentialVerified: true,
              lastLoginAtIso: nowIso,
              createdAtIso: nowIso,
            },
          }),
        );
      },
      { driverId: DRIVER_ID, nowIso: NOW_ISO },
    );

    // 1. Slow-network OFF_DUTY reload: neutral syncing pill renders mid-load (ZERO green Online flash)
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/driver", { waitUntil: "domcontentloaded" });
    await expect(
      page.locator('[data-driver-duty-hydrating="true"]'),
    ).toBeVisible();
    await expect(
      page.getByText(/Online · Receiving live demands/i),
    ).toHaveCount(0);
    await expect(
      page.getByText(/Off Duty · Demands paused/i),
    ).toBeVisible();

    // 2. Multi-tab SSE Go Online clears stale non-matching search and surfaces incoming 60s offer immediately
    delayRequestsMs = 0;
    sseMode = "hold_go_online";
    releaseHeldSse = null;
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(
      page.getByText(/Off Duty · Demands paused/i),
    ).toBeVisible();
    const driverSearchInput = page.getByRole("searchbox", {
      name: /Search medical centers, doctors, or pickup zone/i,
    });
    await driverSearchInput.fill("StaleTab2SearchXYZ");
    await expect(driverSearchInput).toHaveValue("StaleTab2SearchXYZ");

    await expect.poll(() => releaseHeldSse !== null).toBe(true);
    releaseHeldSse!();

    await expect(driverSearchInput).toHaveValue("");
    await expect(
      page.getByText(/Racine Multi-Tab Go-Online Offer/i).first(),
    ).toBeVisible();
    await expect(page.locator('[data-offer-countdown="true"]')).toBeVisible();

    // 3. Multi-tab SSE COMPLETED resets hydrated EN_ROUTE top-bar badge cleanly back to Online
    serverDutyStatus = "EN_ROUTE";
    currentDispatches = [enRouteMission];
    sseMode = "hold_mission_complete";
    releaseHeldSse = null;
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(
      page.locator("main section").first().getByRole("button", { name: /^En Route$/i }),
    ).toBeVisible();

    await expect.poll(() => releaseHeldSse !== null).toBe(true);
    releaseHeldSse!();

    await expect(
      page.locator("main section").first().getByRole("button", { name: /^Online$/i }),
    ).toBeVisible();
    await expect(
      page.getByText(/Online · Receiving live demands/i),
    ).toBeVisible();

    // 4. Arabic RTL OFF_DUTY reload persistence with zero horizontal overflow
    serverDutyStatus = "OFF_DUTY";
    currentDispatches = [];
    sseMode = "snapshot_only";
    await page.evaluate(() => {
      window.localStorage.setItem("medisync.locale.v1", "ar");
    });
    await page.reload({ waitUntil: "networkidle" });
    await expect(page.getByText(/خارج الخدمة · الطلبات متوقفة/)).toBeVisible();
    const hasOverflowAr = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    );
    expect(hasOverflowAr).toBe(false);

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });
});

test.describe("multi-city morocco directory: all 6 cities filter cleanly including Tangier/Tanger and Fes/Fès", () => {
  test("filters doctors, nurses, drivers, and facilities across Casablanca, Rabat, Marrakech, Tangier, Fes, and Agadir", async ({
    page,
  }) => {
    const pageErrors: string[] = [];
    const consoleErrors: string[] = [];
    page.on("pageerror", (err) => pageErrors.push(err.message));
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/profiles", { waitUntil: "networkidle" });

    // Only assert live seeded multi-city records when backend API is reachable
    const statusRes = await page.request.get("/api/backend-status");
    const statusJson = (await statusRes.json()) as { online?: boolean };
    if (!statusJson.online) {
      test.skip(true, "Live API server offline; skipping live multi-city check");
    }

    const expectedCityDoctors: ReadonlyArray<{ cityLabel: string; doctorName: string }> = [
      { cityLabel: "Casablanca", doctorName: "Dr. Salma Benali" },
      { cityLabel: "Rabat", doctorName: "Dr. Mehdi El Fassi" },
      { cityLabel: "Marrakech", doctorName: "Dr. Imane Chafik" },
      { cityLabel: "Tangier", doctorName: "Dr. Anas Bakkali" },
      { cityLabel: "Fes", doctorName: "Dr. Zineb Lahlou" },
      { cityLabel: "Agadir", doctorName: "Dr. Meryem Ouhssaine" },
    ];

    const filtersToggle = page.getByRole("button", { name: /filters/i });
    const cityRadioGroup = page.locator("#dir-city-filter");

    for (const item of expectedCityDoctors) {
      if (!(await cityRadioGroup.isVisible())) {
        await filtersToggle.click();
      }
      await cityRadioGroup
        .getByRole("radio", { name: item.cityLabel, exact: true })
        .click();
      await expect(
        page.getByRole("button", { name: item.doctorName, exact: true }),
      ).toBeVisible();
      await expect(
        page.getByRole("tab", { name: /Doctors \(1\)/i }),
      ).toBeVisible();
      await expect(
        page.getByRole("tab", { name: /Nurses \(1\)/i }),
      ).toBeVisible();
      await expect(
        page.getByRole("tab", { name: /Facilities \(4\)/i }),
      ).toBeVisible();
    }

    // Reset city filter and verify free-text search works with accentless "Fes" and French "Tanger"
    if (!(await cityRadioGroup.isVisible())) {
      await filtersToggle.click();
    }
    await cityRadioGroup.getByRole("radio", { name: /All cities/i }).click();
    const profileSearch = page.getByRole("searchbox");
    await profileSearch.fill("Fes");
    await expect(
      page.getByRole("button", { name: "Dr. Zineb Lahlou", exact: true }),
    ).toBeVisible();
    await profileSearch.fill("Tanger");
    await expect(
      page.getByRole("button", { name: "Dr. Anas Bakkali", exact: true }),
    ).toBeVisible();
    await profileSearch.fill("");

    // Verify /booking city filter and accentless "Fes" / "Tangier" search work cleanly
    await page.goto("/booking", { waitUntil: "networkidle" });
    const bookingSearch = page.locator("#specialty-filter");
    await bookingSearch.fill("Fes");
    await expect(page.getByText("Dr. Zineb Lahlou").first()).toBeVisible();
    await bookingSearch.fill("Tangier");
    await expect(page.getByText("Dr. Anas Bakkali").first()).toBeVisible();
    await bookingSearch.fill("");

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });
});
