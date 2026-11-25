import { mount } from "@vue/test-utils";
import { registerEndpoint } from "@nuxt/test-utils/runtime";
import { renderToString } from "@vue/server-renderer";
import { createError, getQuery } from "h3";
import { createSSRApp, defineComponent, h, nextTick, ref } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  characterImageKey,
  resetSharedCharacterImages,
  useCharacterImages,
} from "./useCharacterImages";

const { mockLocale } = vi.hoisted(() => ({
  mockLocale: { value: "en", set: (_value: string) => {} },
}));
vi.mock("vue-i18n", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useI18n: () => {
    const locale = ref(mockLocale.value);
    mockLocale.set = (value: string) => {
      locale.value = value;
      mockLocale.value = value;
    };
    return { locale };
  },
}));

// Casts are queued per test; the endpoint records each request's query string.
type Pending = { respond: () => unknown | Promise<unknown> };
type Roster = {
  tvdbId?: number | null;
  characters?: Array<{ id: string; name: string; image: string | null }>;
  degraded?: boolean;
};
// TVDB casts: one queued answer per production request.
const rosterQueue: Pending[] = [];
const rosterQueries: Array<Record<string, unknown>> = [];
registerEndpoint("/api/character-portraits", async (event) => {
  rosterQueries.push(getQuery(event));
  const next = rosterQueue.shift();
  if (!next) throw createError({ statusCode: 500 });
  return await next.respond();
});
const castOf = (roster: Roster = {}) => ({
  tvdbId: null,
  characters: [],
  degraded: false,
  ...roster,
});
const replyRoster = (roster: Roster = {}) => rosterQueue.push({ respond: () => castOf(roster) });
const RON = { id: "55", name: "Ron Weasley", image: "https://t/ron.jpg" };
const HERMIONE = { id: "56", name: "Hermione Granger", image: "https://t/hermione.jpg" };
type Request = Parameters<typeof characterImageKey>[0];
const unmounts: Array<() => void> = [];
const ron = (mediaId: number): Request => ({ mediaType: "movie", mediaId, names: ["Ron Weasley"] });
const key = (mediaId: number) => `movie:${mediaId}:Ron Weasley`;
const hermione = (mediaId: number): Request => ({
  mediaType: "movie",
  mediaId,
  names: ["Hermione Granger"],
});

function setup(initial: Request[], options?: Parameters<typeof useCharacterImages>[1]) {
  const requests = ref<Request[]>(initial);
  let api!: ReturnType<typeof useCharacterImages>;
  const wrapper = mount(
    defineComponent({
      setup() {
        api = useCharacterImages(requests, options);
        return () => h("div");
      },
    }),
  );
  unmounts.push(() => wrapper.unmount());
  return { requests, api };
}

// In-memory endpoint calls need a few macrotasks to settle.
const flushPromises = () => new Promise<void>((resolve) => setTimeout(resolve, 60));

afterEach(() => {
  resetSharedCharacterImages();
  for (const unmount of unmounts) unmount();
  unmounts.length = 0;
});

beforeEach(() => {
  rosterQueue.length = 0;
  rosterQueries.length = 0;
  mockLocale.set("en");
});

describe("useCharacterImages", () => {
  it("builds a stable key and ignores cards without a role name", () => {
    expect(characterImageKey(ron(671))).toBe(key(671));
    expect(characterImageKey({ mediaType: "tv", mediaId: 1, names: [null, " "] })).toBeNull();
    expect(characterImageKey({ ...ron(0), mediaId: "" })).toBeNull();
  });

  it("does not request provider data during server rendering", async () => {
    const app = createSSRApp(
      defineComponent({
        setup() {
          useCharacterImages(ref([ron(671)]));
          return () => h("div");
        },
      }),
    );

    await renderToString(app);
    expect(rosterQueries).toHaveLength(0);
  });

  it("matches visible cards against one cast request per production", async () => {
    replyRoster({ tvdbId: 9, characters: [RON, HERMIONE] });
    const { requests, api } = setup([ron(671), hermione(671)]);
    await flushPromises();

    expect(rosterQueries).toEqual([{ mediaType: "movie", mediaId: "671", lang: "en-US" }]);
    expect(api.imageFor(ron(671))?.src).toBe("https://t/ron.jpg");
    expect(api.imageFor(ron(671))?.source).toBe("tvdb");
    expect(api.imageFor(hermione(671))?.src).toBe("https://t/hermione.jpg");
    expect(api.characterIdFor(ron(671))).toBe("55");
    expect(api.tvdbIds.value).toEqual({ "movie:671": 9 });

    // Paging or filtering inside the production needs no request at all.
    requests.value = [{ mediaType: "movie", mediaId: 671, names: ["Hermione"] }];
    await nextTick();
    await flushPromises();
    expect(rosterQueries).toHaveLength(1);
  });

  it("uses the same cast request for cards that become visible while it is in flight", async () => {
    let resolveCast!: (value: unknown) => void;
    rosterQueue.push({ respond: () => new Promise((resolve) => (resolveCast = resolve)) });
    const { requests, api } = setup([ron(671)]);
    await flushPromises();
    requests.value = [ron(671), hermione(671)];
    await nextTick();
    await flushPromises();
    resolveCast(castOf({ characters: [RON, HERMIONE] }));
    await flushPromises();

    expect(rosterQueries).toHaveLength(1);
    expect(api.imageFor(ron(671))?.src).toBe("https://t/ron.jpg");
    expect(api.imageFor(hermione(671))?.src).toBe("https://t/hermione.jpg");
  });

  it("sends one cast request per production", async () => {
    replyRoster();
    replyRoster();
    setup([ron(671), ron(672)]);
    await flushPromises();
    expect(rosterQueries.map((query) => query.mediaId)).toEqual(["671", "672"]);
  });

  it("loads the leading portrait promptly and batches two filmography rows into four requests", async () => {
    const films = [674, 672, 671, 673, 675, 679, 677, 676, 678, 680];
    const cast = castOf({ characters: [RON, HERMIONE] });
    const batch = (ids: number[]) => Object.fromEntries(ids.map((id) => [`movie:${id}`, cast]));
    const { promise: slowResponse, resolve: releaseBatch } = Promise.withResolvers<unknown>();
    rosterQueue.push(
      { respond: () => cast },
      { respond: () => slowResponse },
      { respond: () => batch(films.slice(5, 9)) },
      { respond: () => cast },
    );
    const options = { batchProductions: true };
    const { requests, api } = setup(films.slice(0, 5).map(ron), options);
    await flushPromises();
    expect(api.imageFor(ron(674))?.src).toBe(RON.image);
    expect(api.imageFor(ron(675))).toBeNull();
    releaseBatch(batch(films.slice(1, 5)));
    requests.value = films.map(ron);
    await flushPromises();

    expect(rosterQueries).toEqual([
      { mediaType: "movie", mediaId: "674", lang: "en-US" },
      { productions: "movie:671,movie:672,movie:673,movie:675", lang: "en-US" },
      { productions: "movie:676,movie:677,movie:678,movie:679", lang: "en-US" },
      { mediaType: "movie", mediaId: "680", lang: "en-US" },
    ]);
    for (const id of films) expect(api.imageFor(ron(id))?.src).toBe(RON.image);

    unmounts.pop()?.();
    const revisited = setup(films.map(hermione), options);
    await flushPromises();
    for (const id of films) expect(revisited.api.imageFor(hermione(id))?.src).toBe(HERMIONE.image);
    expect(rosterQueries).toHaveLength(4);
  });

  it("keeps healthy casts when a different production in the batch fails", async () => {
    replyRoster();
    rosterQueue.push({
      respond: () => ({
        "movie:671": castOf({ characters: [RON] }),
        "movie:672": castOf({ degraded: true }),
      }),
    });
    const { requests, api } = setup([ron(670), ron(671), ron(672)], { batchProductions: true });
    await flushPromises();
    expect(api.imageFor(ron(671))?.src).toBe(RON.image);
    expect(api.imageFor(ron(672))).toBeNull();

    requests.value = [];
    await nextTick();
    replyRoster({ characters: [RON] });
    requests.value = [ron(671), ron(672)];
    await flushPromises();
    expect(rosterQueries).toEqual([
      { mediaType: "movie", mediaId: "670", lang: "en-US" },
      { productions: "movie:671,movie:672", lang: "en-US" },
      { mediaType: "movie", mediaId: "672", lang: "en-US" },
    ]);
    expect(api.imageFor(ron(672))?.src).toBe(RON.image);
  });

  it("limits concurrent cast requests and queues the remaining productions", async () => {
    const resolvers: Array<(value: unknown) => void> = [];
    for (let index = 0; index < 6; index += 1) {
      rosterQueue.push({ respond: () => new Promise((resolve) => resolvers.push(resolve)) });
    }
    setup(Array.from({ length: 6 }, (_, index) => ron(671 + index)));
    await flushPromises();

    expect(rosterQueries).toHaveLength(4);
    resolvers[0]?.(castOf());
    await flushPromises();
    expect(rosterQueries).toHaveLength(5);
  });

  it("shows the placeholder, but keeps the character page, for a role TVDB has no image for", async () => {
    replyRoster({ characters: [{ id: "56", name: "Hermione Granger", image: null }] });
    const { api } = setup([hermione(671)]);
    await flushPromises();
    expect(api.imageFor(hermione(671))).toBeNull();
    expect(api.characterIdFor(hermione(671))).toBe("56");
  });

  it("shows the placeholder when the browser cannot load a portrait, and does not remember it", async () => {
    replyRoster({ characters: [RON] });
    const first = setup([ron(671)]);
    await flushPromises();
    first.api.reportImageError(ron(671));
    expect(first.api.imageFor(ron(671))).toBeNull();
    unmounts.pop()?.();

    // The cast is remembered, so the next page matches it again without a request.
    const second = setup([ron(671)]);
    await flushPromises();
    expect(rosterQueries).toHaveLength(1);
    expect(second.api.imageFor(ron(671))?.src).toBe("https://t/ron.jpg");
  });

  it("keeps the placeholder on provider failure and retries when the card is shown again", async () => {
    const { requests, api } = setup([ron(671)]);
    await flushPromises();
    expect(rosterQueries.length).toBeGreaterThan(0);
    expect(api.imageFor(ron(671))).toBeNull();

    replyRoster({ characters: [RON] });
    requests.value = [];
    await nextTick();
    requests.value = [ron(671)];
    await nextTick();
    await flushPromises();
    expect(api.imageFor(ron(671))?.src).toBe("https://t/ron.jpg");
  });

  it("does not trust a degraded cast: no shared cast and a retry when shown again", async () => {
    replyRoster({ degraded: true });
    const { requests, api } = setup([ron(671)]);
    await flushPromises();
    expect(api.imageFor(ron(671))).toBeNull();

    replyRoster({ characters: [RON] });
    requests.value = [];
    await nextTick();
    requests.value = [ron(671)];
    await nextTick();
    await flushPromises();
    expect(rosterQueries).toHaveLength(2);
    expect(api.imageFor(ron(671))?.src).toBe("https://t/ron.jpg");
  });

  it("reloads in the selected locale and clears locale-specific card metadata", async () => {
    replyRoster({ tvdbId: 9, characters: [RON] });
    const { api } = setup([ron(671)]);
    await flushPromises();
    expect(api.characterIdFor(ron(671))).toBe("55");

    replyRoster({
      tvdbId: 10,
      characters: [{ id: "56", name: "Ron Weasley", image: "https://t/fr.jpg" }],
    });
    mockLocale.set("fr");
    await nextTick();
    await flushPromises();

    expect(rosterQueries[1]).toMatchObject({ lang: "fr-FR", mediaId: "671" });
    expect(api.imageFor(ron(671))?.src).toBe("https://t/fr.jpg");
    expect(api.characterIdFor(ron(671))).toBe("56");
    expect(api.tvdbIds.value).toEqual({ "movie:671": 10 });
  });

  it("ignores a stale cast response after a locale reload", async () => {
    let resolveOld!: (value: unknown) => void;
    rosterQueue.push({ respond: () => new Promise((resolve) => (resolveOld = resolve)) });
    const { api } = setup([ron(671)]);
    await flushPromises();

    replyRoster({
      tvdbId: 10,
      characters: [{ id: "56", name: "Ron Weasley", image: "https://t/fr.jpg" }],
    });
    mockLocale.set("fr");
    await nextTick();
    await flushPromises();
    resolveOld(
      castOf({ tvdbId: 9, characters: [{ ...RON, id: "stale", image: "https://t/s.jpg" }] }),
    );
    await flushPromises();

    expect(api.imageFor(ron(671))?.src).toBe("https://t/fr.jpg");
    expect(api.characterIdFor(ron(671))).toBe("56");
    expect(api.tvdbIds.value).toEqual({ "movie:671": 10 });
  });

  it("keeps resolved cards when they leave and return, without asking again", async () => {
    replyRoster({ tvdbId: 9, characters: [RON] });
    const { requests, api } = setup([ron(671)]);
    await flushPromises();

    requests.value = [];
    await nextTick();
    requests.value = [ron(671)];
    await nextTick();
    await flushPromises();

    expect(rosterQueries).toHaveLength(1);
    expect(api.imageFor(ron(671))?.src).toBe("https://t/ron.jpg");
    expect(api.characterIdFor(ron(671))).toBe("55");
  });

  it("shows portraits resolved on a previous page immediately, without asking again", async () => {
    replyRoster({ tvdbId: 66, characters: [RON, HERMIONE] });
    const first = setup([ron(671)]);
    await flushPromises();
    expect(first.api.imageFor(ron(671))?.src).toBe("https://t/ron.jpg");
    unmounts.pop()?.();

    // Back to the page: a new instance seeds from the shared store after mount,
    // and a card it never showed is matched against the remembered cast.
    const second = setup([ron(671), hermione(671)]);
    await nextTick();
    expect(second.api.imageFor(ron(671))?.src).toBe("https://t/ron.jpg");
    expect(second.api.characterIdFor(ron(671))).toBe("55");
    expect(second.api.tvdbIds.value["movie:671"]).toBe(66);
    await flushPromises();
    expect(second.api.imageFor(hermione(671))?.src).toBe("https://t/hermione.jpg");
    expect(rosterQueries).toHaveLength(1);
  });

  it("remembers a server answer of no image for a few minutes, then asks again", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    replyRoster({ characters: [] });
    setup([ron(671)]);
    await flushPromises();
    const calls = rosterQueries.length;
    unmounts.pop()?.();

    setup([ron(671)]);
    await flushPromises();
    expect(rosterQueries.length).toBe(calls);
    unmounts.pop()?.();

    vi.setSystemTime(Date.now() + 6 * 60 * 1000);
    resetSharedCharacterImages();
    replyRoster({ characters: [] });
    setup([ron(671)]);
    await flushPromises();
    expect(rosterQueries.length).toBe(calls + 1);
    vi.useRealTimers();
  });
});
