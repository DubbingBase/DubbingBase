import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import SearchResultItem from "./SearchResultItem.vue";

describe("SearchResultItem", () => {
  it("renders the cover image when a result has no poster or profile image", () => {
    const wrapper = mount(SearchResultItem, {
      props: {
        result: {
          id: 42,
          media_type: "video_game",
          title: "The Witcher 3: Wild Hunt",
          cover: {
            url: "https://images.igdb.com/igdb/image/upload/t_cover_big/witcher3.jpg",
          },
        },
        mediaTypeLabel: "Video Game",
        selected: false,
      },
    });

    expect(wrapper.find("img").attributes("src")).toContain("witcher3.jpg");
  });
});
