import { describe, expect, it } from "vitest";
import { resolveMediaImage, type MediaImageOptions } from "@app/shared-logic";

describe("media image references", () => {
  it("uses the requested TMDB size for both paths and cached CDN URLs", () => {
    const original = "https://image.tmdb.org/t/p/original/poster.jpg";
    for (const image of ["/poster.jpg", original]) {
      expect(resolveMediaImage(image, { tmdbSize: "w342" })).toBe(
        "https://image.tmdb.org/t/p/w342/poster.jpg",
      );
    }
  });

  it("resolves IGDB hashes, tagged references, and old protocol-relative URLs", () => {
    const oldUrl = "//images.igdb.com/igdb/image/upload/t_thumb/co123.jpg";
    for (const image of ["co123", "igdb:co123", oldUrl]) {
      expect(resolveMediaImage(image, { igdbSize: "1080p" })).toBe(
        "https://images.igdb.com/igdb/image/upload/t_1080p/co123.jpg",
      );
    }
  });

  it("chooses a landscape rendition for raw mixed-provider backdrops", () => {
    const options: MediaImageOptions = { tmdbSize: "original", igdbSize: "1080p" };
    expect(resolveMediaImage("art42", options)).toBe(
      "https://images.igdb.com/igdb/image/upload/t_1080p/art42.jpg",
    );
    expect(resolveMediaImage("/backdrop.jpg", options)).toBe(
      "https://image.tmdb.org/t/p/original/backdrop.jpg",
    );
  });

  it("resolves storage references against the configured project or the Nuxt dev proxy", () => {
    const storageBase = "https://project.supabase.co";
    const url = `${storageBase}/storage/v1/object/public/studio_logos/42/Studio%20A.png`;
    expect(
      resolveMediaImage("42/Studio A.png", { storageBucket: "studio_logos", storageBase }),
    ).toBe(url);
    expect(resolveMediaImage(url, { storageBucket: "studio_logos", storageBase })).toBe(url);
    expect(
      resolveMediaImage("storage:studio_logos/42/Studio A.png", { storageBase: "/supabase" }),
    ).toBe("/supabase/storage/v1/object/public/studio_logos/42/Studio%20A.png");
    expect(resolveMediaImage("storage:studio_logos/../other.png", { storageBase })).toBeNull();
  });

  it("keeps external image URLs and handles missing references", () => {
    const url = "https://other.example/logo.png";
    expect(
      resolveMediaImage(url, {
        storageBucket: "studio_logos",
        storageBase: "https://project.supabase.co",
      }),
    ).toBe(url);
    expect(resolveMediaImage(url, { tmdbSize: "w500" })).toBe(url);
    expect(resolveMediaImage(null)).toBeNull();
  });
});
