import { describe, expect, it } from "vitest";
import {
  escapeActorHtml,
  renderActorFilmographyCardHtml,
  renderActorImageHtml,
  renderActorVoiceActorCardHtml,
  type ActorImageAttributesFactory,
} from "./actor-grid-html";

const getImageAttributes: ActorImageAttributesFactory = (src, alt, imageClass) => ({
  "data-nuxt-img": "",
  sizes: "100vw",
  srcset: `${src ?? ""} 1x`,
  alt,
  class: imageClass,
  decoding: "async",
  loading: "lazy",
  src: src ?? "",
});

describe("actor SSR card HTML", () => {
  it("escapes text and attribute values", () => {
    expect(escapeActorHtml(`<A & "B">'`)).toBe("&lt;A &amp; &quot;B&quot;&gt;&#39;");
    expect(
      renderActorImageHtml({
        "data-nuxt-img": "",
        sizes: undefined,
        srcset: "https://images.test/a.webp 1x",
        alt: `A "quote" & <tag>`,
        class: "cover",
        decoding: "async",
        loading: "lazy",
        src: "https://images.test/a.webp?x=1&y=2",
      }),
    ).toContain('alt="A &quot;quote&quot; &amp; &lt;tag&gt;"');
  });

  it("renders voice actor cards with a localized link and escaped content", () => {
    const html = renderActorVoiceActorCardHtml(
      {
        id: 7,
        firstname: "Ari",
        lastname: "<Lee>",
        profile_picture: null,
        rolesCount: 3,
      },
      "/fr/voice-actor/7",
      " rôles",
      getImageAttributes,
    );

    expect(html).toContain('href="/fr/voice-actor/7"');
    expect(html).toContain("Ari &lt;Lee&gt;");
    expect(html).toContain("3 rôles");
    expect(html).toContain('data-actor-nav=""');
  });

  it("renders full filmography cards, links, image metadata, and escaped text", () => {
    const html = renderActorFilmographyCardHtml(
      {
        id: 11,
        media_type: "movie",
        title: `A <Film> & "Title"`,
        character: "Hero & Friend",
        poster_path: "/poster.jpg",
        release_date: "2001-01-01",
        voice_actors: [
          {
            id: 12,
            firstname: "Sam",
            lastname: "Voice",
            profile_picture: "/voice.jpg",
          },
        ],
      },
      "/fr/movie/11",
      "/fr/voice-actor/12",
      { voicedBy: "Voiced by", as: "As", unknownCharacter: "Unknown" },
      getImageAttributes,
      (path) => path ?? undefined,
    );

    expect(html).toContain('href="/fr/movie/11"');
    expect(html).toContain('href="/fr/voice-actor/12"');
    expect(html).toContain("A &lt;Film&gt; &amp; &quot;Title&quot;");
    expect(html).toContain("Hero &amp; Friend");
    expect(html).toContain('data-nuxt-img=""');
    expect(html).toContain("2001");
  });
});
