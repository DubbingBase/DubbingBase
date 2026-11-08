import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import LanguageBanner from "./LanguageBanner.vue";

const setBrowserLanguages = (languages: string[]) => {
  vi.spyOn(navigator, "languages", "get").mockReturnValue(languages);
};

const clearPreferenceCookie = () => {
  document.cookie = "user_lang=; path=/; max-age=0";
};

// Node's own experimental `localStorage` getter can shadow the DOM one in the test runtime.
const createMemoryStorage = (): Storage => {
  const items = new Map<string, string>();
  return {
    get length() {
      return items.size;
    },
    clear: () => items.clear(),
    getItem: (key) => items.get(key) ?? null,
    key: (index) => [...items.keys()][index] ?? null,
    removeItem: (key) => void items.delete(key),
    setItem: (key, value) => void items.set(key, String(value)),
  };
};

describe("LanguageBanner dismissal", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", createMemoryStorage());
    vi.stubGlobal("sessionStorage", createMemoryStorage());
    clearPreferenceCookie();
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("shows nothing when the preferred locale matches the page locale", async () => {
    setBrowserLanguages(["en-US"]);
    const wrapper = await mountSuspended(LanguageBanner);
    expect(wrapper.find("button").exists()).toBe(false);
  });

  it("persists dismissal in localStorage without writing the language cookie", async () => {
    setBrowserLanguages(["fr-FR"]);
    const first = await mountSuspended(LanguageBanner);
    expect(first.find("button[aria-label=Dismiss]").exists()).toBe(true);

    await first.get("button[aria-label=Dismiss]").trigger("click");
    expect(first.find("button[aria-label=Dismiss]").exists()).toBe(false);
    expect(localStorage.getItem("lang_banner_dismissed:fr")).toBe("true");
    expect(document.cookie).not.toContain("user_lang");

    const second = await mountSuspended(LanguageBanner);
    expect(second.find("button[aria-label=Dismiss]").exists()).toBe(false);
  });

  it("suggests a different newly preferred locale after a dismissal", async () => {
    localStorage.setItem("lang_banner_dismissed:fr", "true");
    setBrowserLanguages(["es-ES"]);
    const wrapper = await mountSuspended(LanguageBanner);
    expect(wrapper.find("button[aria-label=Dismiss]").exists()).toBe(true);
  });
});
