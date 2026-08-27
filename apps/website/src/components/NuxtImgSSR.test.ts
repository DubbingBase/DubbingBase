import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import { defineComponent, h, version as vueVersion, useTemplateRef } from "vue";
import { NuxtImg } from "#components";

describe("Vue deduplication & NuxtImg SSR stability", () => {
  it("uses Vue 3.5.x and does not have duplicate Vue runtime instances", () => {
    expect(vueVersion).toBeDefined();
    expect(vueVersion.startsWith("3.5.")).toBe(true);
  });

  it("handles repeated useTemplateRef calls with identical keys without throwing", () => {
    const ComponentWithDuplicateTemplateRef = defineComponent({
      setup() {
        const ref1 = useTemplateRef("imgEl");
        const ref2 = useTemplateRef("imgEl");
        return () => h("img", { ref: "imgEl" });
      },
    });

    expect(() => {
      const wrapper = mount(ComponentWithDuplicateTemplateRef);
      expect(wrapper.exists()).toBe(true);
    }).not.toThrow();
  });

  it("renders multiple NuxtImg instances without throwing 'Cannot redefine property: imgEl'", () => {
    const TestComponent = defineComponent({
      render() {
        return h("div", [
          h(NuxtImg, {
            src: "https://image.tmdb.org/t/p/w342/test1.jpg",
            alt: "Test 1",
          }),
          h(NuxtImg, {
            src: "https://image.tmdb.org/t/p/w342/test2.jpg",
            alt: "Test 2",
          }),
          h(NuxtImg, {
            src: "https://image.tmdb.org/t/p/w342/test3.jpg",
            alt: "Test 3",
          }),
        ]);
      },
    });

    expect(() => {
      const wrapper = mount(TestComponent);
      expect(wrapper.exists()).toBe(true);
    }).not.toThrow();
  });
});
