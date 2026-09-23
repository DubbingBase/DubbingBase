import { test, expect } from "@playwright/test";
import { setupMockApi } from "./helpers/mock-api";
import { MOCK_SEASON } from "./fixtures/mock-data";

test.describe("Media Detail Pages", () => {
  test.beforeEach(async ({ page }) => {
    test.setTimeout(60000);
    await setupMockApi(page);
  });

  test("renders Movie detail page with dubbing cast", async ({ page }) => {
    const api = await setupMockApi(page);
    await page.goto("/movie/85", { waitUntil: "domcontentloaded" });

    // Verify title and synopsis
    await expect(
      page.getByRole("heading", { name: "Raiders of the Lost Ark" }),
    ).toBeVisible({ timeout: 10000 });
    await expect(page.locator("body")).toContainText("Indiana Jones");
    await expect(page.locator("body")).toContainText("Richard Darbois");

    // Verify link to voice actor works
    const vaLink = page.locator("a[href*='/voice-actor/1']").first();
    await expect(vaLink).toBeVisible({ timeout: 5000 });

    api.expectNoErrors();
  });

  test("renders TV Show detail page with cast and seasons", async ({
    page,
  }) => {
    const api = await setupMockApi(page);
    await page.goto("/show/1396", { waitUntil: "domcontentloaded" });

    // Verify title and series cast
    await expect(
      page.getByRole("heading", { name: "Breaking Bad" }),
    ).toBeVisible({ timeout: 10000 });
    await expect(page.locator("body")).toContainText("Walter White");
    await expect(page.locator("body")).toContainText("Jean-Louis Faure");

    api.expectNoErrors();
  });

  test("navigates show to season to episode and preserves the selected dub", async ({
    page,
  }) => {
    await setupMockApi(page);
    await page.goto("/show/1396");

    const seasonLink = page.locator('a[href*="/show/1396/season/1"]').first();
    await expect(seasonLink).toHaveAttribute("href", /dub=139601/);
    await seasonLink.click();
    await expect(page).toHaveURL(/\/show\/1396\/season\/1\?dub=139601/);
    await expect(
      page.getByText("Walter White begins a new chapter."),
    ).toBeVisible();

    await page.getByRole("link", { name: /Pilot/ }).first().click();
    await expect(page).toHaveURL(
      /\/show\/1396\/season\/1\/episode\/1\?dub=139601/,
    );
    await expect(page.locator("body")).toContainText(
      "Walter White starts cooking methamphetamine.",
    );
  });

  test("loads Specials from season zero", async ({ page }) => {
    await setupMockApi(page);
    await page.goto("/show/1396/season/0");
    await expect(page.locator("body")).toContainText("Specials");
    await expect(page.getByRole("heading", { name: "Episodes" })).toBeVisible();
  });

  test("mounts the season skeleton while the season request is delayed", async ({
    page,
  }) => {
    await setupMockApi(page);
    await page.goto("/show/1396");
    await page.route("**/api/season?**", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 700));
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_SEASON),
      });
    });

    await page.locator('a[href*="/show/1396/season/1"]').first().click();
    await expect(page).toHaveURL(/\/show\/1396\/season\/1/);
    await expect(page.locator(".animate-pulse").first()).toBeVisible();
    await expect(
      page.getByText("Walter White begins a new chapter."),
    ).toBeVisible();
  });

  test("shows an error for a timed out French season request", async ({
    page,
  }) => {
    await setupMockApi(page);
    await page.context().addCookies([
      {
        name: "user_lang",
        value: "fr",
        url: "http://localhost:3050",
        sameSite: "Lax",
      },
    ]);
    await page.goto("/fr/show/108978/season/1?dub=524", {
      waitUntil: "domcontentloaded",
    });

    await expect(page).toHaveURL("/fr/show/108978/season/1?dub=524");
    await expect(page.locator(".animate-pulse").first()).toBeVisible();
    await expect(
      page.getByText("Impossible de charger cette saison."),
    ).toBeVisible();
  });

  test("renders Video Game detail page with localized voice cast", async ({
    page,
  }) => {
    const api = await setupMockApi(page);
    await page.goto("/game/1942", { waitUntil: "domcontentloaded" });

    // Verify game title and voice actors
    await expect(
      page.getByRole("heading", { name: "The Witcher 3: Wild Hunt" }),
    ).toBeVisible({ timeout: 10000 });
    await expect(page.locator("body")).toContainText("Geralt de Riv");
    await expect(page.locator("body")).toContainText("Daniel Lobé");

    api.expectNoErrors();
  });

  test("renders Audiobook detail page with narrator information", async ({
    page,
  }) => {
    const api = await setupMockApi(page);
    await page.goto("/audiobook/401", { waitUntil: "domcontentloaded" });

    // Verify audiobook title, author, and narrator
    await expect(page.getByRole("heading", { name: "Dune" })).toBeVisible({
      timeout: 10000,
    });
    await expect(page.locator("body")).toContainText("Frank Herbert");
    await expect(page.locator("body")).toContainText("Richard Darbois");

    api.expectNoErrors();
  });

  test("renders Podcast detail page with voice cast", async ({ page }) => {
    const api = await setupMockApi(page);
    await page.goto("/podcast/101", { waitUntil: "domcontentloaded" });

    // Verify podcast title and cast
    await expect(
      page.getByRole("heading", { name: /L.*Ombre du Doute/i }),
    ).toBeVisible({ timeout: 10000 });
    await expect(page.locator("body")).toContainText("Richard Darbois");

    api.expectNoErrors();
  });
});
