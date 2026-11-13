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

    // Interactive check: switch CountryPack to Morocco (MA) and verify RTL + hotline 141
    await page.getByRole("button", { name: "MA", exact: true }).click();
    await expect(page.getByText(/Active CountryPack: Morocco/i)).toBeVisible();
    await expect(page.getByText(/141 \/ 15/)).toBeVisible();

    const hasOverflowHome = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    );
    expect(hasOverflowHome, "Horizontal scroll overflow on /").toBe(false);

    // Navigate to Slice 1 Clinical & Ops Access Portal (/portal)
    await page.getByRole("link", { name: "Portal", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: /Clinical & Ops Access Portal/i }),
    ).toBeVisible();

    // Switch CountryPack to Morocco (MA) and test tabs + live license regex validation
    await page.getByRole("button", { name: "MA", exact: true }).click();
    await expect(page.getByText(/Jurisdiction:\s*Morocco/i)).toBeVisible();

    await page.getByRole("tab", { name: /Register/i }).click();
    await expect(page.getByLabel("Ecosystem Actor Role")).toBeVisible();
    await expect(page.getByLabel("Ecosystem Actor Role")).not.toContainText("OPS_ADMIN");

    await page.getByRole("tab", { name: /Onboard Facility/i }).click();
    const licenseInput = page.getByLabel(/Ministry License \(MA\)/i);
    await licenseInput.fill("BADFORMAT");
    await expect(page.getByText("Invalid Jurisdiction Format")).toBeVisible();
    await licenseInput.fill("MA-CLIN-90812");
    await expect(page.getByText("Pattern Valid")).toBeVisible();

    const hasOverflowPortal = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    );
    expect(hasOverflowPortal, "Horizontal scroll overflow on /portal").toBe(
      false,
    );

    // Navigate from /portal to Slice 2 Live Medical Map & Dispatch Console (/map)
    await page.getByRole("link", { name: "Live Map", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: /Live Medical Map & Dispatch Console/i }),
    ).toBeVisible();

    await page.getByRole("button", { name: "MA", exact: true }).click();
    await expect(page.getByText(/Casablanca Central Metro/i)).toBeVisible();
    await page.getByRole("button", { name: "Hospitals", exact: true }).click();
    await page.getByRole("button", { name: "Zoom in viewport" }).click();

    const hasOverflowMap = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    );
    expect(hasOverflowMap, "Horizontal scroll overflow on /map").toBe(false);

    // Navigate from /map to Slice 3 Multi-Clinic Booking Engine (/booking)
    await page.getByRole("link", { name: "Booking", exact: true }).click();
    await expect(
      page.getByRole("heading", {
        name: /Doctor Shift Roster & Appointment Engine/i,
      }),
    ).toBeVisible();

    await page.getByRole("button", { name: "MA", exact: true }).click();
    await expect(page.getByText(/Available Multi-Clinic Slots/i)).toBeVisible();
    await expect(page.getByText(/MAD/i)).toBeVisible();

    const hasOverflowBooking = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    );
    expect(hasOverflowBooking, "Horizontal scroll overflow on /booking").toBe(
      false,
    );

    // Navigate from /booking to Slice 4 Clinical Care & Pharmacy Workspace (/clinical)
    await page.getByRole("link", { name: "Clinical", exact: true }).click();
    await expect(
      page.getByRole("heading", {
        name: /Clinical Care, QR E-Prescriptions & Direct S3 Labs/i,
      }),
    ).toBeVisible();

    await page
      .getByRole("tab", { name: /Pharmacy QR Dispense/i })
      .click();
    await expect(
      page.getByText(/Pharmacy QR Verification & Atomic Dispensing/i),
    ).toBeVisible();

    await page
      .getByRole("tab", { name: /Diagnostic Labs & S3 Media/i })
      .click();
    await expect(
      page.getByLabel(/Allowed Clinical MIME/i),
    ).toContainText("application/pdf");

    const hasOverflowClinical = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    );
    expect(hasOverflowClinical, "Horizontal scroll overflow on /clinical").toBe(
      false,
    );

    // Navigate from /clinical to Slice 5 Master Operations & Compliance Center (/admin)
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
      page.getByRole("heading", { name: /File Governance or SLA Dispute/i }),
    ).toBeVisible();
    await page.getByRole("tab", { name: /Audit Trail/i }).click();
    await expect(
      page.getByRole("heading", { name: /Filterable Immutable Audit Stream/i }),
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
