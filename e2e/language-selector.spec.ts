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
const SWITCH_LOCALES: Locale[] = ["fr", "es", "ja"];
const HTML_LANG: Record<Locale, string> = {
  en: "en-US",
  fr: "fr-FR",
  es: "es-ES",
  ja: "ja-JP",
};

const PUBLIC_PAGE_COPY: Record<
  Locale,
  {
    moviesHeading: string;
    moviesTitle: string;
    moviesDescription: string;
    voiceActorTitle: string;
    voiceActorDescription: string;
    voiceActorSearchPlaceholder: string;
    searchTitle: string;
    searchDescription: string;
    searchPlaceholder: string;
    termsTitle: string;
    termsDescription: string;
  }
> = {
  en: {
    moviesHeading: "Movies",
    moviesTitle: "All Movies",
    moviesDescription:
      "Browse popular movies and discover their dubbing voice actors.",
    voiceActorTitle: "Richard Darbois - Voice Actor | DubbingBase",
    voiceActorDescription:
      "Discover the biography, filmography, and dubbing roles of Richard Darbois.",
    voiceActorSearchPlaceholder: "Search roles, titles or actors...",
    searchTitle: "Search",
    searchDescription: "Search for movies, series, voice actors, and more",
    searchPlaceholder: "Search...",
    termsTitle: "Terms and Conditions of Sale (API)",
    termsDescription: "Read the terms governing use of the DubbingBase API.",
  },
  fr: {
    moviesHeading: "Films",
    moviesTitle: "Tous les films",
    moviesDescription:
      "Parcourez les films populaires et découvrez leurs comédiens de doublage.",
    voiceActorTitle: "Richard Darbois - Comédien de doublage | DubbingBase",
    voiceActorDescription:
      "Découvrez la biographie, la filmographie et les rôles de doublage de Richard Darbois.",
    voiceActorSearchPlaceholder: "Rechercher des rôles, titres ou acteurs...",
    searchTitle: "Recherche",
    searchDescription: "Rechercher des films, séries, comédiens et plus",
    searchPlaceholder: "Rechercher...",
    termsTitle: "Conditions Générales de Vente (API)",
    termsDescription:
      "Consultez les conditions régissant l’utilisation de l’API DubbingBase.",
  },
  es: {
    moviesHeading: "Películas",
    moviesTitle: "Todas las películas",
    moviesDescription:
      "Explora las películas populares y descubre sus actores de doblaje.",
    voiceActorTitle: "Richard Darbois - Actor de doblaje | DubbingBase",
    voiceActorDescription:
      "Descubre la biografía, filmografía y roles de doblaje de Richard Darbois.",
    voiceActorSearchPlaceholder: "Buscar papeles, títulos o actores...",
    searchTitle: "Búsqueda",
    searchDescription: "Buscar películas, series, actores de doblaje y más",
    searchPlaceholder: "Buscar...",
    termsTitle: "Condiciones Generales de Venta (API)",
    termsDescription:
      "Consulta las condiciones que rigen el uso de la API de DubbingBase.",
  },
  ja: {
    moviesHeading: "映画",
    moviesTitle: "すべての映画",
    moviesDescription: "人気の映画を見て、吹き替え声優をチェックしましょう。",
    voiceActorTitle: "Richard Darbois - 声優 | DubbingBase",
    voiceActorDescription:
      "Richard Darboisの略歴、フィルモグラフィー、吹き替えの役を発見してください。",
    voiceActorSearchPlaceholder: "役名、タイトル、俳優を検索...",
    searchTitle: "検索",
    searchDescription: "映画、テレビ番組、声優などを検索",
    searchPlaceholder: "検索...",
    termsTitle: "販売条件（API）",
    termsDescription: "DubbingBase APIの利用条件をご確認ください。",
  },
};

function localizedPath(locale: Locale, path: string): string {
  return locale === "en" ? path : "/" + locale + path;
}

function expectSsrMetadata(
  html: string,
  title: string,
  description: string,
  locale: Locale,
): void {
  expect(html.match(/<html\b[^>]*lang="([^"]*)"/)?.[1]).toBe(
    HTML_LANG[locale],
  );
  expect(html.match(/<title>([^<]*)<\/title>/)?.[1]).toBe(title);
  const descriptionTag = html.match(
    /<meta\b[^>]*name="description"[^>]*>/,
  )?.[0];
  expect(descriptionTag?.match(/content="([^"]*)"/)?.[1]).toBe(description);
}

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
  const option = page.getByRole("option", {
    name: LOCALE_LABELS[locale],
    exact: true,
  });
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
      test(`mix: cookie=${cookie} visits URL /${url === "en" ? "" : url} → redirected to cookie locale ${cookie}`, async ({
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
            message: `cookie=${cookie} should redirect away from /${url} to /${cookie === "en" ? "" : cookie}`,
          })
          .toBe(cookie);
        await assertLocaleFooter(page, cookie);
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

test.describe("Localized public page metadata", () => {
  test.beforeEach(async ({ page, context }) => {
    test.setTimeout(120000);
    await setupMockApi(page);
    await context.clearCookies();
  });

  for (const locale of ALL_LOCALES) {
    test("direct SSR pages render localized copy and metadata for " + locale, async ({
      page,
      context,
    }) => {
      const copy = PUBLIC_PAGE_COPY[locale];
      await setUserLangCookie(context, locale);

      const moviesResponse = await page.goto(localizedPath(locale, "/movies"), {
        waitUntil: "domcontentloaded",
      });
      expectSsrMetadata(
        (await moviesResponse?.text()) || "",
        copy.moviesTitle + " | DubbingBase",
        copy.moviesDescription,
        locale,
      );
      await expect(page.locator("html")).toHaveAttribute(
        "lang",
        HTML_LANG[locale],
      );
      await expect(
        page.getByRole("heading", { level: 1, name: copy.moviesHeading }),
      ).toBeVisible();
      await expect(page).toHaveTitle(copy.moviesTitle + " | DubbingBase");
      await expect(page.locator('meta[name="description"]')).toHaveAttribute(
        "content",
        copy.moviesDescription,
      );

      const voiceActorResponse = await page.goto(
        localizedPath(locale, "/voice-actor/1"),
        {
          waitUntil: "domcontentloaded",
        },
      );
      expectSsrMetadata(
        (await voiceActorResponse?.text()) || "",
        copy.voiceActorTitle,
        copy.voiceActorDescription,
        locale,
      );
      await expect(
        page.getByRole("heading", { level: 1, name: "Richard Darbois" }),
      ).toBeVisible();
      await expect(page).toHaveTitle(copy.voiceActorTitle);
      await expect(page.locator('meta[name="description"]')).toHaveAttribute(
        "content",
        copy.voiceActorDescription,
      );
      await expect(
        page.getByPlaceholder(copy.voiceActorSearchPlaceholder),
      ).toBeVisible();

      const searchResponse = await page.goto(localizedPath(locale, "/search"), {
        waitUntil: "domcontentloaded",
      });
      expectSsrMetadata(
        (await searchResponse?.text()) || "",
        copy.searchTitle + " | DubbingBase",
        copy.searchDescription,
        locale,
      );
      await expect(page).toHaveTitle(copy.searchTitle + " | DubbingBase");
      await expect(
        page.getByRole("heading", { level: 1, name: copy.searchTitle }),
      ).toBeVisible();
      await expect(page.locator('meta[name="description"]')).toHaveAttribute(
        "content",
        copy.searchDescription,
      );
      await expect(page.getByTestId("search-input")).toHaveAttribute(
        "placeholder",
        copy.searchPlaceholder,
      );

      const termsResponse = await page.goto(
        localizedPath(locale, "/terms-api"),
        { waitUntil: "domcontentloaded" },
      );
      expectSsrMetadata(
        (await termsResponse?.text()) || "",
        copy.termsTitle + " | DubbingBase",
        copy.termsDescription,
        locale,
      );
      await expect(
        page.getByRole("heading", { level: 1, name: copy.termsTitle }),
      ).toBeVisible();
    });
  }

  test("locale selector updates listing and detail copy after SSR", async ({
    page,
    context,
  }) => {
    await setUserLangCookie(context, "en");
    await page.goto("/movies", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveTitle(
      PUBLIC_PAGE_COPY.en.moviesTitle + " | DubbingBase",
    );

    for (const locale of SWITCH_LOCALES) {
      await switchToLocaleViaSelector(page, locale);
      const copy = PUBLIC_PAGE_COPY[locale];
      await expect(
        page.getByRole("heading", { level: 1, name: copy.moviesHeading }),
      ).toBeVisible();
      await expect(page).toHaveTitle(copy.moviesTitle + " | DubbingBase");
      await expect(page.locator('meta[name="description"]')).toHaveAttribute(
        "content",
        copy.moviesDescription,
      );
    }

    await setUserLangCookie(context, "en");
    await page.goto("/voice-actor/1", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveTitle(PUBLIC_PAGE_COPY.en.voiceActorTitle);

    for (const locale of SWITCH_LOCALES) {
      await switchToLocaleViaSelector(page, locale);
      const copy = PUBLIC_PAGE_COPY[locale];
      await expect(
        page.getByRole("heading", { level: 1, name: "Richard Darbois" }),
      ).toBeVisible();
      await expect(page).toHaveTitle(copy.voiceActorTitle);
      await expect(page.locator('meta[name="description"]')).toHaveAttribute(
        "content",
        copy.voiceActorDescription,
      );
      await expect(
        page.getByPlaceholder(copy.voiceActorSearchPlaceholder),
      ).toBeVisible();
    }
  });
});
