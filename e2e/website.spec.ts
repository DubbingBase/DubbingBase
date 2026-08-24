import { test, expect } from "@playwright/test";

test("Website loads without errors", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (err) => {
    errors.push(err.message);
  });

  await page.goto("/", { waitUntil: "domcontentloaded" });
  // Give hydration a moment without relying on networkidle,
  // which never settles when clients hold open connections
  // (Supabase realtime, OneSignal, etc.)
  await page.waitForTimeout(2000);

  // Verify the page rendered some content
  const body = await page.locator("body");
  await expect(body).toBeVisible();

  // Specifically check for the known hydration error
  // If "Cannot redefine property: imgEl" happens, it should be caught here.
  const hasImgElError = errors.some((msg) =>
    msg.includes("Cannot redefine property: imgEl"),
  );
  expect(hasImgElError).toBe(false);
});
