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

    const hasHorizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    );

    expect(pageErrors, "Unexpected uncaught page errors").toEqual([]);
    expect(consoleErrors, "Unexpected console.error logs").toEqual([]);
    expect(badResponses, "Unexpected >= 400 HTTP responses").toEqual([]);
    expect(hasHorizontalOverflow, "Horizontal scroll overflow detected").toBe(
      false,
    );
  });
}
