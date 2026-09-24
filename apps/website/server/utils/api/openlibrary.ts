import { createCacheNamespace, SimpleCache } from "../cache";
import { buildCacheKey } from "../cache/constants";
import type { Audiobook, OpenLibraryAuthor } from "@app/shared-logic";
import type { CacheFetchOptions } from "./cache-options";

export function buildOpenLibraryCoverUrl(
  coverId: number,
  size: "S" | "M" | "L" = "L",
): string {
  return `https://covers.openlibrary.org/b/id/${coverId}-${size}.jpg`;
}

interface OpenLibraryDoc {
  key?: string;
  title?: string;
  author_name?: string[];
  first_publish_year?: number;
  cover_i?: number;
  isbn?: string[];
  language?: string[];
  edition_count?: number;
  ratings_average?: number;
  ratings_count?: number;
}

interface OpenLibraryWorkResponse {
  title?: string;
  description?: string | { type: string; value: string };
  covers?: number[];
  authors?: Array<{ author: { key: string }; type?: { key: string } }>;
  first_publish_date?: string;
  subjects?: string[];
}

interface OpenLibraryAuthorResponse {
  name?: string;
  personal_name?: string;
  birth_date?: string;
  death_date?: string;
}

const OPENLIBRARY_AUTHOR_CACHE = createCacheNamespace<string | null>();
const OPENLIBRARY_BOOK_CACHE = createCacheNamespace<Audiobook | null>();

function isOpenLibraryAuthorResponse(
  value: unknown,
): value is OpenLibraryAuthorResponse {
  if (typeof value !== "object" || value === null) return false;
  return (
    (!("name" in value) || typeof value.name === "string") &&
    (!("personal_name" in value) || typeof value.personal_name === "string")
  );
}

export class OpenLibraryClient {
  private baseUrl = "https://openlibrary.org";
  private cache: SimpleCache;
  private userAgent =
    "DubbingBase/1.0 (https://dubbingbase.com; contact@dubbingbase.com)";

  constructor(cache: SimpleCache) {
    this.cache = cache;
  }

  async searchBooks(query: string): Promise<Audiobook[]> {
    const trimmed = query.trim();
    if (!trimmed || trimmed.length < 2) return [];

    try {
      const url = `${this.baseUrl}/search.json?q=${encodeURIComponent(trimmed)}&limit=20`;
      const res = await fetch(url, {
        headers: {
          "User-Agent": this.userAgent,
          Accept: "application/json",
        },
        signal: AbortSignal.timeout(8000),
      });

      if (!res.ok) {
        console.error(`OpenLibrary search failed with status: ${res.status}`);
        return [];
      }

      const data: { docs?: OpenLibraryDoc[] } = await res.json();
      const docs = data.docs || [];

      const books: Audiobook[] = [];
      for (const doc of docs) {
        if (!doc.key || !doc.title) continue;

        // Extract numeric ID from key (e.g. "/works/OL82563W" -> 82563)
        const match = doc.key.match(/\/works\/OL(\d+)W/i);
        let id: number | null = null;
        if (match && match[1]) {
          id = parseInt(match[1], 10);
        } else if (doc.isbn && doc.isbn[0]) {
          const numericIsbn = parseInt(doc.isbn[0].replace(/[^0-9]/g, ""), 10);
          if (!isNaN(numericIsbn) && numericIsbn > 0) {
            id = numericIsbn;
          }
        }

        if (!id || isNaN(id)) continue;

        const coverUrl = doc.cover_i
          ? buildOpenLibraryCoverUrl(doc.cover_i, "L")
          : null;

        const authors: OpenLibraryAuthor[] = (doc.author_name || []).map(
          (name) => ({
            name,
          }),
        );

        books.push({
          id,
          title: doc.title,
          name: doc.title,
          authors,
          author_name: doc.author_name?.[0] || "",
          cover_url: coverUrl,
          cover_id: doc.cover_i || null,
          first_publish_year: doc.first_publish_year || null,
          first_publish_date: doc.first_publish_year
            ? String(doc.first_publish_year)
            : null,
          publish_date: doc.first_publish_year
            ? `${doc.first_publish_year}-01-01`
            : null,
          release_date: doc.first_publish_year
            ? `${doc.first_publish_year}-01-01`
            : null,
          isbn: doc.isbn?.[0] || null,
          media_type: "audiobook",
          popularity: doc.edition_count ? Math.sqrt(doc.edition_count) * 5 : 0,
          vote_average: doc.ratings_average ? doc.ratings_average * 2 : 0,
          vote_count: doc.ratings_count || 0,
        });
      }

      return books;
    } catch (err) {
      console.error("OpenLibrary search error:", err);
      return [];
    }
  }

  async getAuthorName(
    authorKey: string,
    options: CacheFetchOptions = {},
  ): Promise<string> {
    const cleanKey = authorKey.replace(/^\//, "").replace(/^authors\//, "");
    const cacheKey = buildCacheKey({
      provider: "openlibrary",
      resource: "author",
      id: cleanKey,
    });
    const authorName = await this.cache.getOrFetch(
      OPENLIBRARY_AUTHOR_CACHE,
      cacheKey,
      async (): Promise<string | null> => {
        try {
          const url = `${this.baseUrl}/authors/${cleanKey}.json`;
          const res = await fetch(url, {
            headers: {
              "User-Agent": this.userAgent,
              Accept: "application/json",
            },
            signal: AbortSignal.timeout(6000),
          });

          if (!res.ok) return null;

          const data: unknown = await res.json();
          if (!isOpenLibraryAuthorResponse(data)) return null;
          const name = data.name || data.personal_name;
          return name || null;
        } catch (err) {
          console.error(`Failed to fetch OpenLibrary author ${cleanKey}:`, err);
          return null;
        }
      },
      { ttl: 604800, ...options },
    );
    return authorName ?? "";
  }

  async getBook(
    id: number,
    options: CacheFetchOptions = {},
  ): Promise<Audiobook | null> {
    const cacheKey = buildCacheKey({
      provider: "openlibrary",
      resource: "book",
      id,
    });
    return this.cache.getOrFetch(
      OPENLIBRARY_BOOK_CACHE,
      cacheKey,
      async () => {
        try {
          // Try work endpoint first
          const workUrl = `${this.baseUrl}/works/OL${id}W.json`;
          const res = await fetch(workUrl, {
            headers: {
              "User-Agent": this.userAgent,
              Accept: "application/json",
            },
            signal: AbortSignal.timeout(8000),
          });

          if (!res.ok) {
            // If not found as OL work and is valid ISBN (10 or 13 digits), try ISBN endpoint
            if (id > 100000000) {
              const book = await this.getBookByIsbn(id);
              return book;
            }
            return null;
          }

          const data: OpenLibraryWorkResponse = await res.json();
          if (!data.title) return null;

          let description = "";
          if (typeof data.description === "string") {
            description = data.description;
          } else if (data.description && typeof data.description === "object") {
            description = data.description.value || "";
          }

          const validCovers = (data.covers || []).filter((c) => c && c > 0);
          const coverId = validCovers[0] || null;
          const coverUrl = coverId
            ? buildOpenLibraryCoverUrl(coverId, "L")
            : null;

          const authors: OpenLibraryAuthor[] = [];
          if (data.authors && Array.isArray(data.authors)) {
            for (const item of data.authors) {
              if (item?.author?.key) {
                const authorName = await this.getAuthorName(
                  item.author.key,
                  options,
                );
                if (authorName) {
                  authors.push({
                    id: item.author.key,
                    name: authorName,
                  });
                }
              }
            }
          }

          let publishYear: number | null = null;
          if (data.first_publish_date) {
            const yearMatch =
              data.first_publish_date.match(/\b(19\d\d|20\d\d)\b/);
            if (yearMatch && yearMatch[1]) {
              publishYear = parseInt(yearMatch[1], 10);
            }
          }

          const book: Audiobook = {
            id,
            title: data.title,
            name: data.title,
            description,
            authors,
            author_name: authors[0]?.name || "",
            cover_url: coverUrl,
            cover_id: coverId,
            first_publish_year: publishYear,
            first_publish_date: data.first_publish_date || null,
            publish_date: publishYear ? `${publishYear}-01-01` : null,
            release_date: publishYear ? `${publishYear}-01-01` : null,
            subjects: data.subjects?.slice(0, 10) || [],
            media_type: "audiobook",
          };

          return book;
        } catch (err) {
          console.error(`Failed to fetch OpenLibrary book ${id}:`, err);
          return null;
        }
      },
      { ttl: 604800, ...options },
    );
  }

  private async getBookByIsbn(isbn: number): Promise<Audiobook | null> {
    try {
      const url = `${this.baseUrl}/isbn/${isbn}.json`;
      const res = await fetch(url, {
        headers: {
          "User-Agent": this.userAgent,
          Accept: "application/json",
        },
        signal: AbortSignal.timeout(8000),
      });

      if (!res.ok) return null;

      const data: {
        title?: string;
        description?: string | { value: string };
        covers?: number[];
        publish_date?: string;
        works?: Array<{ key: string }>;
      } = await res.json();

      if (!data.title) return null;

      const validCovers = (data.covers || []).filter((c) => c && c > 0);
      const coverId = validCovers[0] || null;
      const coverUrl = coverId ? buildOpenLibraryCoverUrl(coverId, "L") : null;

      let publishYear: number | null = null;
      if (data.publish_date) {
        const yearMatch = data.publish_date.match(/\b(19\d\d|20\d\d)\b/);
        if (yearMatch && yearMatch[1]) {
          publishYear = parseInt(yearMatch[1], 10);
        }
      }

      let description = "";
      if (typeof data.description === "string") {
        description = data.description;
      } else if (data.description && typeof data.description === "object") {
        description = data.description.value || "";
      }

      const book: Audiobook = {
        id: isbn,
        title: data.title,
        name: data.title,
        description,
        authors: [],
        author_name: "",
        cover_url: coverUrl,
        cover_id: coverId,
        first_publish_year: publishYear,
        first_publish_date: data.publish_date || null,
        publish_date: publishYear ? `${publishYear}-01-01` : null,
        release_date: publishYear ? `${publishYear}-01-01` : null,
        isbn: String(isbn),
        media_type: "audiobook",
      };

      return book;
    } catch (err) {
      console.error(`Failed to fetch OpenLibrary book by ISBN ${isbn}:`, err);
      return null;
    }
  }
}
