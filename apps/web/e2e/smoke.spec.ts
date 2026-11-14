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

    // Verify transparent logo mark and hero illustration loaded cleanly
    const logoLoaded = await page
      .locator('img[alt="MediSync Global emblem"]')
      .evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0);
    const heroLoaded = await page
      .locator('img[alt*="coordination map"]')
      .evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0);

    expect(logoLoaded).toBe(true);
    expect(heroLoaded).toBe(true);

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

    await page
      .getByRole("button", { name: /Zoom Connected Medical Care District/i })
      .click();
    const lightbox = page.getByRole("dialog", { name: /Image preview:/i });
    await expect(lightbox).toBeVisible();
    await expect(lightbox.getByText("100%")).toBeVisible();
    await lightbox.getByRole("button", { name: "Zoom in image" }).click();
    await expect(lightbox.getByText("150%")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(lightbox).toBeHidden();

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
    await langGroup.getByRole("button", { name: /English/i }).click();
    await page.getByRole("button", { name: /Close menu/i }).click();

    // Verify Morocco (MA) is active natively with hotline 141 and no region switcher buttons
    await expect(page.getByText(/Care Region: Morocco/i)).toBeVisible();
    await expect(page.getByText(/141 \/ 15/)).toBeVisible();
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

    // Navigate to Clinical & Ops Access Portal (/portal)
    await navigateTo("Portal");
    await expect(
      page.getByRole("heading", { name: /Clinical & Ops Access Portal/i }),
    ).toBeVisible();

    // Verify Care Region defaults cleanly to Morocco (MA) and test tabs + live license validation
    await expect(page.getByText(/Care Region:\s*Morocco/i).first()).toBeVisible();

    await page.getByRole("tab", { name: /Register$/i }).click();
    await expect(page.getByLabel("Account Type")).toBeVisible();
    await expect(page.getByLabel("Account Type")).not.toContainText("OPS_ADMIN");
    await expect(
      page.getByRole("radiogroup", { name: "Account role cards" }),
    ).toBeVisible();
    await page
      .getByRole("radio", { name: /Medical Transport/i })
      .click();
    await expect(
      page.getByText(/upload your Driver License and Vehicle Inspection Photo/i),
    ).toBeVisible();
    await page.getByRole("radio", { name: /Patient/i }).first().click();

    await page.getByRole("tab", { name: /Register Facility/i }).click();
    const licenseInput = page.getByLabel(/Ministry License \(MA\)/i);
    await licenseInput.fill("BADFORMAT");
    await expect(page.getByText(/Check Format/i)).toBeVisible();
    await licenseInput.fill("MA-CLIN-90812");
    await expect(page.getByText("Valid Format")).toBeVisible();
    await expect(page.locator("#fac-license-file")).toBeAttached();
    await expect(page.locator("#fac-photo-file")).toBeAttached();

    // Verify quick-demo user/doctor portraits load cleanly when backend is active on /portal
    const portalAvatars = page.locator('img[src*="/media/avatars/"]');
    if ((await portalAvatars.count()) > 0) {
      const firstPortalAvatar = portalAvatars.first();
      await firstPortalAvatar.scrollIntoViewIfNeeded();
      await expect
        .poll(async () =>
          firstPortalAvatar.evaluate(
            (img: HTMLImageElement) => img.complete && img.naturalWidth > 0,
          ),
        )
        .toBe(true);
    }

    const hasOverflowPortal = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    );
    expect(hasOverflowPortal, "Horizontal scroll overflow on /portal").toBe(
      false,
    );

    // Navigate from /portal to Live Medical Map & Dispatch Console (/map)
    await navigateTo("Live Map");
    await expect(
      page.getByRole("heading", { name: /Live Medical Map & Dispatch Console/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Search This Area/i }),
    ).toBeVisible();

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

    await page.getByRole("button", { name: "Hospitals", exact: true }).click();
    await page.getByRole("button", { name: "Zoom in viewport" }).click();

    await expect(
      page.getByRole("heading", { name: /1-Tap Fast Book/i }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Doctors & Nurses" }).click();
    await expect(page.getByText(/Nearby Doctors & Nurses \(/i)).toBeVisible();

    const saveButtonsOnMap = page.locator('button[aria-label^="Save "]');
    if ((await saveButtonsOnMap.count()) > 0) {
      await saveButtonsOnMap.first().click();
    }

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

    // Navigate from /booking to Clinical Care & Diagnostic Labs Workspace (/clinical)
    await navigateTo("Clinical");
    await expect(
      page.getByRole("heading", {
        name: /Clinical Care, QR E-Prescriptions & Diagnostic Labs/i,
      }),
    ).toBeVisible();
    await expect(page.locator("select#clin-patient-uuid")).toBeVisible();

    await page
      .getByRole("tab", { name: /Clinic Shifts/i })
      .click();
    await expect(
      page.getByText(/Publish Multi-Clinic Shift Window/i),
    ).toBeVisible();

    await page
      .getByRole("tab", { name: /Pharmacy QR Dispense/i })
      .click();
    await expect(
      page.getByText(/Pharmacy QR Verification & Safe Dispensing/i),
    ).toBeVisible();

    await page
      .getByRole("tab", { name: /Diagnostic Labs & Scans/i })
      .click();
    await expect(
      page.getByLabel(/Document Format/i),
    ).toContainText("PDF Report");
    await expect(page.locator("#s3-clinical-file")).toBeAttached();
    await expect(page.locator("select#clin-lab-facility")).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Upload Diagnostic File/i }),
    ).toBeVisible();

    const hasOverflowClinical = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    );
    expect(hasOverflowClinical, "Horizontal scroll overflow on /clinical").toBe(
      false,
    );

    // Navigate from /clinical to Pharmacy Storefront (/pharmacy)
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

    // Navigate from /pharmacy to Slice 5 Master Operations & Compliance Center (/admin)
    await navigateTo("Admin");
    await expect(
      page.getByRole("heading", {
        name: /Master Operations & Compliance Center/i,
      }),
    ).toBeVisible();

    await expect(page.getByText("MAD", { exact: true })).toBeVisible();
    await page.getByRole("tab", { name: /Disputes/i }).click();
    await expect(
      page.getByRole("heading", { name: /Report Care Issue or Service Dispute/i }),
    ).toBeVisible();
    await expect(page.locator("select#admin-dispute-target")).toBeVisible();
    await page.getByRole("tab", { name: /Activity Log/i }).click();
    await expect(
      page.getByRole("heading", { name: /Searchable Activity Log/i }),
    ).toBeVisible();

    const hasOverflowAdmin = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    );

    // Navigate from /admin to Phase 6 Patient Care Hub (/patient)
    await navigateTo("My Care");
    await expect(
      page.getByRole("heading", {
        name: /My Saved Doctors, Deadlines & Shared Documents/i,
      }),
    ).toBeVisible();
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
        name: /My Saved Doctors, Deadlines & Shared Documents/i,
      }),
    ).toBeVisible();
    await page.reload();
    await expect(
      page.getByRole("heading", {
        name: /My Saved Doctors, Deadlines & Shared Documents/i,
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
