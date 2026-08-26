import { createClient } from "@supabase/supabase-js";
import { format, subDays, differenceInMinutes } from "date-fns";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { DatabaseSync } from "node:sqlite";

// Initialize Supabase Client
const WIKI_LANG = process.env.WIKI_LANG || "fr";

// Cheap regex pre-filter for dubbing sections across the major Wikipedia
// editions. The server-side pipeline (selectDubbingSections) classifies
// sections via LLM and therefore covers every language; this list is the
// high-volume batch filter only.
export const DUBBING_HEADING_PATTERN =
  /={2,}\s*(distribution|doublages?|voix|casting|voice[- ]?(cast|over|acting)?|dubbing|starring|besetzung|synchronbesetzung|reparto|doblaj[oe]s?|dobragem|dublagem|doppiaggio|nasynchronisatie|röster|stemmer|głos|znění|dabing|znenie|szinkron|дублир|дубляж|закадров|дублюванн|dublaj|μεταγλώττιση|דיבוב|دبلجة|alih suara|lồng tiếng|พากย์|डबिंग|더빙|配音|声優|吹き替え|synchronisation|sincronización)[^=]*={2,}/i;
const STATE_FILE = path.join(
  process.cwd(),
  "scripts",
  `.scraping_state.${WIKI_LANG}.json`,
);

const supabaseUrl = process.env.SUPABASE_URL || "http://localhost:54321";
const supabaseKey =
  process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error(
    "Missing SUPABASE_URL or SUPABASE_SECRET_KEY environment variables.",
  );
  console.error(
    "Please run with: tsx --env-file=.env.development scripts/discover-media.ts",
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Helper to get or initialize state
async function getState() {
  try {
    const data = await fs.readFile(STATE_FILE, "utf-8");
    return JSON.parse(data);
  } catch (err: any) {
    if (err.code === "ENOENT") {
      const defaultState = {
        // Start scrape from the beginning of Wikipedia
        last_fetched_at: "2001-01-01T00:00:00Z",
      };
      await saveState(defaultState);
      return defaultState;
    }
    throw err;
  }
}

// Helper to save state
async function saveState(state: any) {
  await fs.writeFile(STATE_FILE, JSON.stringify(state, null, 2), "utf-8");
}

// SQLite Cache to prevent duplicate checks
const CACHE_DB_FILE = path.join(
  process.cwd(),
  "scripts",
  `.scraping_cache.${WIKI_LANG}.sqlite`,
);
const db = new DatabaseSync(CACHE_DB_FILE);

db.exec(`
  CREATE TABLE IF NOT EXISTS checked_media (
    tmdb_id INTEGER PRIMARY KEY,
    last_checked INTEGER
  );
`);

function getLastChecked(tmdbId: number): number | null {
  const stmt = db.prepare(
    "SELECT last_checked FROM checked_media WHERE tmdb_id = ?",
  );
  const row = stmt.get(tmdbId) as { last_checked: number } | undefined;
  return row ? row.last_checked : null;
}

function markAsChecked(tmdbId: number) {
  const stmt = db.prepare(`
    INSERT INTO checked_media (tmdb_id, last_checked)
    VALUES (?, ?)
    ON CONFLICT(tmdb_id) DO UPDATE SET last_checked = excluded.last_checked
  `);
  stmt.run(tmdbId, Date.now());
}

const WIKIPEDIA_USER_AGENT =
  "DubbingBase/1.0 (https://dubbingbase.com; contact@dubbingbase.com)";

// Wikipedia API helper
async function checkWikipediaBatchForDubbing(
  titles: string[],
  retryCount = 0,
): Promise<Record<string, boolean>> {
  if (titles.length === 0) return {};
  try {
    const titlesParam = encodeURIComponent(titles.join("|"));
    const url = `https://${WIKI_LANG}.wikipedia.org/w/api.php?action=query&prop=revisions&rvprop=content&rvslots=main&format=json&titles=${titlesParam}`;
    const response = await fetch(url, {
      headers: { "User-Agent": WIKIPEDIA_USER_AGENT },
    });

    if (response.status === 429) {
      const retryAfter = response.headers.get("retry-after") || "10";
      const delayMs = (parseInt(retryAfter, 10) || 10) * 1000;
      console.warn(
        `[WIKIPEDIA API ERROR] 429 Rate Limit hit! Wikipedia says wait ${retryAfter}s. Sleeping...`,
      );
      await new Promise((resolve) => setTimeout(resolve, delayMs));

      if (retryCount < 3) {
        return checkWikipediaBatchForDubbing(titles, retryCount + 1);
      } else {
        throw new Error(
          `Max retries reached for Wikipedia batch of ${titles.length} titles`,
        );
      }
    }

    if (!response.ok) {
      console.warn(
        `[WIKIPEDIA API ERROR] Failed to fetch batch (${response.status})`,
      );
      return {};
    }

    const data = await response.json();
    const result: Record<string, boolean> = {};

    // Map input titles to their normalized forms if present
    const normalizedMap: Record<string, string> = {};
    for (const title of titles) {
      normalizedMap[title] = title;
    }
    if (data.query?.normalized) {
      for (const norm of data.query.normalized) {
        normalizedMap[norm.from] = norm.to;
      }
    }

    const pagesByTitle: Record<string, any> = {};
    if (data.query?.pages) {
      for (const pageId in data.query.pages) {
        const page = data.query.pages[pageId];
        pagesByTitle[page.title] = page;
      }
    }

    for (const title of titles) {
      const normTitle = normalizedMap[title] || title;
      const page = pagesByTitle[normTitle];
      let hasDubbing = false;
      if (page && page.revisions && page.revisions.length > 0) {
        const wikitext =
          page.revisions[0].slots?.main?.["*"] || page.revisions[0]["*"] || "";
        if (
          wikitext.match(DUBBING_HEADING_PATTERN)
        ) {
          hasDubbing = true;
        }
      }
      result[title] = hasDubbing;
    }

    return result;
  } catch (err) {
    // We throw to ensure the batch fails and the pointer is not advanced, avoiding data loss
    console.error(`Error checking Wikipedia batch:`, err);
    throw err;
  }
}

// Enqueue to Supabase PGMQ
async function enqueueMedia(tmdbId: number, type: string) {
  try {
    const { error } = await supabase.rpc("enqueue_media_fetch", {
      p_tmdb_id: tmdbId,
      p_media_type: type,
    });

    if (error) {
      if (error.message && error.message.includes("already in the queue")) {
        console.log(
          `[SKIP] TMDB ${tmdbId} (${type}) is already in the queue. Avoiding duplicates.`,
        );
      } else {
        console.error(
          `[PGMQ ERROR] Failed to enqueue TMDB ${tmdbId} into Supabase:`,
          error.message,
        );
      }
    } else {
      console.log(
        `[ENQUEUED] TMDB ${tmdbId} (${type}) successfully added to pgmq.media_queue`,
      );
    }
  } catch (err) {
    console.error(`[ERROR] Exception while enqueueing TMDB ${tmdbId}:`, err);
  }
}

// Perform a single SPARQL discovery batch
async function performDiscoveryBatch(state: any) {
  const lastFetchedAt = state.last_fetched_at || "2001-01-01T00:00:00Z";

  console.log(`Fetching items modified since: ${lastFetchedAt}`);

  const query = `
    SELECT DISTINCT ?item ?tmdbId ?article ?modified ?type WHERE {
      { 
        ?item wdt:P31/wdt:P279* wd:Q11424 . 
        BIND("movie" AS ?type)
      }
      UNION
      { 
        ?item wdt:P31/wdt:P279* wd:Q5398426 . 
        BIND("tv" AS ?type)
      }

      ?item wdt:P4947|wdt:P4983 ?tmdbId .

      ?article schema:about ?item ;
               schema:isPartOf <https://${WIKI_LANG}.wikipedia.org/> .

      ?item schema:dateModified ?modified .
      FILTER(?modified > "${lastFetchedAt}"^^xsd:dateTime)
    }
    ORDER BY ?modified
    LIMIT 500
  `;

  const wikidataUrl = "https://query.wikidata.org/sparql";

  try {
    const response = await fetch(wikidataUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/sparql-results+json",
        "User-Agent": WIKIPEDIA_USER_AGENT,
      },
      body: newSearchParams({ query }), // wait, new URLSearchParams
    });

    if (!response.ok) {
      console.error(
        `Wikidata SPARQL query failed: ${response.status} ${response.statusText}`,
      );
      return false; // Yield on failure
    }

    const data = await response.json();
    const bindings = data.results.bindings;

    console.log(`Found ${bindings.length} items.`);

    let highestModifiedDate = lastFetchedAt;
    const itemsToProcess = [];
    const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

    for (const binding of bindings) {
      const tmdbId = parseInt(binding.tmdbId.value, 10);
      const type = binding.type.value;
      const articleUrl = binding.article.value;
      const modifiedDate = binding.modified.value;

      if (new Date(modifiedDate) > new Date(highestModifiedDate)) {
        highestModifiedDate = modifiedDate;
      }

      // Skip if checked within the last 7 days
      const lastChecked = getLastChecked(tmdbId);
      if (lastChecked && Date.now() - lastChecked < SEVEN_DAYS_MS) {
        continue;
      }

      const titleMatch = articleUrl.match(/wiki\/(.+)$/);
      if (!titleMatch) continue;

      const pageTitle = decodeURIComponent(titleMatch[1]);
      itemsToProcess.push({ tmdbId, type, pageTitle });
    }

    const BATCH_SIZE = 50;
    for (let i = 0; i < itemsToProcess.length; i += BATCH_SIZE) {
      const batch = itemsToProcess.slice(i, i + BATCH_SIZE);
      const titles = batch.map((item) => item.pageTitle);

      const results = await checkWikipediaBatchForDubbing(titles);

      for (const item of batch) {
        // Mark as checked to avoid re-checking too soon
        markAsChecked(item.tmdbId);

        const hasSection = results[item.pageTitle];
        if (hasSection) {
          await enqueueMedia(item.tmdbId, item.type);
        } else {
          console.log(
            `[IGNORE] TMDB ${item.tmdbId} (${item.type}) - No "distribution", "doublage" or "voix" section found on Wikipedia page: ${item.pageTitle}`,
          );
        }
      }

      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    if (bindings.length > 0) {
      state.last_fetched_at = highestModifiedDate;
      await saveState(state);
      console.log(`Updated pointer to ${highestModifiedDate}`);

      // If we got exactly 500 results, there are probably more right behind it.
      return bindings.length === 500;
    }

    return false; // No more results
  } catch (err) {
    console.error(`Discovery failed:`, err);
    return false;
  }
}

// Polyfill for URLSearchParams if needed
const newSearchParams = (obj: any) => new URLSearchParams(obj);

// Main scrape loop
async function runScraper() {
  console.log("Starting media discovery scrape...");
  const state = await getState();

  console.log(
    `Resuming scrape from: ${state.last_fetched_at || "2001-01-01T00:00:00Z"}`,
  );

  while (true) {
    const hasMore = await performDiscoveryBatch(state);
    if (!hasMore) {
      console.log("Scrape completed! Reached the present day.");
      break;
    }

    // Sleep 1 second before next batch
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
}

runScraper();
