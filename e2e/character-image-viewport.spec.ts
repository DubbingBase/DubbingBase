import { expect, test, type Page, type Request } from "@playwright/test";

type RequestRecord = {
  productions: string[];
  status: "intercepted" | "finished" | "failed";
};

type RequestCapture = {
  records: RequestRecord[];
  byRequest: Map<Request, RequestRecord>;
  inFlight: number;
  maxInFlight: number;
};

const portraitUrl = "https://artworks.thetvdb.com/e2e-character-2012.svg";

function mockRoster(production: string) {
  const character =
    production === "movie:2012"
      ? { id: "2012", name: "Character 2012" }
      : production === "movie:9000"
        ? { id: "9000", name: "Actor role 0" }
        : null;
  return {
    tvdbId: null,
    degraded: false,
    characters: character ? [{ ...character, image: portraitUrl }] : [],
  };
}

async function installCharacterImageMock(
  page: Page,
  options: { failTvdbPortrait?: boolean } = {},
): Promise<RequestCapture> {
  const capture: RequestCapture = {
    records: [],
    byRequest: new Map(),
    inFlight: 0,
    maxInFlight: 0,
  };

  page.on("requestfinished", (request) => {
    const record = capture.byRequest.get(request);
    if (record) record.status = "finished";
  });
  page.on("requestfailed", (request) => {
    const record = capture.byRequest.get(request);
    if (!record) return;
    record.status = "failed";
  });

  await page.route(portraitUrl, (route) =>
    options.failTvdbPortrait
      ? route.abort()
      : route.fulfill({
          contentType: "image/svg+xml",
          body: '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>',
        }),
  );

  await page.route("**/api/character-portraits?**", async (route) => {
    const url = new URL(route.request().url());
    const request = route.request();
    const batch = url.searchParams.get("productions");
    const production = `${url.searchParams.get("mediaType")}:${url.searchParams.get("mediaId")}`;
    const record: RequestRecord = {
      productions: batch?.split(",") ?? [production],
      status: "intercepted",
    };
    capture.records.push(record);
    capture.byRequest.set(request, record);
    capture.inFlight += 1;
    capture.maxInFlight = Math.max(capture.maxInFlight, capture.inFlight);
    await new Promise((resolve) => setTimeout(resolve, 300));

    await route.fulfill({
      json: batch
        ? Object.fromEntries(record.productions.map((key) => [key, mockRoster(key)]))
        : mockRoster(production),
    });
    capture.inFlight -= 1;
  });

  return capture;
}

function resetCapture(capture: RequestCapture): void {
  capture.records.length = 0;
  capture.byRequest.clear();
  capture.inFlight = 0;
  capture.maxInFlight = 0;
}

function requestedProductions(capture: RequestCapture): string[] {
  return capture.records.flatMap((record) => record.productions);
}

function duplicateProductions(capture: RequestCapture): string[] {
  const items = requestedProductions(capture);
  return items.filter((item, index) => items.indexOf(item) !== index);
}

async function waitForRequestQuiet(
  page: Page,
  capture: RequestCapture,
  quietMs = 700,
  timeoutMs = 15000,
): Promise<void> {
  const startedAt = Date.now();
  let lastActivityAt = Date.now();
  let previousCount = capture.records.length;

  while (Date.now() - startedAt < timeoutMs) {
    await page.waitForTimeout(100);
    if (capture.inFlight > 0 || capture.records.length !== previousCount) {
      lastActivityAt = Date.now();
      previousCount = capture.records.length;
      continue;
    }
    if (Date.now() - lastActivityAt >= quietMs) return;
  }

  throw new Error("Character-image requests did not settle before timeout");
}

async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      ),
    )
    .toBe(0);
}

async function waitForVueHydration(page: Page): Promise<void> {
  await page.waitForFunction(() => {
    const root = document.querySelector("#__nuxt");
    return root !== null && Reflect.get(root, "__vue_app__") !== undefined;
  });
}

for (const viewport of [
  { name: "desktop", width: 1280, height: 900 },
  { name: "mobile", width: 390, height: 844 },
]) {
  test(`defers below-viewport grouped portraits on ${viewport.name}`, async ({ page }) => {
    test.setTimeout(120000);
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    const capture = await installCharacterImageMock(page);
    const response = await page.goto("/voice-actor/999", { waitUntil: "domcontentloaded" });
    expect(response?.status()).toBe(200);
    const html = await response?.text();
    expect(html).toContain("Film 2012");
    expect(html?.replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, "")).not.toContain(
      "data-character-image-source",
    );
    await waitForVueHydration(page);

    const filmography = page.locator("#voice-actor-works-results");
    const group = filmography.getByTestId("voice-actor-group").filter({ hasText: "Harrison Ford" });
    const links = group.locator("a[href*='/movie/']");
    await expect(links).toHaveCount(12);
    const first = links.first();
    const last = links.last();
    await expect(first).toHaveAttribute("href", "/movie/2012");
    const lastProduction = `movie:${(await last.getAttribute("href"))?.split("/").pop()}`;

    await waitForRequestQuiet(page, capture);
    const initialCount = capture.records.length;
    await first.evaluate((link) => {
      window.scrollBy({ top: link.getBoundingClientRect().top - window.innerHeight + 40 });
    });
    await expect.poll(() => requestedProductions(capture)).toContain("movie:2012");
    await waitForRequestQuiet(page, capture);
    await expect(page.getByAltText("Character 2012", { exact: true })).toBeVisible();
    const firstRowCount = capture.records.length;
    console.info(
      `Voice actor ${viewport.name}: ${initialCount} initial requests, ${firstRowCount} at first row for ${requestedProductions(capture).length} productions`,
    );
    if (viewport.name === "desktop") expect(firstRowCount).toBeLessThanOrEqual(4);
    expect((await last.boundingBox())?.y).toBeGreaterThan(viewport.height + 400);
    expect(requestedProductions(capture)).not.toContain(lastProduction);

    await last.scrollIntoViewIfNeeded();
    await expect.poll(() => requestedProductions(capture)).toContain(lastProduction);
    await waitForRequestQuiet(page, capture);
    expect(duplicateProductions(capture)).toEqual([]);
    expect(capture.maxInFlight).toBeLessThanOrEqual(4);
    await expectNoHorizontalOverflow(page);
  });
}

test("keeps character image requests scoped to their visible production and pagination", async ({
  page,
}) => {
  test.setTimeout(120000);
  const capture = await installCharacterImageMock(page);

  const response = await page.goto("/voice-actor/999", { waitUntil: "domcontentloaded" });
  expect(response?.status()).toBe(200);
  await waitForVueHydration(page);
  const filmography = page.locator("#voice-actor-works-results");
  const groups = filmography.getByTestId("voice-actor-group");
  const harrisonGroup = groups.filter({ hasText: "Harrison Ford" });
  await expect(harrisonGroup).toHaveCount(1);
  await harrisonGroup.locator("a[href='/movie/2012']").scrollIntoViewIfNeeded();
  await expect.poll(() => capture.records.length, { timeout: 15000 }).toBeGreaterThan(0);
  await waitForRequestQuiet(page, capture);
  await expect(page.locator('img[data-character-image-source="tvdb"]').first()).toHaveAttribute(
    "src",
    portraitUrl,
  );

  const beforeInnerPage = capture.records.length;
  const harrisonWorkLinks = harrisonGroup.locator("a[href*='/movie/']");
  await harrisonGroup.locator("nav button").last().click();
  await expect(harrisonWorkLinks).toHaveCount(3);
  await expect(harrisonWorkLinks.last()).toHaveAttribute("href", /\/movie\/85$/);
  await expect
    .poll(() => capture.records.length, { timeout: 10000 })
    .toBeGreaterThan(beforeInnerPage);
  await waitForRequestQuiet(page, capture);
  await filmography.locator("nav button").last().click();
  await expect(page).toHaveURL(/worksPage=2/);
  await expect(groups).toHaveCount(7);
  await expect(harrisonGroup).toHaveCount(0);
  await waitForRequestQuiet(page, capture);

  const listButton = filmography.getByRole("button", { name: /List|Liste/i }).first();
  await listButton.click();
  await expect(groups).toHaveCount(0);
  await expect(page).not.toHaveURL(/worksPage=2/);
  await expect(filmography.locator(".grid").last().locator(":scope > div")).toHaveCount(20);
  await waitForRequestQuiet(page, capture);
  const beforeListPageTwo = capture.records.length;

  await filmography.locator("nav button").last().click();
  await expect(page).toHaveURL(/worksPage=2/);
  await expect(filmography.locator(".grid").last().locator(":scope > div")).toHaveCount(13);
  await filmography.scrollIntoViewIfNeeded();
  await expect
    .poll(() => capture.records.length, { timeout: 10000 })
    .toBeGreaterThan(beforeListPageTwo);
  await waitForRequestQuiet(page, capture);
  await expectNoHorizontalOverflow(page);

  expect(capture.records.every((record) => record.status === "finished")).toBe(true);
  expect(duplicateProductions(capture)).toEqual([]);

  for (const production of [
    { path: "/movie/85", key: "movie:85" },
    { path: "/show/1396", key: "tv:1396" },
  ]) {
    resetCapture(capture);
    const mediaResponse = await page.goto(production.path, { waitUntil: "domcontentloaded" });
    expect(mediaResponse?.status()).toBe(200);
    await page
      .getByText(/Cast & Crew|Cast and Crew/i)
      .first()
      .scrollIntoViewIfNeeded();
    await expect.poll(() => capture.records.length, { timeout: 15000 }).toBeGreaterThan(0);
    await waitForRequestQuiet(page, capture);

    expect(requestedProductions(capture)).toEqual([production.key]);
    await expectNoHorizontalOverflow(page);
  }

  for (const route of [
    { path: "/actor/3", heading: /Filmography/i },
    { path: "/show/1396/season/1/episode/1", heading: /Cast & Crew|Cast and Crew/i },
  ]) {
    resetCapture(capture);
    const routeResponse = await page.goto(route.path, { waitUntil: "domcontentloaded" });
    expect(routeResponse?.status()).toBe(200);
    await page.getByRole("heading", { name: route.heading }).first().scrollIntoViewIfNeeded();
    await expect.poll(() => capture.records.length, { timeout: 15000 }).toBeGreaterThan(0);
    await waitForRequestQuiet(page, capture);

    expect(duplicateProductions(capture)).toEqual([]);
    await expectNoHorizontalOverflow(page);
  }
});

test("shows a placeholder after a broken TVDB portrait without another request", async ({
  page,
}) => {
  test.setTimeout(60000);
  const capture = await installCharacterImageMock(page, { failTvdbPortrait: true });
  const failedImage = page.waitForEvent(
    "requestfailed",
    (request) => request.url() === portraitUrl,
  );
  await page.goto("/voice-actor/999", { waitUntil: "domcontentloaded" });
  await waitForVueHydration(page);
  const filmography = page.locator("#voice-actor-works-results");
  await filmography.locator("a[href='/movie/2012']").scrollIntoViewIfNeeded();

  await failedImage;
  await expect.poll(() => requestedProductions(capture)).toContain("movie:2012");
  await waitForRequestQuiet(page, capture);
  await expect(page.getByAltText("Character 2012", { exact: true })).toHaveCount(0);
  expect(requestedProductions(capture).filter((key) => key === "movie:2012")).toHaveLength(1);
});

test("loads only current actor filmography cards across pagination", async ({ page }) => {
  test.setTimeout(120000);
  await page.setViewportSize({ width: 1280, height: 900 });
  const capture = await installCharacterImageMock(page);
  await page.goto("/actor/999", { waitUntil: "domcontentloaded" });
  await waitForVueHydration(page);
  const filmography = page
    .getByRole("heading", { name: "Filmography", exact: true })
    .locator("xpath=ancestor::section[1]");
  const cards = filmography.locator("a[href*='/movie/']");
  await expect(cards).toHaveCount(12);
  await filmography
    .getByRole("heading")
    .evaluate((element) => element.scrollIntoView({ block: "start" }));
  await expect.poll(() => capture.records.length, { timeout: 15000 }).toBeGreaterThan(0);
  await waitForRequestQuiet(page, capture);
  expect(requestedProductions(capture)).not.toContain("movie:9012");
  await expect(page.getByAltText("Actor role 0 – Actor film 0", { exact: true })).toHaveAttribute(
    "src",
    portraitUrl,
  );
  const firstRowRequests = capture.records.length;
  console.info(
    `Actor desktop: ${firstRowRequests} requests at first row for ${requestedProductions(capture).length} productions`,
  );
  expect(firstRowRequests).toBeLessThanOrEqual(4);
  const firstRowProductions = new Set(requestedProductions(capture));

  await cards.first().click();
  await expect(page).toHaveURL(/\/movie\/9000$/);
  await waitForRequestQuiet(page, capture);
  const requestsBeforeBack = capture.records.length;
  await page.goBack();
  await expect(page).toHaveURL(/\/actor\/999$/);
  await expect(page.getByAltText("Actor role 0 – Actor film 0", { exact: true })).toHaveAttribute(
    "src",
    portraitUrl,
  );
  await waitForRequestQuiet(page, capture);
  const requestedOnReturn = capture.records
    .slice(requestsBeforeBack)
    .flatMap((record) => record.productions);
  expect(requestedOnReturn.filter((production) => firstRowProductions.has(production))).toEqual([]);

  await filmography.locator("nav button").last().click();
  await expect(page).toHaveURL(/filmographyPage=2/);
  await expect(cards).toHaveCount(1);
  await expect(cards).toHaveAttribute("href", /\/movie\/9012$/);
  await filmography
    .getByRole("heading")
    .evaluate((element) => element.scrollIntoView({ block: "start" }));
  await expect.poll(() => requestedProductions(capture)).toContain("movie:9012");
  await waitForRequestQuiet(page, capture);
  expect(capture.maxInFlight).toBeLessThanOrEqual(4);
  const completed = capture.records
    .filter((record) => record.status === "finished")
    .flatMap((record) => record.productions);
  expect(new Set(completed).size).toBe(completed.length);
  await expectNoHorizontalOverflow(page);
});
