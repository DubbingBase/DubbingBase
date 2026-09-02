import { test, expect, type Page } from "@playwright/test";
import { setupMockApi } from "./helpers/mock-api";

const TRANSLATIONS: Record<
  "en" | "fr" | "es" | "ja",
  Record<string, string>
> = {
  en: {
    "footer.movies": "Movies",
    "footer.series": "Series",
    "footer.voiceActors": "Voice Actors",
    "footer.studios": "Studios",
    "nav.home": "Home",
    "common.search": "Search",
    "home.welcome": "Welcome!",
  },
  fr: {
    "footer.movies": "Films",
    "footer.series": "Séries",
    "footer.voiceActors": "Comédiens",
    "footer.studios": "Studios",
    "nav.home": "Accueil",
    "common.search": "Rechercher",
    "home.welcome": "Bienvenue !",
  },
  es: {
    "footer.movies": "Películas",
    "footer.series": "Series",
    "footer.voiceActors": "Actores de voz",
    "footer.studios": "Estudios",
    "nav.home": "Inicio",
    "common.search": "Buscar",
    "home.welcome": "¡Bienvenido!",
  },
  ja: {
    "footer.movies": "映画",
    "footer.series": "シリーズ",
    "footer.voiceActors": "声優",
    "footer.studios": "スタジオ",
    "nav.home": "ホーム",
    "common.search": "検索",
    "home.welcome": "ようこそ！",
  },
};

const LOCALE_URLS: Record<"en" | "fr" | "es" | "ja", string> = {
  en: "/",
  fr: "/fr",
  es: "/es",
  ja: "/ja",
};

const ALL_LOCALES: Array<"en" | "fr" | "es" | "ja"> = [
  "en",
  "fr",
  "es",
  "ja",
];

async function openLanguageMenu(page: Page) {
  const trigger = page
    .locator("button[aria-label*='language' i]")
    .first();
  await expect(trigger).toBeVisible({ timeout: 10000 });
  await trigger.click();
}

async function selectLanguageFromMenu(page: Page, optionText: string) {
  const option = page.getByText(optionText).first();
  await expect(option).toBeVisible({ timeout: 5000 });
  await option.click();
}

async function assertLocaleActive(page: Page, locale: "en" | "fr" | "es" | "ja") {
  const expected = LOCALE_URLS[locale];
  if (locale === "en") {
    await expect(page).toHaveURL(/\/$|\/(?!\/?(fr|es|ja)\/?)/);
  } else {
    await page.waitForURL(new RegExp(`/${locale}/?`), { timeout: 10000 });
  }
  void expected;
  await page.waitForTimeout(800);
}

async function assertTranslatedKeys(
  page: Page,
  locale: "en" | "fr" | "es" | "ja"
) {
  const translations = TRANSLATIONS[locale];
  const otherLocales = ALL_LOCALES.filter((l) => l !== locale);

  for (const [key, expectedText] of Object.entries(translations)) {
    const scoped = key.startsWith("footer.")
      ? page.locator("footer")
      : page.locator("body");
    await expect(
      scoped.locator(`text=${expectedText}`).first(),
      `[${locale}] ${key} should render "${expectedText}"`
    ).toBeVisible({ timeout: 10000 });
  }

  const rendered = await page.locator("body").innerText();
  for (const [key, value] of Object.entries(translations)) {
    expect(
      rendered.includes(key),
      `[${locale}] raw i18n key "${key}" leaked into the DOM`
    ).toBe(false);
    expect(
      rendered.includes(value) || value.length === 0,
      `[${locale}] translated value "${value}" not present in DOM`
    ).toBe(true);
  }
  void otherLocales;
}

test.describe("Language Selector", () => {
  test.beforeEach(async ({ page }) => {
    test.setTimeout(90000);
    const api = await setupMockApi(page);
    await page.context().clearCookies();
    void api;
  });

  for (const locale of ALL_LOCALES) {
    test(`page spawned at ${locale} URL renders translated keys`, async ({
      page,
    }) => {
      const url = LOCALE_URLS[locale];
      await page.goto(url, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(1500);

      await assertLocaleActive(page, locale);
      await assertTranslatedKeys(page, locale);
    });
  }

  test("selector switches between all four locales and translates keys at each step", async ({
    page,
  }) => {
    const startUrl = LOCALE_URLS.en;
    await page.goto(startUrl, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1500);

    await assertLocaleActive(page, "en");
    await assertTranslatedKeys(page, "en");

    const flow: Array<{
      from: "en" | "fr" | "es" | "ja";
      to: "en" | "fr" | "es" | "ja";
      label: string;
    }> = [
      { from: "en", to: "fr", label: "Français" },
      { from: "fr", to: "es", label: "Español" },
      { from: "es", to: "ja", label: "日本語" },
      { from: "ja", to: "en", label: "English" },
    ];

    for (const step of flow) {
      await openLanguageMenu(page);
      await selectLanguageFromMenu(page, step.label);
      await assertLocaleActive(page, step.to);
      await assertTranslatedKeys(page, step.to);
    }
  });
});
