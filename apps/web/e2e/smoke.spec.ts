import { test, expect } from "@playwright/test";

const VIEWPORTS = [
  { name: "desktop", width: 1440, height: 900 },
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

    // Verify all bundled studio medical portraits and pharmacy product WebPs serve and decode cleanly
    const mediaPaths = [
      "/media/avatars/doctor-female.webp",
      "/media/avatars/doctor-male.webp",
      "/media/avatars/pharmacist.webp",
      "/media/avatars/lab-tech.webp",
      "/media/avatars/driver-ems.webp",
      "/media/avatars/patient.webp",
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

    // Verify immediate care action launcher above the fold & multilingual toggle
    await expect(
      page.getByRole("link", { name: /Find Care on Map/i }),
    ).toBeVisible();
    const langGroup = page.getByRole("group", {
      name: "Interface language selector",
    });
    await langGroup.getByRole("button", { name: "FR", exact: true }).click();
    await expect(
      page.getByRole("link", { name: /Explorer la carte des soins/i }),
    ).toBeVisible();
    await langGroup.getByRole("button", { name: "EN", exact: true }).click();

    // Interactive check: switch Care Region to Morocco (MA) and verify hotline 141
    await page.getByRole("button", { name: "MA", exact: true }).click();
    await expect(page.getByText(/Care Region: Morocco/i)).toBeVisible();
    await expect(page.getByText(/141 \/ 15/)).toBeVisible();

    const hasOverflowHome = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    );
    expect(hasOverflowHome, "Horizontal scroll overflow on /").toBe(false);

    // Navigate to Clinical & Ops Access Portal (/portal)
    await page.getByRole("link", { name: "Portal", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: /Clinical & Ops Access Portal/i }),
    ).toBeVisible();

    // Switch Care Region to Morocco (MA) and test tabs + live license validation
    await page.getByRole("button", { name: "MA", exact: true }).click();
    await expect(page.getByText(/Care Region:\s*Morocco/i)).toBeVisible();

    await page.getByRole("tab", { name: /Register$/i }).click();
    await expect(page.getByLabel("Account Type")).toBeVisible();
    await expect(page.getByLabel("Account Type")).not.toContainText("OPS_ADMIN");

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
    await page.getByRole("link", { name: "Live Map", exact: true }).click();
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

    await page.getByRole("button", { name: "MA", exact: true }).click();
    await expect(page.getByText(/Casablanca Central Metro/i)).toBeVisible();
    await page.getByRole("button", { name: "Hospitals", exact: true }).click();
    await page.getByRole("button", { name: "Zoom in viewport" }).click();

    const hasOverflowMap = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    );
    expect(hasOverflowMap, "Horizontal scroll overflow on /map").toBe(false);

    // Navigate from /map to Multi-Clinic Booking Engine (/booking)
    await page.getByRole("link", { name: "Booking", exact: true }).click();
    await expect(
      page.getByRole("heading", {
        name: /Doctor Appointments & Clinic Hours/i,
      }),
    ).toBeVisible();

    await page.getByRole("button", { name: "MA", exact: true }).click();
    await expect(page.getByText(/Available Multi-Clinic Slots/i)).toBeVisible();
    await expect(page.getByText(/MAD/i)).toBeVisible();

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
    await page.getByRole("link", { name: "Clinical", exact: true }).click();
    await expect(
      page.getByRole("heading", {
        name: /Clinical Care, QR E-Prescriptions & Diagnostic Labs/i,
      }),
    ).toBeVisible();
    await expect(page.locator("select#clin-patient-uuid")).toBeVisible();

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
    await page.getByRole("link", { name: "Pharmacy", exact: true }).click();
    await expect(
      page.getByRole("heading", {
        name: /Online Pharmacy Catalog & Courier Checkout/i,
      }),
    ).toBeVisible();
    await expect(page.locator("#pharma-search")).toBeVisible();
    await expect(page.locator("#pharma-facility-filter")).toBeVisible();

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

    // Verify EN / FR / AR bilingual toggle updates document dir="rtl" cleanly then resets to EN
    await page.getByRole("button", { name: "AR", exact: true }).click();
    const htmlDir = await page.evaluate(() => document.documentElement.dir);
    expect(htmlDir).toBe("rtl");
    await page.getByRole("button", { name: "EN", exact: true }).click();

    const hasOverflowPharmacy = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    );
    expect(hasOverflowPharmacy, "Horizontal scroll overflow on /pharmacy").toBe(
      false,
    );

    // Navigate from /pharmacy to Slice 5 Master Operations & Compliance Center (/admin)
    await page.getByRole("link", { name: "Admin", exact: true }).click();
    await expect(
      page.getByRole("heading", {
        name: /Master Operations & Compliance Center/i,
      }),
    ).toBeVisible();

    await page.getByRole("button", { name: "MA", exact: true }).click();
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

    expect(pageErrors, "Unexpected uncaught page errors").toEqual([]);
    expect(consoleErrors, "Unexpected console.error logs").toEqual([]);
    expect(badResponses, "Unexpected >= 400 HTTP responses").toEqual([]);
    expect(hasOverflowAdmin, "Horizontal scroll overflow on /admin").toBe(
      false,
    );
  });
}
