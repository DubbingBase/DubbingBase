import { mount } from "@vue/test-utils";
import { defineComponent, h, ref } from "vue";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useCharacterImageViewport } from "./useCharacterImageViewport";
import type { CharacterImageRequest } from "./useCharacterImages";

const ron: CharacterImageRequest = {
  mediaType: "movie",
  mediaId: 671,
  names: ["Ron Weasley"],
};
const hermione: CharacterImageRequest = {
  mediaType: "movie",
  mediaId: 671,
  names: ["Hermione Granger"],
};
const otherProduction: CharacterImageRequest = {
  mediaType: "movie",
  mediaId: 672,
  names: ["Other Role"],
};

class TestIntersectionObserver implements IntersectionObserver {
  static instance: TestIntersectionObserver | null = null;

  readonly root: Element | Document | null;
  readonly rootMargin: string;
  readonly thresholds: readonly number[];
  readonly observed = new Set<Element>();

  constructor(
    private readonly callback: IntersectionObserverCallback,
    options: IntersectionObserverInit = {},
  ) {
    this.root = options.root ?? null;
    this.rootMargin = options.rootMargin ?? "0px";
    this.thresholds = Array.isArray(options.threshold)
      ? options.threshold
      : [options.threshold ?? 0];
    TestIntersectionObserver.instance = this;
  }

  observe(target: Element): void {
    this.observed.add(target);
  }

  unobserve(target: Element): void {
    this.observed.delete(target);
  }

  disconnect(): void {
    this.observed.clear();
  }

  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }

  enter(target: Element): void {
    this.callback(
      [
        {
          time: 0,
          rootBounds: null,
          boundingClientRect: new DOMRect(),
          intersectionRect: new DOMRect(),
          isIntersecting: true,
          intersectionRatio: 1,
          target,
        },
      ],
      this,
    );
  }
}

beforeEach(() => {
  TestIntersectionObserver.instance = null;
  vi.unstubAllGlobals();
});

describe("useCharacterImageViewport", () => {
  it("activates all requests attached to a visible group", () => {
    vi.stubGlobal("IntersectionObserver", TestIntersectionObserver);
    const requests = ref([ron, hermione]);
    let activeRequests!: ReturnType<typeof useCharacterImageViewport>["activeRequests"];

    const wrapper = mount(
      defineComponent({
        setup() {
          const viewport = useCharacterImageViewport(requests);
          activeRequests = viewport.activeRequests;
          return () => h("div", { ref: viewport.observe([ron, hermione]) });
        },
      }),
    );

    const observer = TestIntersectionObserver.instance;
    const target = [...(observer?.observed ?? [])][0];
    expect(observer?.rootMargin).toBe("400px");
    expect(activeRequests.value).toEqual([]);
    if (!observer || !target) throw new Error("Expected an observed group target");
    observer.enter(target);
    expect(activeRequests.value).toEqual([ron, hermione]);
    wrapper.unmount();
  });

  it("activates separate groups as they approach view", () => {
    vi.stubGlobal("IntersectionObserver", TestIntersectionObserver);
    const requests = ref([ron, hermione, otherProduction]);
    let activeRequests!: ReturnType<typeof useCharacterImageViewport>["activeRequests"];

    const wrapper = mount(
      defineComponent({
        setup() {
          const viewport = useCharacterImageViewport(requests);
          activeRequests = viewport.activeRequests;
          return () =>
            h("div", [
              h("div", { ref: viewport.observe([ron, hermione]) }),
              h("div", { ref: viewport.observe([otherProduction]) }),
            ]);
        },
      }),
    );

    const observer = TestIntersectionObserver.instance;
    const [firstGroup, secondGroup] = [...(observer?.observed ?? [])];
    if (!observer || !firstGroup || !secondGroup) {
      throw new Error("Expected both group targets to be observed");
    }
    observer.enter(firstGroup);
    expect(activeRequests.value).toEqual([ron, hermione]);
    observer.enter(secondGroup);
    expect(activeRequests.value).toEqual([ron, hermione, otherProduction]);
    wrapper.unmount();
  });

  it("activates cards added later when IntersectionObserver is unavailable", () => {
    vi.stubGlobal("IntersectionObserver", undefined);
    const requests = ref([ron]);
    let activeRequests!: ReturnType<typeof useCharacterImageViewport>["activeRequests"];
    let observe!: ReturnType<typeof useCharacterImageViewport>["observe"];

    const wrapper = mount(
      defineComponent({
        setup() {
          const viewport = useCharacterImageViewport(requests);
          activeRequests = viewport.activeRequests;
          observe = viewport.observe;
          return () => h("div");
        },
      }),
    );
    expect(activeRequests.value).toEqual([ron]);

    requests.value = [ron, hermione];
    observe([hermione])(document.createElement("div"));
    expect(activeRequests.value).toEqual([ron, hermione]);
    wrapper.unmount();
  });
});
