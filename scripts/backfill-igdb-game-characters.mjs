#!/usr/bin/env node
// Generates SQL that materialises IGDB characters as public.game_characters rows, so every character on a game page
// has a stable /character/game/<uuid> page. The script only READS from IGDB and prints SQL to stdout: review it, then
// run it yourself (local psql first; the prod console afterwards). It never touches a database.
//
//   doppler run -- node scripts/backfill-igdb-game-characters.mjs --actor <admin auth.users uuid> <igdbGameId...> > out.sql
//   echo "1942 1943" | doppler run -- node scripts/backfill-igdb-game-characters.mjs --actor <uuid> --stdin > out.sql
//
// Needs IGDB_CLIENT_ID and IGDB_CLIENT_SECRET (Twitch app credentials) in the environment.
//
// Per (game, IGDB character) the generated SQL:
//   1. links an existing curated row that has the same name (case/space-insensitive), no IGDB id yet and is the only
//      such row, by setting igdb_character_id -- so credits already attached to it keep working and no duplicate appears;
//   2. otherwise inserts a new row, unless that IGDB character is already stored for the game.
// It is idempotent (re-running changes nothing) and never overwrites names, Wikidata ids or credits.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PAGE_SIZE = 500;
const MAX_PAGES = 20;

const args = process.argv.slice(2);
let actor = "";
let fromStdin = false;
const gameIds = [];
for (let i = 0; i < args.length; i += 1) {
  const arg = args[i];
  if (arg === "--actor") actor = args[++i] ?? "";
  else if (arg === "--stdin") fromStdin = true;
  else gameIds.push(arg);
}
if (fromStdin) {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  gameIds.push(
    ...Buffer.concat(chunks)
      .toString("utf8")
      .split(/[\s,]+/)
      .filter(Boolean),
  );
}
const games = [...new Set(gameIds.map(Number))];
if (
  !UUID.test(actor) ||
  games.length === 0 ||
  games.some((id) => !Number.isSafeInteger(id) || id < 1)
) {
  console.error(
    "Usage: backfill-igdb-game-characters.mjs --actor <admin uuid> [--stdin] <igdbGameId...>",
  );
  process.exit(1);
}

const clientId = process.env.IGDB_CLIENT_ID;
const clientSecret = process.env.IGDB_CLIENT_SECRET;
if (!clientId || !clientSecret) {
  console.error("Missing IGDB_CLIENT_ID / IGDB_CLIENT_SECRET");
  process.exit(1);
}

const tokenResponse = await fetch(
  `https://id.twitch.tv/oauth2/token?client_id=${encodeURIComponent(clientId)}&client_secret=${encodeURIComponent(clientSecret)}&grant_type=client_credentials`,
  { method: "POST" },
);
if (!tokenResponse.ok) throw new Error(`Twitch token request failed: ${tokenResponse.status}`);
const { access_token: token } = await tokenResponse.json();

async function fetchCharacters(gameId) {
  const characters = [];
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const response = await fetch("https://api.igdb.com/v4/characters", {
      method: "POST",
      headers: {
        "Client-ID": clientId,
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
      body: `fields id,name; where games = (${gameId}); sort id asc; limit ${PAGE_SIZE}; offset ${page * PAGE_SIZE};`,
    });
    if (!response.ok) throw new Error(`IGDB characters for game ${gameId}: ${response.status}`);
    const rows = await response.json();
    characters.push(...rows);
    if (rows.length < PAGE_SIZE) return characters;
  }
  throw new Error(`Too many characters for game ${gameId}`);
}

const quote = (value) => `'${String(value).replaceAll("'", "''")}'`;

const values = [];
for (const gameId of games) {
  const characters = await fetchCharacters(gameId);
  console.error(`game ${gameId}: ${characters.length} IGDB characters`);
  for (const character of characters) {
    const name = String(character.name ?? "")
      .trim()
      .slice(0, 300);
    if (!Number.isSafeInteger(character.id) || character.id < 1 || name.length === 0) continue;
    values.push(`(${gameId}, ${character.id}, ${quote(name)})`);
  }
}

if (values.length === 0) {
  console.error("Nothing to write.");
  process.exit(0);
}

console.log(`-- Generated ${new Date().toISOString().slice(0, 10)} from IGDB for games: ${games.join(", ")}
BEGIN;

CREATE TEMPORARY TABLE igdb_character_backfill (
  igdb_game_id BIGINT NOT NULL,
  igdb_character_id BIGINT NOT NULL,
  name TEXT NOT NULL
) ON COMMIT DROP;

INSERT INTO igdb_character_backfill (igdb_game_id, igdb_character_id, name) VALUES
${values.join(",\n")};

-- Resolve each game's media row (created if the game has no project yet).
CREATE TEMPORARY TABLE igdb_character_backfill_media ON COMMIT DROP AS
SELECT b.*, private.resolve_media('video_game', b.igdb_game_id) AS media_id
FROM igdb_character_backfill AS b;

-- 1. Link curated rows that match by name and are unambiguous on both sides.
UPDATE public.game_characters AS local
SET igdb_character_id = match.igdb_character_id,
    updated_at = now(),
    updated_by = ${quote(actor)}::uuid
FROM (
  SELECT b.media_id, b.igdb_character_id, min(l.id::text)::uuid AS local_id
  FROM igdb_character_backfill_media AS b
  JOIN public.game_characters AS l
    ON l.media_id = b.media_id
   AND l.igdb_character_id IS NULL
   AND lower(btrim(l.name)) = lower(btrim(b.name))
  WHERE NOT EXISTS (
    SELECT 1 FROM public.game_characters AS taken
    WHERE taken.media_id = b.media_id AND taken.igdb_character_id = b.igdb_character_id
  )
  GROUP BY b.media_id, b.igdb_character_id
  HAVING count(*) = 1
     AND (SELECT count(*) FROM igdb_character_backfill_media AS other
          WHERE other.media_id = b.media_id
            AND lower(btrim(other.name)) = lower(btrim(min(b.name)))) = 1
) AS match
WHERE local.id = match.local_id;

-- 2. Insert every IGDB character that is still not stored for its game.
INSERT INTO public.game_characters (media_id, igdb_character_id, name, created_by, updated_by)
SELECT b.media_id, b.igdb_character_id, b.name, ${quote(actor)}::uuid, ${quote(actor)}::uuid
FROM igdb_character_backfill_media AS b
WHERE NOT EXISTS (
  SELECT 1 FROM public.game_characters AS existing
  WHERE existing.media_id = b.media_id AND existing.igdb_character_id = b.igdb_character_id
)
ON CONFLICT DO NOTHING;

COMMIT;`);
