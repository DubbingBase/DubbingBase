import { mount } from "@vue/test-utils";
import { registerEndpoint } from "@nuxt/test-utils/runtime";
import { createError, getQuery } from "h3";
import { defineComponent, h, nextTick, ref } from "vue";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { characterImageKey, useCharacterImages } from "./useCharacterImages";

vi.mock("vue-i18n", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useI18n: () => ({ locale: ref("en") }),
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
const ron = (mediaId: number): Request => ({ mediaType: "movie", mediaId, names: ["Ron Weasley"] });
const key = (mediaId: number) => `movie:${mediaId}:Ron Weasley`;
const tvdb = (src: string) => ({ src, source: "tvdb" });

function setup(initial: Request[]) {
  const requests = ref<Request[]>(initial);
  let api!: ReturnType<typeof useCharacterImages>;
  mount(
    defineComponent({
      setup() {
        api = useCharacterImages(requests);
        return () => h("div");
      },
    }),
  );
  return { requests, api };
}

// In-memory endpoint calls need a few macrotasks to settle.
const flushPromises = () => new Promise<void>((resolve) => setTimeout(resolve, 60));

beforeEach(() => {
  queue.length = 0;
  queries.length = 0;
});

describe("useCharacterImages", () => {
  it("builds a stable key and ignores cards without a role name", () => {
    expect(characterImageKey(ron(671))).toBe(key(671));
    expect(characterImageKey({ mediaType: "tv", mediaId: 1, names: [null, " "] })).toBeNull();
    expect(characterImageKey({ ...ron(0), mediaId: "" })).toBeNull();
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
    expect(queries.length).toBeGreaterThan(0); // ofetch retries a failed GET once
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
});
