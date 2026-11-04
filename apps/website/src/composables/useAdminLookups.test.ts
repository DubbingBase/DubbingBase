import { describe, it, expect } from "vitest";
import { mockNuxtImport } from "@nuxt/test-utils/runtime";
import { useAdminLookups } from "./useAdminLookups";

interface Row {
  id: number;
  firstname: string | null;
  lastname: string | null;
  profile_picture: string | null;
}

const rows: Row[] = [
  { id: 1, firstname: "John", lastname: "Doe", profile_picture: null },
  { id: 2, firstname: "Johnny", lastname: "Depp", profile_picture: null },
  { id: 3, firstname: "Jane", lastname: "Doe", profile_picture: null },
  {
    id: 4,
    firstname: 'Dan "Dee"',
    lastname: "O'Neil, Jr",
    profile_picture: null,
  },
  { id: 5, firstname: "Solo", lastname: null, profile_picture: null },
];

/** Minimal PostgREST stand-in: chained `or()` calls are ANDed, values may be double-quoted. */
const createFakeClient = () => {
  const filters: string[] = [];
  const parseOr = (expr: string) =>
    expr.split(/,(?=(?:firstname|lastname)\.ilike\.)/).flatMap((part) => {
      const match = part.match(/^(firstname|lastname)\.ilike\.(.*)$/);
      if (!match) return [];
      const [, column, raw = ""] = match;
      const unquoted = raw.startsWith('"') ? raw.slice(1, -1).replace(/\\(["\\])/g, "$1") : raw;
      const target: "firstname" | "lastname" = column === "firstname" ? "firstname" : "lastname";
      return [{ column: target, needle: unquoted.replace(/%/g, "") }];
    });
  const builder = {
    select: () => builder,
    limit: () => builder,
    or: (expr: string) => {
      filters.push(expr);
      return builder;
    },
    then: (resolve: (value: { data: Row[]; error: null }) => void) => {
      const data = rows.filter((row) =>
        filters.every((expr) =>
          parseOr(expr).some(({ column, needle }) =>
            (row[column] ?? "").toLowerCase().includes(needle.toLowerCase()),
          ),
        ),
      );
      resolve({ data, error: null });
    },
  };
  return { from: () => builder };
};

mockNuxtImport("useSupabaseClient", () => () => createFakeClient());

describe("useAdminLookups.searchVoiceActors", () => {
  const search = (query: string) => useAdminLookups().searchVoiceActors(query);
  const ids = async (query: string) => (await search(query)).map((o) => o.id);

  it("returns everything for an empty query", async () => {
    expect(await ids("")).toHaveLength(rows.length);
    expect(await ids("   ")).toHaveLength(rows.length);
  });

  it("matches a single word against first or last name", async () => {
    expect(await ids("doe")).toEqual([1, 3]);
  });

  it("matches 'firstname lastname' and 'lastname firstname'", async () => {
    expect(await ids("John Doe")).toEqual([1]);
    expect(await ids("Doe John")).toEqual([1]);
  });

  it("supports a partially typed last name and extra spaces", async () => {
    expect(await ids("john  d")).toEqual([1, 2]);
    expect(await ids("John ")).toEqual([1, 2]);
  });

  it("does not break on quotes, commas and parentheses", async () => {
    expect(await ids('Dan "Dee"')).toEqual([4]);
    expect(await ids("O'Neil, Jr")).toEqual([4]);
  });

  it("returns display names", async () => {
    expect((await search("Solo"))[0]?.name).toBe("Solo");
  });
});
