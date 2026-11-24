import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import SearchResultItem from "./SearchResultItem.vue";

describe("SearchResultItem", () => {
  it.each([
    { image_id: "witcher3" },
    { url: "https://images.igdb.com/igdb/image/upload/t_cover_big/witcher3.jpg" },
  ])("renders an IGDB cover from %o", (cover) => {
    const wrapper = mount(SearchResultItem, {
      props: {
        result: {
          id: 42,
          media_type: "video_game",
          title: "The Witcher 3: Wild Hunt",
          cover,
        },
        href: "/game/42",
        mediaTypeLabel: "Video Game",
        selected: false,
      },
    });

    expect(wrapper.find("img").attributes("src")).toContain("witcher3.jpg");
  });

  it("shows the release year for games and includes category context in its label", () => {
    const wrapper = mount(SearchResultItem, {
      props: {
        result: {
          id: 42,
          media_type: "video_game",
          title: "The Witcher 3: Wild Hunt",
          first_release_date: 1432180800,
        },
        href: "/game/42",
        mediaTypeLabel: "Video Game",
        selected: false,
      },
    });

    expect(wrapper.text()).toContain("2015");
    expect(wrapper.text()).not.toContain("Video Game");
    expect(wrapper.find('[title="Video Game"] svg').classes()).toContain(
      "text-[var(--app-color-search-video-game)]",
    );
    expect(wrapper.find('[title="Video Game"]').classes()).not.toContain(
      "text-[var(--app-color-search-video-game)]",
    );
    expect(wrapper.attributes("aria-label")).toBe("The Witcher 3: Wild Hunt, Video Game, 2015");
  });

  it("renders a real link and only intercepts plain left clicks", async () => {
    const wrapper = mount(SearchResultItem, {
      props: {
        result: { id: 42, media_type: "video_game", title: "Game" },
        href: "/game/42",
        mediaTypeLabel: "Video Game",
        selected: false,
      },
    });

    expect(wrapper.element.tagName).toBe("A");
    expect(wrapper.attributes("href")).toBe("/game/42");
    await wrapper.trigger("click", { ctrlKey: true });
    await wrapper.trigger("click", { button: 1 });
    expect(wrapper.emitted("select")).toBeUndefined();
    await wrapper.trigger("click");
    expect(wrapper.emitted("select")).toHaveLength(1);
  });
});
