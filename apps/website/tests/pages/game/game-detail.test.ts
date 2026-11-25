import { mountSuspended, registerEndpoint } from "@nuxt/test-utils/runtime";
import { enableAutoUnmount } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";
import DetailsHero from "../../../src/components/layout/details/DetailsHero.vue";
import DetailsMetaChip from "../../../src/components/layout/details/DetailsMetaChip.vue";
import GameDetail from "../../../src/pages/game/[id].vue";

enableAutoUnmount(afterEach);

registerEndpoint("/api/game/257077", () => ({
  game: {
    id: 257077,
    name: "Winterfold",
    slug: "the-dark-pictures-anthology-winterfold",
    genres: [{ id: 31, name: "Adventure" }],
    involved_companies: [
      {
        id: 1,
        company: { id: 1, name: "Supermassive Games" },
        developer: true,
        publisher: false,
      },
      {
        id: 2,
        company: { id: 2, name: "Bandai Namco Entertainment" },
        developer: false,
        publisher: true,
      },
    ],
  },
  game_data_status: "available",
  characters: [],
  dubbingProjects: [],
}));

registerEndpoint("/api/game/178361", () => ({
  game: {
    id: 178361,
    name: "The Dark Pictures Anthology: The Devil in Me",
    slug: "the-dark-pictures-anthology-the-devil-in-me",
    first_release_date: 1668729600,
    rating: 69,
    platforms: [
      { id: 169, name: "Xbox Series X|S" },
      { id: 48, name: "PlayStation 4" },
      { id: 6, name: "PC (Microsoft Windows)" },
      { id: 167, name: "PlayStation 5" },
      { id: 49, name: "Xbox One" },
    ],
  },
  game_data_status: "available",
  characters: [{ id: 1, name: "Alex" }],
  dubbingProjects: [],
}));

const aliceId = "dc76b1e1-eece-41c9-9da5-12ac425a9883";

registerEndpoint("/api/game/14362", () => ({
  game: { id: 14362, name: "Detroit: Become Human" },
  game_data_status: "available",
  characters: [
    { id: 5009, name: "Alice", game_character_id: aliceId, mug_shot: { image_id: "abc123" } },
    { id: 11768, name: "Amanda" },
  ],
  dubbingProjects: [],
}));

describe("game detail", () => {
  it("links the character name and portrait when a character page exists", async () => {
    const page = await mountSuspended(GameDetail, { route: "/game/14362" });
    const link = page.get(`a[href="/character/game/${aliceId}"]`);

    expect(link.get('[title="Alice"]').classes()).toContain("underline");
    expect(link.get("img").attributes("src")).toContain("abc123");
    expect(page.get('[title="Amanda"]').element.closest("a")).toBeNull();
  });

  it("omits the empty release-year pill and shows an empty Cast & Crew section", async () => {
    const page = await mountSuspended(GameDetail, { route: "/game/257077" });

    expect(
      page
        .getComponent(DetailsHero)
        .findAllComponents(DetailsMetaChip)
        .map((chip) => chip.text()),
    ).toEqual(["IGDB"]);
    const details = page.get("#game-details");
    expect(details.get("summary").text()).toBe("Game details");
    expect(details.findAll("dd").map((value) => value.text())).toEqual([
      "Supermassive Games",
      "Bandai Namco Entertainment",
      "Adventure",
    ]);
    expect(page.getComponent(DetailsHero).get("a").attributes("href")).toBe(
      "https://www.igdb.com/games/the-dark-pictures-anthology-winterfold",
    );
    for (const role of ["Developer", "Publisher"]) {
      const term = details.get(`dt[title="${role}"]`);
      expect(term.get(".sr-only").text()).toBe(role);
      expect(term.get("svg").attributes("aria-hidden")).toBe("true");
    }
    expect(page.findAll("h2").map((heading) => heading.text())).toContain("Cast & Crew");
    expect(page.text()).toContain("No cast information available");
    expect(page.text()).not.toContain("0 / 0 roles");
    expect(page.find('input[type="search"]').exists()).toBe(false);
  });

  it("matches the shared hero and makes the full platform list available in the synopsis", async () => {
    const page = await mountSuspended(GameDetail, { route: "/game/178361" });

    const hero = page.getComponent(DetailsHero);
    expect(hero.findAllComponents(DetailsMetaChip).map((chip) => chip.text())).toEqual([
      "2022",
      "6.9",
      "IGDB",
    ]);
    const sectionHeadings = page.findAll("section h2").map((heading) => heading.text());
    expect(sectionHeadings).toEqual(["Synopsis", "Cast & Crew"]);
    const details = page.get("#game-details");
    expect(details.attributes("open")).toBeUndefined();
    expect(details.get("dt").text()).toBe("Platforms");
    expect(details.get("dd").text()).toBe(
      "Xbox Series X|S, PlayStation 4, PC (Microsoft Windows), PlayStation 5, Xbox One",
    );
    expect(page.text()).toContain("Alex");
    expect(page.text()).toContain("1 / 1 roles");

    await page.get('input[type="search"]').setValue("missing");
    await vi.waitFor(() => expect(page.text()).toContain("No results found"));
    expect(page.text()).not.toContain("0 / 0 roles");

    await page.get('input[type="search"]').setValue("");
    await vi.waitFor(() => expect(page.text()).toContain("Alex"));
  });
});
