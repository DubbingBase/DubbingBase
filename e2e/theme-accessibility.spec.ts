import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { setupMockApi } from "./helpers/mock-api";

const themes = ["light", "dark"];

test.describe("Website theme accessibility", () => {
  test.describe.configure({ mode: "serial" });

  for (const theme of themes) {
    test(`${theme} theme exposes semantic tokens and remains accessible`, async ({
      page,
    }) => {
      test.setTimeout(90000);
      const api = await setupMockApi(page);

      await page.context().addCookies([
        {
          name: "dubbingbase-theme",
          value: theme,
          url: "http://localhost:3050",
        },
      ]);
      await page.goto("/", { waitUntil: "domcontentloaded" });
      await expect(page.locator("body")).toBeVisible({ timeout: 15000 });
      await page.waitForTimeout(1000);

      const themeState = await page.evaluate(() => {
        const rootStyle = getComputedStyle(document.documentElement);
        const bodyStyle = getComputedStyle(document.body);
        return {
          dataTheme: document.documentElement.dataset.theme,
          background: rootStyle
            .getPropertyValue("--app-color-background")
            .trim(),
          surface: rootStyle.getPropertyValue("--app-color-surface").trim(),
          text: rootStyle.getPropertyValue("--app-color-text").trim(),
          border: rootStyle.getPropertyValue("--app-color-border").trim(),
          bodyBackground: bodyStyle.backgroundColor,
          bodyColor: bodyStyle.color,
        };
      });

      expect(themeState.dataTheme).toBe(theme);
      expect(themeState.background).not.toBe("");
      expect(themeState.surface).not.toBe("");
      expect(themeState.text).not.toBe("");
      expect(themeState.border).not.toBe("");
      expect(themeState.bodyBackground).not.toBe("rgba(0, 0, 0, 0)");
      expect(themeState.bodyColor).not.toBe("rgba(0, 0, 0, 0)");

      await expect(page).toHaveScreenshot(`theme-${theme}.png`, {
        animations: "disabled",
        fullPage: false,
      });

      const accessibility = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa"])
        .analyze();
      expect(accessibility.violations).toEqual([]);
      api.expectNoErrors();
    });
  }

  for (const theme of themes) {
    test(`${theme} theme keeps detail and form surfaces readable`, async ({
      page,
    }) => {
      test.setTimeout(90000);
      const api = await setupMockApi(page);

      await page.context().addCookies([
        {
          name: "dubbingbase-theme",
          value: theme,
          url: "http://localhost:3050",
        },
      ]);
      await page.goto("/movie/85", { waitUntil: "domcontentloaded" });
      await expect(
        page.getByRole("heading", { name: "Raiders of the Lost Ark" }),
      ).toBeVisible({ timeout: 15000 });

      const detailAccessibility = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa"])
        .analyze();
      expect(detailAccessibility.violations).toEqual([]);

      await page.goto("/login", { waitUntil: "domcontentloaded" });
      await expect(page.getByRole("heading").first()).toBeVisible({
        timeout: 15000,
      });

      const formAccessibility = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa"])
        .analyze();
      expect(formAccessibility.violations).toEqual([]);
      api.expectNoErrors();
    });
  }
});
