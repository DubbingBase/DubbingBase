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
    voiceActorStructuredTitle: string;
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
    moviesDescription: "Browse popular movies and discover their dubbing voice actors.",
    voiceActorTitle: "Richard Darbois - Voice Actor | DubbingBase",
    voiceActorStructuredTitle: "Richard Darbois - Voice Actor",
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
    moviesDescription: "Parcourez les films populaires et découvrez leurs comédiens de doublage.",
    voiceActorTitle: "Richard Darbois - Comédien de doublage | DubbingBase",
    voiceActorStructuredTitle: "Richard Darbois - Comédien de doublage",
    voiceActorDescription:
      "Découvrez la biographie, la filmographie et les rôles de doublage de Richard Darbois.",
    voiceActorSearchPlaceholder: "Rechercher des rôles, titres ou acteurs...",
    searchTitle: "Recherche",
    searchDescription: "Rechercher des films, séries, comédiens et plus",
    searchPlaceholder: "Rechercher...",
    termsTitle: "Conditions Générales de Vente (API)",
    termsDescription: "Consultez les conditions régissant l’utilisation de l’API DubbingBase.",
  },
  es: {
    moviesHeading: "Películas",
    moviesTitle: "Todas las películas",
    moviesDescription: "Explora las películas populares y descubre sus actores de doblaje.",
    voiceActorTitle: "Richard Darbois - Actor de doblaje | DubbingBase",
    voiceActorStructuredTitle: "Richard Darbois - Actor de doblaje",
    voiceActorDescription:
      "Descubre la biografía, filmografía y roles de doblaje de Richard Darbois.",
    voiceActorSearchPlaceholder: "Buscar papeles, títulos o actores...",
    searchTitle: "Búsqueda",
    searchDescription: "Buscar películas, series, actores de doblaje y más",
    searchPlaceholder: "Buscar...",
    termsTitle: "Condiciones Generales de Venta (API)",
    termsDescription: "Consulta las condiciones que rigen el uso de la API de DubbingBase.",
  },
  ja: {
    moviesHeading: "映画",
    moviesTitle: "すべての映画",
    moviesDescription: "人気の映画を見て、吹き替え声優をチェックしましょう。",
    voiceActorTitle: "Richard Darbois - 声優 | DubbingBase",
    voiceActorStructuredTitle: "Richard Darbois - 声優",
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

const DETAIL_PAGE_LABELS: Record<
  Locale,
  {
    advertisementTitle: string;
    audiobookTitle: string;
    audiobookSeoDescription: string;
    audiobookNoDescription: string;
    audiobookNoCast: string;
    gameDubbingTitle: string;
    synopsis: string;
    podcastCast: string;
    toyTitle: string;
    toyCast: string;
    studioAbout: string;
    studioMediaFallback: string;
    studioProjectSearchPlaceholder: string;
    report: string;
    seasonNotFound: string;
    episodeNotFound: string;
  }
> = {
  en: {
    advertisementTitle: "Commercial & Ad",
    audiobookTitle: "Audiobook",
    audiobookSeoDescription: "Discover the narrators and voice cast for A Book Without Details.",
    audiobookNoDescription: "No description available for this audiobook.",
    audiobookNoCast: "No narrator or cast information available.",
    gameDubbingTitle: "Dubbing (",
    synopsis: "Synopsis",
    podcastCast: "Cast & Voices",
    toyTitle: "Connected Toy & Storyteller",
    toyCast: "Voices & Narrators",
    studioAbout: "About",
    studioMediaFallback: "Media",
    studioProjectSearchPlaceholder: "Search dubbing projects...",
    report: "Report",
    seasonNotFound: "Season not found",
    episodeNotFound: "Episode not found",
  },
  fr: {
    advertisementTitle: "Publicité & Spot",
    audiobookTitle: "Livre audio",
    audiobookSeoDescription:
      "Découvrez les narrateurs et le casting vocal du livre audio A Book Without Details.",
    audiobookNoDescription: "Aucune description disponible pour ce livre audio.",
    audiobookNoCast: "Aucune information sur les narrateurs ou la distribution.",
    gameDubbingTitle: "Doublage (",
    synopsis: "Synopsis",
    podcastCast: "Distribution & Voix",
    toyTitle: "Jouet Interactif & Conteuse",
    toyCast: "Voix & Narrateurs",
    studioAbout: "À propos",
    studioMediaFallback: "Média",
    studioProjectSearchPlaceholder: "Rechercher des projets de doublage...",
    report: "Signaler",
    seasonNotFound: "Saison introuvable",
    episodeNotFound: "Épisode introuvable",
  },
  es: {
    advertisementTitle: "Publicidad y Spot",
    audiobookTitle: "Audiolibro",
    audiobookSeoDescription:
      "Descubre los narradores y el reparto de voces del audiolibro A Book Without Details.",
    audiobookNoDescription: "No hay descripción disponible para este audiolibro.",
    audiobookNoCast: "No hay información disponible sobre narradores o reparto.",
    gameDubbingTitle: "Doblaje (",
    synopsis: "Sinopsis",
    podcastCast: "Reparto & Voces",
    toyTitle: "Juguete Conectado y Cuentacuentos",
    toyCast: "Voces y narradores",
    studioAbout: "Acerca de",
    studioMediaFallback: "Medio",
    studioProjectSearchPlaceholder: "Buscar proyectos de doblaje...",
    report: "Reportar",
    seasonNotFound: "Temporada no encontrada",
    episodeNotFound: "Episodio no encontrado",
  },
  ja: {
    advertisementTitle: "CM・広告",
    audiobookTitle: "オーディオブック",
    audiobookSeoDescription: "A Book Without Detailsのナレーターと声優キャストを見つけましょう。",
    audiobookNoDescription: "このオーディオブックの説明はありません。",
    audiobookNoCast: "ナレーターやキャストの情報はありません。",
    gameDubbingTitle: "吹き替え（",
    synopsis: "あらすじ",
    podcastCast: "キャスト＆声優",
    toyTitle: "スマートトイ・知育スピーカー",
    toyCast: "声とナレーター",
    studioAbout: "概要",
    studioMediaFallback: "メディア",
    studioProjectSearchPlaceholder: "吹き替え作品を検索...",
    report: "報告",
    seasonNotFound: "シーズンが見つかりません",
    episodeNotFound: "エピソードが見つかりません",
  },
};

const SSR_DETAIL_ROUTES: Array<{
  path: string;
  titleKey?:
    | "advertisementTitle"
    | "audiobookTitle"
    | "gameDubbingTitle"
    | "podcastCast"
    | "toyTitle";
  titleText?: string;
  description: string;
  labelKey:
    | "advertisementTitle"
    | "synopsis"
    | "podcastCast"
    | "toyCast"
    | "studioAbout"
    | "studioMediaFallback";
}> = [
  {
    path: "/advertisement/1",
    titleKey: "advertisementTitle",
    description: "A short example commercial.",
    labelKey: "advertisementTitle",
  },
  {
    path: "/audiobook/401",
    titleKey: "audiobookTitle",
    description: "Set on the desert planet Arrakis, Dune is the story of the boy Paul Atreides.",
    labelKey: "synopsis",
  },
  {
    path: "/game/1942",
    titleKey: "gameDubbingTitle",
    description:
      "As war rages on throughout the Northern Realms, you take on the greatest conflict of your life: tracking down the Child of Prophecy.",
    labelKey: "synopsis",
  },
  {
    path: "/podcast/101",
    titleKey: "podcastCast",
    description: "Une saga audio policière captivante.",
    labelKey: "podcastCast",
  },
  {
    path: "/toy/701",
    titleKey: "toyTitle",
    description: "A screen-free audio storyteller.",
    labelKey: "toyCast",
  },
  {
    path: "/studio/10",
    titleText: "Dubbing Brothers",
    description: "L'un des plus grands studios de doublage en France et en Europe.",
    labelKey: "studioAbout",
  },
  {
    path: "/studio/11",
    titleText: "Dubbing Brothers",
    description: "L'un des plus grands studios de doublage en France et en Europe.",
    labelKey: "studioMediaFallback",
  },
];

function decodeHtmlEntities(value: string): string {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&#x27;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">");
}

function localizedPath(locale: Locale, path: string): string {
  return locale === "en" ? path : "/" + locale + path;
}

function expectSsrMetadata(html: string, title: string, description: string, locale: Locale): void {
  expect(html.match(/<html\b[^>]*lang="([^"]*)"/)?.[1]).toBe(HTML_LANG[locale]);
  expect(html.match(/<title>([^<]*)<\/title>/)?.[1]).toBe(title);
  const descriptionTag = html.match(/<meta\b[^>]*name="description"[^>]*>/)?.[0];
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
      expect(count, `[${locale}] should NOT contain ${other} footer text "${text}"`).toBe(0);
    }
  }
}

async function assertNoRawKeys(page: Page) {
  const bodyText = await page.locator("body").innerText();
  const dots = bodyText.match(/\b(footer|nav|home|common|actor|voiceActor)\.[\w]+/g) || [];
  expect(dots, "raw i18n keys should not appear in rendered page").toHaveLength(0);
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

test.describe("Localized public page metadata", () => {
  test.beforeEach(async ({ page, context }) => {
    test.setTimeout(120000);
    await setupMockApi(page);
    await context.clearCookies();
  });

  for (const locale of ALL_LOCALES) {
    test(
      "direct SSR pages render localized copy and metadata for " + locale,
      async ({ page, context }) => {
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
        await expect(page.locator("html")).toHaveAttribute("lang", HTML_LANG[locale]);
        await expect(
          page.getByRole("heading", { level: 1, name: copy.moviesHeading }),
        ).toBeVisible();
        await expect(page).toHaveTitle(copy.moviesTitle + " | DubbingBase");
        await expect(page.locator('meta[name="description"]')).toHaveAttribute(
          "content",
          copy.moviesDescription,
        );

        const voiceActorResponse = await page.goto(localizedPath(locale, "/voice-actor/1"), {
          waitUntil: "domcontentloaded",
        });
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
        const profileStructuredData =
          (await page.locator('script[type="application/ld+json"]').textContent()) ?? "";
        expect(profileStructuredData).toContain(copy.voiceActorStructuredTitle);
        await expect(page.locator('meta[name="description"]')).toHaveAttribute(
          "content",
          copy.voiceActorDescription,
        );
        await expect(page.getByPlaceholder(copy.voiceActorSearchPlaceholder)).toBeVisible();

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
        await expect(page.getByRole("heading", { level: 1, name: copy.searchTitle })).toBeVisible();
        await expect(page.locator('meta[name="description"]')).toHaveAttribute(
          "content",
          copy.searchDescription,
        );
        await expect(page.getByTestId("search-input")).toHaveAttribute(
          "placeholder",
          copy.searchPlaceholder,
        );

        const termsResponse = await page.goto(localizedPath(locale, "/terms-api"), {
          waitUntil: "domcontentloaded",
        });
        expectSsrMetadata(
          (await termsResponse?.text()) || "",
          copy.termsTitle + " | DubbingBase",
          copy.termsDescription,
          locale,
        );
        await expect(page.getByRole("heading", { level: 1, name: copy.termsTitle })).toBeVisible();
      },
    );
  }

  test("directly server-renders localized copy across public media detail routes", async ({
    page,
    context,
  }) => {
    for (const locale of ALL_LOCALES) {
      await context.clearCookies();
      await setUserLangCookie(context, locale);

      for (const route of SSR_DETAIL_ROUTES) {
        const response = await page.goto(localizedPath(locale, route.path), {
          waitUntil: "domcontentloaded",
        });
        expect(response?.status(), `${locale} ${route.path} should render`).toBe(200);
        const ssrHtml = decodeHtmlEntities((await response?.text()) || "");
        const ssrTitle = ssrHtml.match(/<title>(.*?)<\/title>/s)?.[1] || "";
        const descriptionTag =
          ssrHtml.match(/<meta\b(?=[^>]*\bname="description")[^>]*>/)?.[0] || "";
        const ssrDescription = descriptionTag.match(/\bcontent="([^"]*)"/)?.[1] || "";
        const expectedTitle = route.titleKey
          ? DETAIL_PAGE_LABELS[locale][route.titleKey]
          : route.titleText || "";
        expect(ssrTitle, `${locale} ${route.path} SSR title`).toContain(expectedTitle);
        expect(ssrDescription, `${locale} ${route.path} SSR description`).toContain(
          route.description,
        );
        expect(ssrHtml, `${locale} ${route.path} localized label should be in SSR HTML`).toContain(
          DETAIL_PAGE_LABELS[locale][route.labelKey],
        );
        await expect(page.locator("html")).toHaveAttribute("lang", HTML_LANG[locale]);
        await expect(page).toHaveTitle(/\S+/);
        await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", /\S+/);
        if (route.path === "/advertisement/1") {
          await expect(page).toHaveTitle(new RegExp(DETAIL_PAGE_LABELS[locale].advertisementTitle));
        } else {
          await expect(
            page
              .getByText(DETAIL_PAGE_LABELS[locale][route.labelKey], {
                exact: true,
              })
              .first(),
            `${locale} ${route.path} should render its localized label`,
          ).toBeVisible();
        }
      }
    }
  });

  test("studio project search placeholder is localized", async ({ page, context }) => {
    for (const locale of ALL_LOCALES) {
      await context.clearCookies();
      await setUserLangCookie(context, locale);

      const response = await page.goto(localizedPath(locale, "/studio/12"), {
        waitUntil: "domcontentloaded",
      });
      expect(response?.status(), `${locale} studio page should render`).toBe(200);
      await expect(
        page.getByPlaceholder(DETAIL_PAGE_LABELS[locale].studioProjectSearchPlaceholder),
      ).toBeVisible();
    }
  });

  test("localized empty states retain audiobook, season, and episode context", async ({
    page,
    context,
  }) => {
    for (const locale of ALL_LOCALES) {
      await context.clearCookies();
      await setUserLangCookie(context, locale);

      const audiobookResponse = await page.goto(localizedPath(locale, "/audiobook/402"), {
        waitUntil: "domcontentloaded",
      });
      const audiobookHtml = decodeHtmlEntities((await audiobookResponse?.text()) || "");
      const audiobookTitle = audiobookHtml.match(/<title>(.*?)<\/title>/s)?.[1] || "";
      const audiobookDescriptionTag =
        audiobookHtml.match(/<meta\b(?=[^>]*\bname="description")[^>]*>/)?.[0] || "";
      const audiobookDescription = audiobookDescriptionTag.match(/\bcontent="([^"]*)"/)?.[1] || "";
      expect(audiobookTitle).toContain(DETAIL_PAGE_LABELS[locale].audiobookTitle);
      expect(audiobookDescription).toContain(DETAIL_PAGE_LABELS[locale].audiobookSeoDescription);
      expect(audiobookHtml).toContain(DETAIL_PAGE_LABELS[locale].audiobookNoDescription);
      expect(audiobookHtml).toContain(DETAIL_PAGE_LABELS[locale].audiobookNoCast);
      await expect(page.locator("body")).toContainText("A Book Without Details");
      await expect(
        page.getByText(DETAIL_PAGE_LABELS[locale].audiobookNoDescription, {
          exact: true,
        }),
      ).toBeVisible();
      await expect(
        page.getByText(DETAIL_PAGE_LABELS[locale].audiobookNoCast, {
          exact: true,
        }),
      ).toBeVisible();

      const seasonResponse = await page.goto(localizedPath(locale, "/show/1396/season/404"), {
        waitUntil: "domcontentloaded",
      });
      const seasonHtml = decodeHtmlEntities((await seasonResponse?.text()) || "");
      expect(seasonHtml).toContain(DETAIL_PAGE_LABELS[locale].seasonNotFound);
      await expect(
        page.getByRole("heading", {
          name: DETAIL_PAGE_LABELS[locale].seasonNotFound,
        }),
      ).toBeVisible();

      const episodeResponse = await page.goto(
        localizedPath(locale, "/show/1396/season/1/episode/404"),
        { waitUntil: "domcontentloaded" },
      );
      const episodeHtml = decodeHtmlEntities((await episodeResponse?.text()) || "");
      expect(episodeHtml).toContain(DETAIL_PAGE_LABELS[locale].episodeNotFound);
      await expect(
        page.getByRole("heading", {
          name: DETAIL_PAGE_LABELS[locale].episodeNotFound,
        }),
      ).toBeVisible();
    }
  });

  test("game and audiobook labels and metadata update through locale switching", async ({
    page,
    context,
  }) => {
    for (const path of ["/game/1942", "/audiobook/401"]) {
      await context.clearCookies();
      await setUserLangCookie(context, "en");
      await page.goto(path, { waitUntil: "domcontentloaded" });
      await waitForVueHydration(page);

      for (const locale of SWITCH_LOCALES) {
        await switchToLocaleViaSelector(page, locale);
        await expect(page.locator("html")).toHaveAttribute("lang", HTML_LANG[locale]);
        await expect(
          page.getByRole("heading", {
            level: 2,
            name: DETAIL_PAGE_LABELS[locale].synopsis,
          }),
        ).toBeVisible();
        await expect(
          page.locator(`button[title="${DETAIL_PAGE_LABELS[locale].report}"]`),
        ).toBeVisible();

        if (path === "/audiobook/401") {
          await expect
            .poll(() => page.title())
            .toContain(DETAIL_PAGE_LABELS[locale].audiobookTitle);
        }
      }
    }
  });

  test("locale selector updates listing and detail copy after SSR", async ({ page, context }) => {
    await setUserLangCookie(context, "en");
    await page.goto("/movies", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveTitle(PUBLIC_PAGE_COPY.en.moviesTitle + " | DubbingBase");

    for (const locale of SWITCH_LOCALES) {
      await switchToLocaleViaSelector(page, locale);
      const copy = PUBLIC_PAGE_COPY[locale];
      await expect(page.getByRole("heading", { level: 1, name: copy.moviesHeading })).toBeVisible();
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
      await expect(page.getByRole("heading", { level: 1, name: "Richard Darbois" })).toBeVisible();
      await expect(page).toHaveTitle(copy.voiceActorTitle);
      await expect(page.locator('meta[name="description"]')).toHaveAttribute(
        "content",
        copy.voiceActorDescription,
      );
      await expect(page.getByPlaceholder(copy.voiceActorSearchPlaceholder)).toBeVisible();
    }
  });
});
