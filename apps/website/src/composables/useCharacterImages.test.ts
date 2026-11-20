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

// Responses are queued per test; the endpoint records each request's query string.
type Pending = { respond: () => unknown | Promise<unknown> };
const queue: Pending[] = [];
const queries: Array<Record<string, unknown>> = [];
registerEndpoint("/api/character-images", async (event) => {
  queries.push(getQuery(event));
  const next = queue.shift();
  if (!next) throw createError({ statusCode: 500 });
  return await next.respond();
});
const reply = (
  images: Record<string, unknown>,
  tvdbIds: Record<string, number> = {},
  characterIds: Record<string, string> = {},
) => queue.push({ respond: () => ({ images, characterIds, tvdbIds }) });

type Request = Parameters<typeof characterImageKey>[0];
const unmounts: Array<() => void> = [];
const ron = (mediaId: number): Request => ({ mediaType: "movie", mediaId, names: ["Ron Weasley"] });
const key = (mediaId: number) => `movie:${mediaId}:Ron Weasley`;
const hermione = (mediaId: number): Request => ({
  mediaType: "movie",
  mediaId,
  names: ["Hermione Granger"],
});
const tvdb = (src: string) => ({ src, source: "tvdb" });

function setup(initial: Request[]) {
  const requests = ref<Request[]>(initial);
  let api!: ReturnType<typeof useCharacterImages>;
  const wrapper = mount(
    defineComponent({
      setup() {
        api = useCharacterImages(requests);
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
  queue.length = 0;
  queries.length = 0;
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
    expect(queries).toHaveLength(0);
  });

  it("loads after mount only the visible cards, once per card", async () => {
    reply({ [key(671)]: tvdb("https://t/671.jpg") }, { "movie:671": 9 }, { [key(671)]: "55" });
    const { requests, api } = setup([ron(671)]);
    await flushPromises();

    expect(queries).toHaveLength(1);
    expect(queries[0]).toMatchObject({ item: key(671), lang: "en-US" });
    expect(api.imageFor(ron(671))?.src).toBe("https://t/671.jpg");
    expect(api.tvdbIds.value).toEqual({ "movie:671": 9 });
    expect(api.characterIdFor(ron(671))).toBe("55");

    // Same card again: no new request; a new card (next page): only that one.
    reply({ [key(672)]: null });
    requests.value = [ron(671), ron(672)];
    await nextTick();
    await flushPromises();
    expect(queries).toHaveLength(2);
    expect(queries[1]).toMatchObject({ item: key(672) });
  });

  it("keeps successful and negative results cached when a card leaves and returns", async () => {
    reply({ [key(671)]: tvdb("https://t/671.jpg") });
    reply({ [key(672)]: null });
    const { requests, api } = setup([ron(671), ron(672)]);
    await flushPromises();

    requests.value = [];
    await nextTick();
    requests.value = [ron(671), ron(672)];
    await nextTick();
    await flushPromises();

    expect(queries).toHaveLength(2);
    expect(api.imageFor(ron(671))?.src).toBe("https://t/671.jpg");
    expect(api.imageFor(ron(672))).toBeNull();
  });

  it("sends one request per production so the URL does not depend on neighbours", async () => {
    reply({});
    reply({});
    setup([ron(671), ron(672)]);
    await flushPromises();
    expect(queries.map((query) => query.item)).toEqual([key(671), key(672)]);
  });

  it("limits concurrent production requests and queues the remaining cards", async () => {
    const resolvers: Array<(value: unknown) => void> = [];
    for (let index = 0; index < 6; index += 1) {
      queue.push({ respond: () => new Promise((resolve) => resolvers.push(resolve)) });
    }
    setup(Array.from({ length: 6 }, (_, index) => ron(671 + index)));
    await flushPromises();

    expect(queries).toHaveLength(4);
    resolvers[0]?.({ images: {}, characterIds: {}, tvdbIds: {} });
    await flushPromises();
    expect(queries).toHaveLength(5);
  });

  it("re-requests with the failed source skipped and ends on the placeholder", async () => {
    reply({ [key(671)]: tvdb("https://t/broken.jpg") });
    reply({ [key(671)]: { src: "https://upload.wikimedia.org/a.jpg", source: "wikimedia" } });
    reply({ [key(671)]: null });
    const { api } = setup([ron(671)]);
    await flushPromises();

    api.reportImageError(ron(671));
    await flushPromises();
    expect(queries[1]).toMatchObject({ skip: "tvdb" });
    expect(api.imageFor(ron(671))?.source).toBe("wikimedia");

    api.reportImageError(ron(671));
    await flushPromises();
    expect(queries[2]).toMatchObject({ skip: "tvdb,wikimedia" });
    expect(api.imageFor(ron(671))).toBeNull();
  });

  it("keeps the placeholder on provider failure and retries when the card is shown again", async () => {
    const { requests, api } = setup([ron(671)]);
    await flushPromises();
    expect(queries.length).toBeGreaterThan(0);
    expect(api.imageFor(ron(671))).toBeNull();

    queue.length = 0;
    reply({ [key(671)]: tvdb("https://t/671.jpg") });
    requests.value = [];
    await nextTick();
    requests.value = [ron(671)];
    await nextTick();
    await flushPromises();
    expect(api.imageFor(ron(671))?.src).toBe("https://t/671.jpg");
  });

  it("reloads in the selected locale and clears locale-specific card metadata", async () => {
    reply({ [key(671)]: tvdb("https://t/en.jpg") }, { "movie:671": 9 }, { [key(671)]: "55" });
    const { api } = setup([ron(671)]);
    await flushPromises();
    expect(api.characterIdFor(ron(671))).toBe("55");

    reply({ [key(671)]: tvdb("https://t/fr.jpg") }, { "movie:671": 10 }, { [key(671)]: "56" });
    mockLocale.set("fr");
    await nextTick();
    await flushPromises();

    expect(queries.filter((query) => query.lang === "fr-FR")).toHaveLength(1);
    expect(queries[1]).toMatchObject({ lang: "fr-FR", item: key(671) });
    expect(api.imageFor(ron(671))?.src).toBe("https://t/fr.jpg");
    expect(api.characterIdFor(ron(671))).toBe("56");
    expect(api.tvdbIds.value).toEqual({ "movie:671": 10 });
  });

  it("ignores stale response images and metadata after a locale reload", async () => {
    let resolveOld!: (value: unknown) => void;
    queue.push({ respond: () => new Promise((resolve) => (resolveOld = resolve)) });
    const { requests, api } = setup([ron(671)]);
    await flushPromises();

    reply({ [key(671)]: tvdb("https://t/fr.jpg") }, { "movie:671": 10 }, { [key(671)]: "56" });
    mockLocale.set("fr");
    await nextTick();
    await flushPromises();
    resolveOld({
      images: { [key(671)]: tvdb("https://t/stale.jpg") },
      characterIds: { [key(671)]: "stale" },
      tvdbIds: { "movie:671": 9 },
    });
    await flushPromises();

    requests.value = [];
    await nextTick();
    requests.value = [ron(671)];
    await nextTick();
    await flushPromises();

    expect(queries.filter((query) => query.lang === "fr-FR")).toHaveLength(1);
    expect(api.imageFor(ron(671))?.src).toBe("https://t/fr.jpg");
    expect(api.characterIdFor(ron(671))).toBe("56");
    expect(api.tvdbIds.value).toEqual({ "movie:671": 10 });
  });

  it("keeps completed same-locale images and metadata when a card leaves and returns", async () => {
    let resolvePending!: (value: unknown) => void;
    queue.push({ respond: () => new Promise((resolve) => (resolvePending = resolve)) });
    const { requests, api } = setup([ron(671)]);
    await flushPromises();
    requests.value = [];
    await nextTick();
    resolvePending({
      images: { [key(671)]: tvdb("https://t/671.jpg") },
      characterIds: { [key(671)]: "55" },
      tvdbIds: { "movie:671": 9 },
    });
    await flushPromises();

    requests.value = [ron(671)];
    await nextTick();
    await flushPromises();
    expect(queries).toHaveLength(1);
    expect(api.imageFor(ron(671))?.src).toBe("https://t/671.jpg");
    expect(api.characterIdFor(ron(671))).toBe("55");
    expect(api.tvdbIds.value).toEqual({ "movie:671": 9 });
  });

  it("reuses a completed negative lookup after paging A to B and back to A", async () => {
    let resolveOld!: (value: unknown) => void;
    queue.push({ respond: () => new Promise((resolve) => (resolveOld = resolve)) });
    const { requests, api } = setup([ron(671)]);
    await flushPromises();
    reply({ [key(672)]: tvdb("https://t/672.jpg") }, { "movie:672": 10 }, { [key(672)]: "56" });
    requests.value = [ron(672)];
    await nextTick();
    await flushPromises();

    resolveOld({
      images: { [key(671)]: null },
      characterIds: { [key(671)]: "55" },
      tvdbIds: { "movie:671": 9 },
    });
    await flushPromises();
    expect(api.imageFor(ron(671))).toBeNull();
    expect(api.imageFor(ron(672))?.src).toBe("https://t/672.jpg");

    requests.value = [ron(671)];
    await nextTick();
    await flushPromises();

    expect(queries).toHaveLength(2);
    expect(api.imageFor(ron(671))).toBeNull();
    expect(api.characterIdFor(ron(671))).toBe("55");
    expect(api.tvdbIds.value).toEqual({ "movie:671": 9, "movie:672": 10 });
  });

  it("reuses an in-flight lookup when a card returns before it finishes", async () => {
    let resolvePending!: (value: unknown) => void;
    queue.push({ respond: () => new Promise((resolve) => (resolvePending = resolve)) });
    const { requests, api } = setup([ron(671)]);
    await flushPromises();

    requests.value = [];
    await nextTick();
    requests.value = [ron(671)];
    await nextTick();
    resolvePending({
      images: { [key(671)]: tvdb("https://t/671.jpg") },
      characterIds: { [key(671)]: "55" },
      tvdbIds: { "movie:671": 9 },
    });
    await flushPromises();

    expect(queries).toHaveLength(1);
    expect(api.imageFor(ron(671))?.src).toBe("https://t/671.jpg");
    expect(api.characterIdFor(ron(671))).toBe("55");
  });

  it("clears failed-source history when starting a new locale lookup", async () => {
    reply({ [key(671)]: tvdb("https://t/broken.jpg") });
    reply({ [key(671)]: { src: "https://upload.wikimedia.org/a.jpg", source: "wikimedia" } });
    const { api } = setup([ron(671)]);
    await flushPromises();
    api.reportImageError(ron(671));
    await flushPromises();
    expect(queries[1]).toMatchObject({ skip: "tvdb" });

    reply({ [key(671)]: tvdb("https://t/fr.jpg") });
    mockLocale.set("fr");
    await nextTick();
    await flushPromises();
    expect(queries[2]).toMatchObject({ lang: "fr-FR", item: key(671) });
    expect(queries[2]).not.toHaveProperty("skip");
  });

  it("keeps failed-source history when a fallback request fails and the card is shown again", async () => {
    reply({ [key(671)]: tvdb("https://t/broken.jpg") });
    const { requests, api } = setup([ron(671)]);
    await flushPromises();

    queue.push({ respond: () => Promise.reject(createError({ statusCode: 500 })) });
    api.reportImageError(ron(671));
    await flushPromises();
    expect(queries.at(-1)).toMatchObject({ skip: "tvdb" });

    reply({ [key(671)]: { src: "https://upload.wikimedia.org/a.jpg", source: "wikimedia" } });
    requests.value = [];
    await nextTick();
    requests.value = [ron(671)];
    await nextTick();
    await flushPromises();

    expect(queries.at(-1)).toMatchObject({ item: key(671), skip: "tvdb" });
    expect(api.imageFor(ron(671))?.source).toBe("wikimedia");
  });

  it("keeps fallback histories separate for neighboring roles in one production", async () => {
    reply({ [key(671)]: tvdb("https://t/broken.jpg") });
    const { requests, api } = setup([ron(671)]);
    await flushPromises();

    queue.push({ respond: () => Promise.reject(createError({ statusCode: 500 })) });
    api.reportImageError(ron(671));
    await flushPromises();

    const hermioneRequest = hermione(671);
    const hermioneKey = "movie:671:Hermione Granger";
    reply({ [key(671)]: { src: "https://upload.wikimedia.org/a.jpg", source: "wikimedia" } });
    reply({ [hermioneKey]: tvdb("https://t/hermione.jpg") });
    requests.value = [ron(671), hermioneRequest];
    await nextTick();
    await flushPromises();

    const retryQueries = queries.slice(-2);
    expect(retryQueries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ item: key(671), skip: "tvdb" }),
        expect.objectContaining({ item: hermioneKey }),
      ]),
    );
    expect(retryQueries.find((query) => query.item === hermioneKey)).not.toHaveProperty("skip");
    expect(api.imageFor(hermioneRequest)?.source).toBe("tvdb");
  });

  it("shows portraits resolved on a previous page immediately, without asking again", async () => {
    reply({ [key(671)]: tvdb("https://img/ron.jpg") }, { "movie:671": 66 }, { [key(671)]: "9" });
    const first = setup([ron(671), hermione(671)]);
    await flushPromises();
    expect(first.api.imageFor(ron(671))?.src).toBe("https://img/ron.jpg");
    const callsAfterFirst = queries.length;
    unmounts.pop()?.();

    // Back to the page: a new instance seeds from the shared store after mount.
    const second = setup([ron(671)]);
    await nextTick();
    expect(second.api.imageFor(ron(671))?.src).toBe("https://img/ron.jpg");
    expect(second.api.characterIdFor(ron(671))).toBe("9");
    expect(second.api.tvdbIds.value["movie:671"]).toBe(66);
    await flushPromises();
    expect(queries.length).toBe(callsAfterFirst);
  });

  it("does not keep a portrait that failed to load", async () => {
    reply({ [key(671)]: tvdb("https://img/dead.jpg") });
    const first = setup([ron(671)]);
    await flushPromises();
    reply({ [key(671)]: null });
    first.api.reportImageError(ron(671));
    await flushPromises();
    unmounts.pop()?.();

    reply({ [key(671)]: null });
    const second = setup([ron(671)]);
    await flushPromises();
    expect(second.api.imageFor(ron(671))).toBeNull();
  });
});
