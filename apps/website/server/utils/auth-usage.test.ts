import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const apiDir = join(import.meta.dirname, "../api");

function listHandlers(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return listHandlers(path);
    return path.endsWith(".ts") && !path.endsWith(".test.ts") ? [path] : [];
  });
}

describe("API authentication conventions", () => {
  const handlers = listHandlers(apiDir).map((path) => ({
    name: relative(apiDir, path),
    source: readFileSync(path, "utf8"),
  }));

  it("never reads a user pre-resolved by a global middleware", () => {
    const offenders = handlers
      .filter(({ source }) => /event\.context\.user\b/.test(source))
      .map(({ name }) => name);

    // Use defineUserHandler/defineAdminHandler, or `await resolveUser(event)`.
    expect(offenders).toEqual([]);
  });

  it("awaits every inline requireUser/requireAdmin call", () => {
    const offenders = handlers
      .filter(({ source }) => /(?<!await )(?<![\w.])require(?:User|Admin)\(event\)/.test(source))
      .map(({ name }) => name);

    expect(offenders).toEqual([]);
  });
});
