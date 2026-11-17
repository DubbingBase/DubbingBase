import { expect, test, type Locator, type Page, type Request } from "@playwright/test";

type RequestRecord = {
  items: string[];
  started: number;
  finished: number;
  skippedSources: string | null;
  status: "intercepted" | "finished" | "failed";
  failure: string | null;
  url: string;
};

type RequestCapture = {
  records: RequestRecord[];
  byRequest: Map<Request, RequestRecord>;
  inFlight: number;
  maxInFlight: number;
};

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
    record.failure = request.failure()?.errorText ?? null;
  });

  await page.route("**/api/character-images**", async (route) => {
    const url = new URL(route.request().url());
    const request = route.request();
    const record: RequestRecord = {
      items: url.searchParams.getAll("item").flatMap((value) => value.split(",")),
      started: Date.now(),
      finished: 0,
      skippedSources: url.searchParams.get("skip"),
      status: "intercepted",
      failure: null,
      url: request.url(),
    };
    capture.records.push(record);
    capture.byRequest.set(request, record);
    capture.inFlight += 1;
    capture.maxInFlight = Math.max(capture.maxInFlight, capture.inFlight);
    await new Promise((resolve) => setTimeout(resolve, 300));

    const portraitKey = record.items.find((item) => item === "movie:2012:Character 2012");
    const useWikimediaFallback =
      options.failTvdbPortrait && portraitKey && record.skippedSources === "tvdb";
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        images: portraitKey
          ? {
              [portraitKey]: {
                src:
                  options.failTvdbPortrait && !useWikimediaFallback
                    ? "data:image/svg+xml,not-an-image"
                    : "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1 1'%3E%3Crect width='1' height='1' fill='teal'/%3E%3C/svg%3E",
                source: useWikimediaFallback ? "wikimedia" : "tvdb",
                ...(useWikimediaFallback ? { attribution: "Mock Wikimedia attribution" } : {}),
              },
            }
          : {},
        characterIds: {},
        tvdbIds: {},
      }),
    });
    record.finished = Date.now();
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

function requestedItems(capture: RequestCapture): string[] {
  return capture.records.flatMap((record) => record.items);
}

function duplicateItems(capture: RequestCapture): string[] {
  const items = requestedItems(capture);
  return items.filter((item, index) => items.indexOf(item) !== index);
}

async function expectItemsWithinViewportMargin(
  items: string[],
  groups: Locator,
  margin = 400,
): Promise<void> {
  const mediaIds = await groups.evaluateAll((elements, viewportMargin) => {
    const ids = new Set<string>();
    for (const group of elements) {
      const bounds = group.getBoundingClientRect();
      if (bounds.bottom < -viewportMargin || bounds.top > window.innerHeight + viewportMargin) {
        continue;
      }
      for (const link of group.querySelectorAll("a[href*='/movie/']")) {
        const match = link.getAttribute("href")?.match(/\/movie\/(\d+)(?:\/|$)/);
        if (match?.[1]) ids.add(match[1]);
      }
    }
    return [...ids];
  }, margin);
  const nearbyIds = new Set(mediaIds);
  expect(items.every((item) => nearbyIds.has(item.split(":", 3)[1] ?? ""))).toBe(true);
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

test("loads voice-actor character images as grouped cards enter the viewport", async ({ page }) => {
  test.setTimeout(120000);
  const capture = await installCharacterImageMock(page);
  const hydrationWarnings: string[] = [];
  page.on("console", (message) => {
    if (
      (message.type() === "warning" || message.type() === "error") &&
      message.text().includes("Hydration")
    ) {
      hydrationWarnings.push(message.text());
    }
  });

  for (const viewport of [
    { name: "desktop", width: 1280, height: 900 },
    { name: "mobile", width: 390, height: 844 },
  ]) {
    resetCapture(capture);
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    const response = await page.goto("/voice-actor/999", { waitUntil: "domcontentloaded" });
    expect(response?.status()).toBe(200);
    await page.waitForFunction(() => {
      const root = document.querySelector("#__nuxt");
      return root !== null && Reflect.get(root, "__vue_app__") !== undefined;
    });
    const html = await response?.text();
    expect(html).toContain("Film 2012");
    expect(html?.replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, "")).not.toContain(
      "data-character-image-source",
    );

    const filmography = page.locator("#voice-actor-works-results");
    const groups = filmography.getByTestId("voice-actor-group");
    await expect(groups).toHaveCount(12);
    await waitForRequestQuiet(page, capture);
    const topCount = capture.records.length;
    const topItems = requestedItems(capture);
    expect(topCount).toBeLessThan(22);
    await expectItemsWithinViewportMargin(topItems, groups);
    await groups
      .nth(0)
      .locator("a[href*='/actor/3']")
      .evaluate((element) => element.scrollIntoView({ block: "start" }));
    await expect.poll(() => capture.records.length, { timeout: 15000 }).toBeGreaterThan(0);
    await waitForRequestQuiet(page, capture);
    const afterFirstGroupCount = capture.records.length;
    const afterFirstGroupItems = requestedItems(capture).slice(topItems.length);
    expect(afterFirstGroupCount).toBeLessThan(22);
    await expectItemsWithinViewportMargin(afterFirstGroupItems, groups);
    const initialLayout = await filmography.evaluate((element) => ({
      height: element.getBoundingClientRect().height,
      top: element.getBoundingClientRect().top,
    }));
    await page.screenshot({
      path: `/tmp/db-56365-148-evidence/after-${viewport.name}.png`,
    });

    const groupCounts: number[] = [];
    for (let index = 1; index < (await groups.count()); index += 1) {
      const previousItemCount = requestedItems(capture).length;
      await groups.nth(index).evaluate((element) => element.scrollIntoView({ block: "start" }));
      await waitForRequestQuiet(page, capture);
      groupCounts.push(capture.records.length);
      const newItems = requestedItems(capture).slice(previousItemCount);
      await expectItemsWithinViewportMargin(newItems, groups);
    }

    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await waitForRequestQuiet(page, capture);
    const afterFastScrollCount = capture.records.length;
    await expect.poll(() => capture.inFlight, { timeout: 10000 }).toBe(0);

    const allKeys = requestedItems(capture);
    const eligibleCardCount = await groups.locator("a[href*='/movie/']").count();
    const finalLayout = await filmography.evaluate((element) => ({
      height: element.getBoundingClientRect().height,
      top: element.getBoundingClientRect().top,
    }));

    console.info(JSON.stringify({ viewport: viewport.name, capture: capture.records }));
    expect(duplicateItems(capture)).toEqual([]);
    expect(new Set(allKeys).size).toBe(22);
    expect(eligibleCardCount).toBe(22);
    expect(capture.maxInFlight).toBeLessThanOrEqual(4);
    expect(Math.abs(finalLayout.height - initialLayout.height)).toBeLessThan(1);
    await expectNoHorizontalOverflow(page);
    expect(hydrationWarnings).toEqual([]);

    console.info(
      JSON.stringify({
        viewport: viewport.name,
        topCount,
        afterFirstGroupCount,
        sequentialGroupCounts: groupCounts,
        afterFastScrollCount,
        requestCount: capture.records.length,
        uniqueRequestItems: new Set(allKeys).size,
        duplicateItems: duplicateItems(capture),
        eligibleCardCount,
        maxInFlight: capture.maxInFlight,
        overflowPx: 0,
        heightDelta: finalLayout.height - initialLayout.height,
        requests: capture.records.map(({ items }) => items),
      }),
    );
  }
});

test("keeps character image requests scoped to their visible production and pagination", async ({
  page,
}) => {
  test.setTimeout(120000);
  const capture = await installCharacterImageMock(page);

  const response = await page.goto("/voice-actor/999", { waitUntil: "domcontentloaded" });
  expect(response?.status()).toBe(200);
  await page.waitForFunction(() => {
    const root = document.querySelector("#__nuxt");
    return root !== null && Reflect.get(root, "__vue_app__") !== undefined;
  });
  const filmography = page.locator("#voice-actor-works-results");
  const groups = filmography.getByTestId("voice-actor-group");
  const harrisonGroup = groups.filter({ hasText: "Harrison Ford" });
  await expect(harrisonGroup).toHaveCount(1);
  await harrisonGroup.evaluate((element) => element.scrollIntoView({ block: "start" }));
  await expect.poll(() => capture.records.length, { timeout: 15000 }).toBeGreaterThan(0);
  await waitForRequestQuiet(page, capture);
  await expect(page.locator('img[data-character-image-source="tvdb"]').first()).toHaveAttribute(
    "src",
    /^data:image\/svg\+xml/,
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

  console.info(JSON.stringify({ paginationRequests: capture.records }));
  expect(capture.records.every((record) => record.status === "finished")).toBe(true);
  expect(duplicateItems(capture)).toEqual([]);

  for (const production of [
    { path: "/movie/85", keyPrefix: "movie:85:" },
    { path: "/show/1396", keyPrefix: "tv:1396:" },
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

    const items = requestedItems(capture);
    expect(capture.records).toHaveLength(1);
    expect(items.length).toBeGreaterThan(0);
    expect(items.every((item) => item.startsWith(production.keyPrefix))).toBe(true);
    expect(new Set(items).size).toBe(items.length);
    expect(duplicateItems(capture)).toEqual([]);
    await expectNoHorizontalOverflow(page);
    console.info(
      JSON.stringify({
        route: production.path,
        requestCount: capture.records.length,
        items,
        productionKeys: [...new Set(items.map((item) => item.split(":", 2).join(":")))],
      }),
    );
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

    const items = requestedItems(capture);
    expect(items.length).toBeGreaterThan(0);
    expect(duplicateItems(capture)).toEqual([]);
    expect(
      capture.records.every(
        (record) => new Set(record.items.map((item) => item.split(":", 2).join(":"))).size === 1,
      ),
    ).toBe(true);
    await expectNoHorizontalOverflow(page);
    console.info(JSON.stringify({ route: route.path, items }));
  }
});

test("falls back to a mocked Wikimedia portrait after a TVDB image error", async ({ page }) => {
  test.setTimeout(60000);
  const capture = await installCharacterImageMock(page, { failTvdbPortrait: true });

  const response = await page.goto("/voice-actor/999", { waitUntil: "domcontentloaded" });
  expect(response?.status()).toBe(200);
  await page.waitForFunction(() => {
    const root = document.querySelector("#__nuxt");
    return root !== null && Reflect.get(root, "__vue_app__") !== undefined;
  });

  const harrisonGroup = page
    .locator("#voice-actor-works-results")
    .getByTestId("voice-actor-group")
    .filter({ hasText: "Harrison Ford" });
  await expect(harrisonGroup).toHaveCount(1);
  await harrisonGroup.evaluate((element) => element.scrollIntoView({ block: "start" }));

  await expect
    .poll(
      () =>
        capture.records.some(
          (record) =>
            record.items.includes("movie:2012:Character 2012") && record.skippedSources === "tvdb",
        ),
      { timeout: 15000 },
    )
    .toBe(true);

  const portrait = page.locator('img[data-character-image-source="wikimedia"]');
  await expect(portrait.first()).toHaveAttribute("src", /^data:image\/svg\+xml/);
  await expect(portrait.first()).toHaveAttribute("title", "Mock Wikimedia attribution");
  await expect(harrisonGroup.locator("a[href*='/movie/2012']")).toHaveCount(1);

  const portraitAttempts = capture.records.filter((record) =>
    record.items.includes("movie:2012:Character 2012"),
  );
  expect(portraitAttempts.map((record) => record.skippedSources)).toEqual([null, "tvdb"]);
});

test("loads only current actor filmography cards across pagination", async ({ page }) => {
  test.setTimeout(60000);
  const capture = await installCharacterImageMock(page);
  await page.goto("/actor/999", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => {
    const root = document.querySelector("#__nuxt");
    return root !== null && Reflect.get(root, "__vue_app__") !== undefined;
  });
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
  expect(requestedItems(capture)).not.toContain("movie:9012:Actor role 12");

  await filmography.locator("nav button").last().click();
  await expect(page).toHaveURL(/filmographyPage=2/);
  await expect(cards).toHaveCount(1);
  await expect(cards).toHaveAttribute("href", /\/movie\/9012$/);
  await filmography
    .getByRole("heading")
    .evaluate((element) => element.scrollIntoView({ block: "start" }));
  await expect.poll(() => requestedItems(capture)).toContain("movie:9012:Actor role 12");
  await waitForRequestQuiet(page, capture);
  expect(capture.maxInFlight).toBeLessThanOrEqual(4);
  expect(duplicateItems(capture)).toEqual([]);
  await expectNoHorizontalOverflow(page);
});
