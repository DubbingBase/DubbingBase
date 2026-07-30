import fs from "fs";
import { createClient } from "@supabase/supabase-js";

// Constants
const USER_AGENT = "DubbingBaseBot/1.0 (contact@dubbingbase.com)";
const BASE_DELAY_MS = 100;
const LIMIT = 50;
const PROGRESS_FILE = process.env.PROGRESS_FILE || "./scripts/progress.json";

// Keywords to look for in the section titles
const DUBBING_KEYWORDS = [
  /doublages?/i,
  /voix fran[çc]aises?/i,
  /distribution/i,
];
const EXCLUDE_KEYWORDS = [/voix qu[éèe]b[éèe]coises?/i, /vfq/i];

// Initialize Supabase Client
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey =
  process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error(
    "Missing SUPABASE_URL or SUPABASE_SECRET_KEY environment variables.",
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function loadProgress(): number {
  if (fs.existsSync(PROGRESS_FILE)) {
    const data = fs.readFileSync(PROGRESS_FILE, "utf-8");
    const parsed = JSON.parse(data);
    return parsed.offset || 0;
  }
  return 0;
}

function saveProgress(offset: number) {
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify({ offset }, null, 2));
}

async function fetchMoviesFromWikidata(
  offset: number,
): Promise<{ title: string; tmdbId: number; mediaType: string }[]> {
  console.log(`Fetching from Wikidata (OFFSET: ${offset}, LIMIT: ${LIMIT})...`);

  const sparqlQuery = `
    SELECT ?article ?tmdb_id ?type WHERE {
      {
        ?item wdt:P31 wd:Q11424.
        ?item wdt:P4947 ?tmdb_id.
        BIND("movie" AS ?type)
      }
      UNION
      {
        ?item wdt:P31 wd:Q15416.
        ?item wdt:P4983 ?tmdb_id.
        BIND("tv" AS ?type)
      }
      UNION
      {
        ?item wdt:P31 wd:Q5398426.
        ?item wdt:P4983 ?tmdb_id.
        BIND("tv" AS ?type)
      }
      
      ?article schema:about ?item.
      ?article schema:inLanguage "fr".
      ?article schema:isPartOf <https://fr.wikipedia.org/>.
    }
    LIMIT ${LIMIT}
    OFFSET ${offset}
  `;

  const url = `https://query.wikidata.org/sparql?query=${encodeURIComponent(
    sparqlQuery,
  )}&format=json`;

  const response = await fetch(url, { headers: { "User-Agent": USER_AGENT } });

  if (!response.ok) {
    if (response.status === 429) {
      const retryAfter = response.headers.get("Retry-After");
      const waitTime = retryAfter ? parseInt(retryAfter, 10) * 1000 : 5000;
      console.warn(`[Wikidata 429] Rate limited. Waiting ${waitTime}ms...`);
      await delay(waitTime);
      return fetchMoviesFromWikidata(offset); // Retry
    }
    throw new Error(
      `Wikidata error: ${response.status} ${response.statusText}`,
    );
  }

  const data = await response.json();

  return data.results.bindings.map((b: any) => {
    const fullUrl = b.article.value;
    return {
      title: decodeURIComponent(
        fullUrl.replace("https://fr.wikipedia.org/wiki/", ""),
      ),
      tmdbId: parseInt(b.tmdb_id.value, 10),
      mediaType: b.type.value,
    };
  });
}

async function checkDubbingSectionsBatch(
  pageTitles: string[],
): Promise<Record<string, boolean>> {
  if (pageTitles.length === 0) return {};

  const titlesParam = pageTitles.map(encodeURIComponent).join("|");
  const url = `https://fr.wikipedia.org/w/api.php?action=query&prop=revisions&rvprop=content&rvslots=main&titles=${titlesParam}&format=json`;

  try {
    const response = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
    });

    if (!response.ok) {
      if (response.status === 429) {
        const retryAfter = response.headers.get("Retry-After");
        const waitTime = retryAfter ? parseInt(retryAfter, 10) * 1000 : 5000;
        console.warn(
          `[Wikipedia 429] Rate limited in batch. Waiting ${waitTime}ms...`,
        );
        await delay(waitTime);
        return checkDubbingSectionsBatch(pageTitles); // Retry
      }
      return Object.fromEntries(pageTitles.map((t) => [t, false]));
    }

    const data = await response.json();
    const results: Record<string, boolean> = {};
    const pages = data.query?.pages || {};

    const headerRegex = /==+\s*(.*?)\s*==+/g;

    for (const pageId in pages) {
      const page = pages[pageId];
      if (page.missing !== undefined) {
        results[page.title] = false;
        continue;
      }
      const wikitext = page.revisions?.[0]?.slots?.main?.["*"] || "";

      let hasMatch = false;
      let hasExclude = false;
      let match;

      while ((match = headerRegex.exec(wikitext)) !== null) {
        const headerTitle = match[1].toLowerCase();
        if (EXCLUDE_KEYWORDS.some((r) => r.test(headerTitle))) {
          hasExclude = true;
          break; // Quick exit on exclude
        }
        if (DUBBING_KEYWORDS.some((r) => r.test(headerTitle))) {
          hasMatch = true;
        }
      }

      results[page.title] = hasMatch && !hasExclude;
    }

    // Handle normalization so we can match by the requested title
    const finalResults: Record<string, boolean> = {};
    const normalizations: Record<string, string> = {};
    if (data.query?.normalized) {
      for (const norm of data.query.normalized) {
        normalizations[norm.to] = norm.from;
      }
    }

    for (const [title, result] of Object.entries(results)) {
      const originalTitle = normalizations[title] || title;
      // Map both spaced and underscored versions for safety
      finalResults[originalTitle.replace(/ /g, "_")] = result;
      finalResults[originalTitle] = result;
    }

    return finalResults;
  } catch (err) {
    console.error("[Batch Dubbing Check Error]", err);
    return Object.fromEntries(pageTitles.map((t) => [t, false]));
  }
}

async function run() {
  console.log("Starting Wikipedia Dubbing Fetcher...");

  let currentOffset = loadProgress();
  let hasMore = true;
  let totalProcessed = 0;
  let totalEnqueued = 0;

  while (hasMore) {
    const batch = await fetchMoviesFromWikidata(currentOffset);

    if (batch.length === 0) {
      console.log("No more results from Wikidata. Finished!");
      hasMore = false;
      break;
    }

    // Batch check all Wikipedia pages in one API call
    console.log(
      `[Batch] Fetching dubbing sections for ${batch.length} movies/shows...`,
    );
    const batchTitles = batch.map((b) => b.title);
    const dubbingResults = await checkDubbingSectionsBatch(batchTitles);

    for (let i = 0; i < batch.length; i++) {
      const item = batch[i];
      const humanTitle = item.title.replace(/_/g, " ");
      const hasDubbing =
        dubbingResults[item.title] || dubbingResults[humanTitle] || false;

      console.log(
        `[${
          currentOffset + i
        }] 🔍 Checked: "${humanTitle}" (TMDB: ${item.tmdbId} - ${item.mediaType}) -> ${hasDubbing ? "✅ Match" : "❌ No"}`,
      );
      console.log(`      Wiki: https://fr.wikipedia.org/wiki/${item.title}`);
      console.log(
        `      TMDB: https://www.themoviedb.org/${item.mediaType === "tv" ? "tv" : "movie"}/${item.tmdbId}`,
      );

      if (hasDubbing) {
        console.log(`  ✅ Enqueuing to pgmq...`);

        // Enqueue to supabase
        const { error } = await supabase.rpc("enqueue_media_fetch", {
          p_tmdb_id: item.tmdbId,
          p_media_type: item.mediaType,
        });

        if (error) {
          if (error.message.includes("already in the queue")) {
            console.log(`  ⏭️ "${humanTitle}" is already in queue, skipping.`);
          } else {
            console.error(
              `  ❌ Failed to enqueue "${humanTitle}":`,
              error.message,
            );
          }
        } else {
          totalEnqueued++;
        }
      }

      totalProcessed++;
    }

    // Respect Wikipedia API (since we made 1 big batch call, we can still delay slightly)
    await delay(BASE_DELAY_MS);

    currentOffset += batch.length;

    // Save progress after the entire batch is successfully processed
    saveProgress(currentOffset);
  }

  console.log(`\n--- Finished ---`);
  console.log(`Total processed: ${totalProcessed}`);
  console.log(`Total newly enqueued: ${totalEnqueued}`);
}

run().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
