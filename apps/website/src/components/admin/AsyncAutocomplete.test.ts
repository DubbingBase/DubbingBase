import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mockNuxtImport, mountSuspended } from "@nuxt/test-utils/runtime";
import AsyncAutocomplete from "./AsyncAutocomplete.vue";
import { nextTick } from "vue";

const localeMessages: Record<string, string> = {
  "common.searching": "Searching...",
  "search.noResults": "No results found.",
  "common.create": 'Create "{name}"',
};

const tMock = (key: string, params?: Record<string, string>) => {
  let msg = localeMessages[key] || key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      msg = msg.replace(`{${k}}`, v);
    }
  }
  return msg;
};

mockNuxtImport("useI18n", () => () => ({
  t: tMock,
  te: (key: string) => !!localeMessages[key],
  locale: { value: "en" },
}));

describe("AsyncAutocomplete.vue", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const globalOptions = {
    global: {
      mocks: { $t: tMock },
    },
  };

  const defaultProps = {
    modelValue: null,
    options: [],
    displayFn: (val: any) => `Display for ${val}`,
  };

  it("renders correctly with placeholder", async () => {
    const wrapper = await mountSuspended(AsyncAutocomplete, {
      ...globalOptions,
      props: {
        ...defaultProps,
        placeholder: "Search here...",
      },
    });

    const input = wrapper.find("input");
    expect(input.exists()).toBe(true);
    expect(input.attributes("placeholder")).toBe("Search here...");
  });

  it("emits search event when user types (debounced)", async () => {
    const wrapper = await mountSuspended(AsyncAutocomplete, {
      ...globalOptions,
      props: defaultProps,
    });

    const input = wrapper.find("input");
    await input.setValue("test search");

    // Advance timers by the debounce amount (300ms)
    vi.advanceTimersByTime(300);
    await nextTick();

    expect(wrapper.emitted("search")).toBeTruthy();
    expect(wrapper.emitted("search")?.[0]).toEqual(["test search"]);
  });

  it("displays loading state correctly", async () => {
    const wrapper = await mountSuspended(AsyncAutocomplete, {
      ...globalOptions,
      props: {
        ...defaultProps,
        loading: true,
      },
    });

    // Reka UI's combobox portal needs to be open to see the 'Searching...' text
    const input = wrapper.find("input");
    await input.trigger("focus"); // Opens combobox portal
    await nextTick();

    // The portal is typically appended to the body, but mountSuspended can sometimes keep it inside if using specific Reka options.
    // If not, we might need to search the document body.
    // Wait, the SVG loader is in the anchor:
    const svg = wrapper.find("svg.animate-spin");
    expect(svg.exists()).toBe(true);
  });

  it("shows no results found when empty", async () => {
    const wrapper = await mountSuspended(AsyncAutocomplete, {
      ...globalOptions,
      props: defaultProps,
    });

    const input = wrapper.find("input");
    await input.trigger("focus");
    await nextTick();

    const bodyText = document.body.textContent || "";
    expect(bodyText).toContain("No results found.");
  });

  it("displays options using displayFn", async () => {
    const options = [{ id: 1 }, { id: 2 }];
    const wrapper = await mountSuspended(AsyncAutocomplete, {
      ...globalOptions,
      props: {
        ...defaultProps,
        options,
        displayFn: (val: any) => `Item ${val}`,
      },
    });

    const input = wrapper.find("input");
    await input.trigger("focus");
    await nextTick();

    const bodyText = document.body.textContent || "";
    expect(bodyText).toContain("Item 1");
    expect(bodyText).toContain("Item 2");
  });

  it("emits update:modelValue when clearing selection", async () => {
    const wrapper = await mountSuspended(AsyncAutocomplete, {
      ...globalOptions,
      props: {
        ...defaultProps,
        modelValue: 1,
      },
    });

    const clearBtn = wrapper.find("button"); // The X button
    expect(clearBtn.exists()).toBe(true);

    await clearBtn.trigger("click");

    expect(wrapper.emitted("update:modelValue")).toBeTruthy();
    expect(wrapper.emitted("update:modelValue")?.[0]).toEqual([null]);
  });

  it("shows create button when allowCreate is true and search term >= 2", async () => {
    const wrapper = await mountSuspended(AsyncAutocomplete, {
      ...globalOptions,
      props: {
        ...defaultProps,
        allowCreate: true,
      },
    });

    const input = wrapper.find("input");
    await input.setValue("new item");
    await input.trigger("focus");
    await nextTick();

    const bodyText = document.body.textContent || "";
    expect(bodyText).toContain('Create "new item"');
  });

  it("hides create button when an item is selected and search term matches its display value", async () => {
    const wrapper = await mountSuspended(AsyncAutocomplete, {
      ...globalOptions,
      props: {
        ...defaultProps,
        allowCreate: true,
        modelValue: 1, // User has selected item with ID 1
        displayFn: (val: any) => `Item ${val}`, // Which displays as "Item 1"
      },
    });

    const input = wrapper.find("input");
    await input.trigger("focus"); // open combobox
    await nextTick();

    // The search term will sync to "Item 1" (which is >= 2 chars),
    // but because it matches the selected item exactly, the create button should NOT show.
    const bodyText = document.body.textContent || "";
    expect(bodyText).not.toContain('Create "Item 1"');
  });

  it("does not emit search event when selecting an option", async () => {
    const options = [{ id: 1, name: "Item 1" }];
    const wrapper = await mountSuspended(AsyncAutocomplete, {
      ...globalOptions,
      props: {
        ...defaultProps,
        options,
        displayFn: (val: any) => `Item ${val}`,
      },
    });

    const input = wrapper.find("input");
    await input.setValue("Item 1");
    vi.advanceTimersByTime(300);
    await nextTick();

    // It should have emitted search for 'Item 1'
    expect(wrapper.emitted("search")).toBeTruthy();

    const previousSearchCalls = wrapper.emitted("search")?.length || 0;

    await wrapper.setProps({ modelValue: 1 });
    await nextTick();

    vi.advanceTimersByTime(300);
    await nextTick();

    const newSearchCalls = wrapper.emitted("search")?.length || 0;
    expect(newSearchCalls, "Should not emit search after selection").toBe(
      previousSearchCalls,
    );
  });

  it("syncs search term when modelValue is changed externally", async () => {
    const wrapper = await mountSuspended(AsyncAutocomplete, {
      ...globalOptions,
      props: {
        ...defaultProps,
        modelValue: 1,
        displayFn: (val: any) => `Item ${val}`,
      },
    });

    const input = wrapper.find("input");
    // Wait for initial render
    await nextTick();

    // Update modelValue to null
    await wrapper.setProps({ modelValue: null });
    await nextTick();

    // Input should be empty
    expect(input.element.value).toBe("");
  });
});
