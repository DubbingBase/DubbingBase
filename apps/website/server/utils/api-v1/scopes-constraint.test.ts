import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { API_SCOPES } from "../../../shared/api-scopes";

const MIGRATIONS = resolve(
  import.meta.dirname,
  "../../../../../packages/database/supabase/migrations",
);

describe("api_tokens.scopes", () => {
  it("accepts exactly the scopes the API defines", () => {
    // The newest migration that mentions the constraint is the one in force.
    const sql = readFileSync(
      resolve(MIGRATIONS, "20261124120000_api_fine_scopes_characters_actors.sql"),
      "utf8",
    );
    const list = /scopes <@ array\[([^\]]+)\]/i.exec(sql)?.[1] ?? "";
    const allowed = [...list.matchAll(/'([^']+)'/g)].map((match) => match[1]);
    expect([...allowed].sort()).toEqual([...API_SCOPES].sort());
  });
});
