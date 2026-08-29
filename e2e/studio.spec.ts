import { test, expect } from "@playwright/test";
import { setupMockApi } from "./helpers/mock-api";

test.describe("Studio Profile & Dubbed Projects", () => {
  test.beforeEach(async ({ page }) => {
    await setupMockApi(page);
  });

  test("renders Studio details, roster, and dubbed projects", async ({
    page,
  }) => {
    const api = await setupMockApi(page);
    await page.goto("/studio/10", { waitUntil: "domcontentloaded" });

    // Verify studio name and info
    await expect(
      page.getByRole("heading", { name: "Dubbing Brothers" }),
    ).toBeVisible({ timeout: 10000 });
    await expect(page.locator("body")).toContainText("France");

    // Verify dubbed project is shown
    await expect(page.locator("body")).toContainText("Raiders of the Lost Ark");

    // Verify voice actor roster
    await expect(page.locator("body")).toContainText("Richard Darbois");

    api.expectNoErrors();
  });
});
