import { test, expect, type Page, type BrowserContext } from "@playwright/test";
import { setupMockApi, waitForVueHydration } from "./helpers/mock-api";

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
  await expectActiveLocale(page, locale);
  await waitForVueHydration(page);
}

async function getActiveLocale(page: Page): Promise<Locale> {
  const url = new URL(page.url());
  const seg = url.pathname.split("/").filter(Boolean)[0];
  if (seg === "fr") return "fr";
  if (seg === "es") return "es";
  if (seg === "ja") return "ja";
  return "en";
}

async function expectActiveLocale(page: Page, locale: Locale) {
  await expect
    .poll(() => getActiveLocale(page), {
      timeout: 10000,
      intervals: [250, 500, 1000],
    })
    .toBe(locale);
}

async function assertLocaleFooter(page: Page, locale: Locale) {
  for (const text of FOOTER_TEXT[locale]) {
    await expect(
      page.getByText(text).first(),
      `[${locale}] footer should contain "${text}"`,
    ).toBeVisible({ timeout: 10000 });
  }

  for (const other of ALL_LOCALES) {
    if (other === locale) continue;
    for (const text of FOOTER_TEXT[other]) {
      if (FOOTER_TEXT[other].includes(text)) continue;
      const count = await page.getByText(text).count();
      expect(
        count,
        `[${locale}] should NOT contain ${other} footer text "${text}"`,
      ).toBe(0);
    }
  }
}

async function assertNoRawKeys(page: Page) {
  const bodyText = await page.locator("body").innerText();
  const dots =
    bodyText.match(/\b(footer|nav|home|common|actor|voiceActor)\.[\w]+/g) || [];
  expect(dots, "raw i18n keys should not appear in rendered page").toHaveLength(
    0,
  );
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

      await expectActiveLocale(page, locale);
      await assertLocaleFooter(page, locale);
      await assertNoRawKeys(page);
    });
  }

  for (const cookie of ALL_LOCALES) {
    for (const url of ALL_LOCALES) {
      if (cookie === url) continue;
      const expectedLocale = url === "en" ? cookie : url;
      test(`cookie=${cookie} visits URL /${url === "en" ? "" : url} → ${url === "en" ? "root redirect honors cookie" : "explicit URL locale wins"}`, async ({
        page,
        context,
      }) => {
        await setUserLangCookie(context, cookie);
        await page.goto(LOCALE_URLS[url], { waitUntil: "domcontentloaded" });
        await page.waitForTimeout(1500);

        await expect
          .poll(() => getActiveLocale(page), {
            timeout: 10000,
            intervals: [250, 500, 1000],
            message: `cookie=${cookie} visiting /${url === "en" ? "" : url} should select ${expectedLocale}`,
          })
          .toBe(expectedLocale);
        await assertLocaleFooter(page, expectedLocale);
        await assertNoRawKeys(page);
      });
    }
  }

  test("cross-locale selector round-trip: each starting URL can reach each final locale", async ({
    page,
    context,
  }) => {
    test.setTimeout(180000);
    for (const start of ALL_LOCALES) {
      await context.clearCookies();
      await setUserLangCookie(context, start);
      await page.goto(LOCALE_URLS[start], { waitUntil: "domcontentloaded" });
      await waitForVueHydration(page);
      await expectActiveLocale(page, start);

      for (const target of ALL_LOCALES) {
        if (target === start) continue;
        await switchToLocaleViaSelector(page, target);
        expect(
          await getActiveLocale(page),
          `from ${start}, selector should land on ${target}`,
        ).toBe(target);
        await assertLocaleFooter(page, target);
        await assertNoRawKeys(page);
      }
    }
  });
});
