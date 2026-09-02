import { test, expect, type Page } from "@playwright/test";
import { setupMockApi } from "./helpers/mock-api";

type Locale = "en" | "fr" | "es" | "ja";

const FOOTER_TEXT: Record<Locale, string[]> = {
  en: ["Movies", "Series", "Voice Actors", "Studios"],
  fr: ["Films", "Séries", "Comédiens", "Studios"],
  es: ["Películas", "Series", "Actores de voz", "Estudios"],
  ja: ["映画", "シリーズ", "声優", "スタジオ"],
};

const LOCALE_URLS: Record<Locale, string> = {
  en: "/",
  fr: "/fr",
  es: "/es",
  ja: "/ja",
};

async function openLanguageMenu(page: Page) {
  const trigger = page
    .locator("button[aria-label*='language' i]")
    .first();
  await expect(trigger).toBeVisible({ timeout: 10000 });
  await trigger.click();
  await page.waitForTimeout(500);
}

async function switchToLocale(page: Page, locale: Locale) {
  const label: Record<Locale, string> = {
    en: "English",
    fr: "Français",
    es: "Español",
    ja: "日本語",
  };
  await openLanguageMenu(page);
  const option = page.getByText(label[locale]).first();
  await expect(option).toBeVisible({ timeout: 5000 });
  await option.click();
  if (locale === "en") {
    await expect(page).toHaveURL(/\/$|\/(?!\/?(fr|es|ja)\/?)/, {
      timeout: 10000,
    });
  } else {
    await page.waitForURL(new RegExp(`/${locale}/?`), { timeout: 10000 });
  }
  await page.waitForTimeout(1500);
}

async function assertNoRawKeys(page: Page) {
  const bodyText = await page.locator("body").innerText();
  const dots = bodyText.match(/\b(footer|nav|home|common|actor|voiceActor)\.[\w]+/g) || [];
  expect(
    dots,
    "raw i18n keys should not appear in rendered page"
  ).toHaveLength(0);
}

test.describe("Language Selector", () => {
  test.beforeEach(async ({ page, context }) => {
    test.setTimeout(90000);
    await setupMockApi(page);
    await context.clearCookies();
  });

  for (const locale of (["en", "fr", "es", "ja"] as Locale[])) {
    test(`page spawned at /${locale === "en" ? "" : locale} renders translated footer keys`, async ({
      page,
      context,
    }) => {
      await context.addCookies([
        {
          name: "user_lang",
          value: locale,
          url: "http://localhost:3050",
          sameSite: "Lax",
        },
      ]);

      const url = LOCALE_URLS[locale];
      await page.goto(url, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(1500);

      if (locale === "en") {
        await expect(page).toHaveURL(/\/$|\/(?!\/?(fr|es|ja)\/?)/, {
          timeout: 10000,
        });
      } else {
        await page.waitForURL(new RegExp(`/${locale}/?`), { timeout: 10000 });
      }

      for (const text of FOOTER_TEXT[locale]) {
        await expect(
          page.getByText(text).first(),
          `[${locale}] footer should contain "${text}"`
        ).toBeVisible({ timeout: 10000 });
      }

      await assertNoRawKeys(page);
    });
  }

  test("selector switches between all four locales and renders correct translations at each step", async ({
    page,
    context,
  }) => {
    await context.addCookies([
      {
        name: "user_lang",
        value: "en",
        url: "http://localhost:3050",
        sameSite: "Lax",
      },
    ]);
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1500);

    for (const locale of (["fr", "es", "ja", "en"] as Locale[])) {
      await switchToLocale(page, locale);

      for (const text of FOOTER_TEXT[locale]) {
        await expect(
          page.getByText(text).first(),
          `[${locale}] after switch, footer should contain "${text}"`
        ).toBeVisible({ timeout: 10000 });
      }

      await assertNoRawKeys(page);
    }
  });
});
