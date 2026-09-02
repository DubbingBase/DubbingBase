import { test, expect, type Page, type BrowserContext } from "@playwright/test";
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

const LOCALE_LABELS: Record<Locale, string> = {
  en: "English",
  fr: "Français",
  es: "Español",
  ja: "日本語",
};

const ALL_LOCALES: Locale[] = ["en", "fr", "es", "ja"];

async function setUserLangCookie(context: BrowserContext, locale: Locale) {
  await context.addCookies([
    {
      name: "user_lang",
      value: locale,
      url: "http://localhost:3050",
      sameSite: "Lax",
    },
  ]);
}

async function openLanguageMenu(page: Page) {
  const trigger = page.locator("button[aria-label*='language' i]").first();
  await expect(trigger).toBeVisible({ timeout: 10000 });
  await trigger.click();
  await page.waitForTimeout(500);
}

async function switchToLocaleViaSelector(page: Page, locale: Locale) {
  await openLanguageMenu(page);
  const option = page.getByText(LOCALE_LABELS[locale]).first();
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

async function getActiveLocale(page: Page): Promise<Locale> {
  const url = new URL(page.url());
  const seg = url.pathname.split("/").filter(Boolean)[0];
  if (seg === "fr") return "fr";
  if (seg === "es") return "es";
  if (seg === "ja") return "ja";
  return "en";
}

async function assertLocaleFooter(page: Page, locale: Locale) {
  for (const text of FOOTER_TEXT[locale]) {
    await expect(
      page.getByText(text).first(),
      `[${locale}] footer should contain "${text}"`
    ).toBeVisible({ timeout: 10000 });
  }

  for (const other of ALL_LOCALES) {
    if (other === locale) continue;
    for (const text of FOOTER_TEXT[other]) {
      if (FOOTER_TEXT[locale].includes(text)) continue;
      const count = await page.getByText(text).count();
      expect(
        count,
        `[${locale}] should NOT contain ${other} footer text "${text}"`
      ).toBe(0);
    }
  }
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

  for (const locale of ALL_LOCALES) {
    test(`spawned at /${locale === "en" ? "" : locale} with matching cookie ${locale} renders correctly`, async ({
      page,
      context,
    }) => {
      await setUserLangCookie(context, locale);
      await page.goto(LOCALE_URLS[locale], { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(1500);

      expect(await getActiveLocale(page)).toBe(locale);
      await assertLocaleFooter(page, locale);
      await assertNoRawKeys(page);
    });
  }

  for (const cookie of ALL_LOCALES) {
    for (const url of ALL_LOCALES) {
      if (cookie === url) continue;
      test(`mix: cookie=${cookie} visits URL /${url === "en" ? "" : url} resolves to URL locale and renders it correctly`, async ({
        page,
        context,
      }) => {
        await setUserLangCookie(context, cookie);
        await page.goto(LOCALE_URLS[url], { waitUntil: "domcontentloaded" });
        await page.waitForTimeout(1500);

        expect(await getActiveLocale(page)).toBe(url);
        await assertLocaleFooter(page, url);
        await assertNoRawKeys(page);
      });
    }
  }

  test("cross-locale selector round-trip: each starting URL can reach each final locale", async ({
    page,
    context,
  }) => {
    for (const start of ALL_LOCALES) {
      await context.clearCookies();
      await setUserLangCookie(context, start);
      await page.goto(LOCALE_URLS[start], { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(1500);
      expect(await getActiveLocale(page)).toBe(start);

      for (const target of ALL_LOCALES) {
        if (target === start) continue;
        await switchToLocaleViaSelector(page, target);
        expect(
          await getActiveLocale(page),
          `from ${start}, selector should land on ${target}`
        ).toBe(target);
        await assertLocaleFooter(page, target);
        await assertNoRawKeys(page);
      }
    }
  });

  test("URL locale wins over cookie locale when both differ: French URL on English cookie stays French", async ({
    page,
    context,
  }) => {
    await setUserLangCookie(context, "en");
    await page.goto("/fr", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1500);

    expect(await getActiveLocale(page)).toBe("fr");
    await assertLocaleFooter(page, "fr");
    await assertNoRawKeys(page);
  });

  test("LanguageBanner appears when URL locale differs from user_lang cookie (visiting /es with fr cookie)", async ({
    page,
    context,
  }) => {
    await setUserLangCookie(context, "fr");
    await page.goto("/es", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1500);

    expect(await getActiveLocale(page)).toBe("es");
    await expect(
      page.getByText("Switch now", { exact: false }).first()
    ).toBeVisible({ timeout: 5000 });
  });
});
