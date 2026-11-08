// Read-only TMDB diagnostic for 56365-135. Usage: doppler run -p dubbingbase -c dev -- node this.mjs
const key = process.env.TMDB_API_KEY;
const base = "https://api.themoviedb.org/3";
async function get(path, params = {}) {
  const url = new URL(`${base}/${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const t = performance.now();
  const r = await fetch(url, {
    headers: { Authorization: `Bearer ${key}`, Accept: "application/json" },
  });
  const j = await r.json();
  return { j, ms: Math.round(performance.now() - t) };
}
const label = (i) =>
  `${i.media_type ?? "movie"}:${i.id} ${i.title ?? i.name} (${(i.release_date ?? i.first_air_date ?? "").slice(0, 4)}) pop=${i.popularity} votes=${i.vote_count}`;
for (const q of ["Watch Out", "Better Watch Out"]) {
  console.log(`\n=== multi "${q}" en-US`);
  for (const page of [1, 2]) {
    const { j, ms } = await get("search/multi", { query: q, page, language: "en-US" });
    console.log(`page ${page} (${ms}ms) total=${j.total_results}`);
    j.results.forEach((i, n) => console.log(`  ${n + 1}. ${label(i)}`));
  }
  const { j, ms } = await get("search/movie", { query: q, page: 1, language: "en-US" });
  console.log(`search/movie p1 (${ms}ms) total=${j.total_results}`);
  j.results
    .slice(0, 10)
    .forEach((i, n) => console.log(`  ${n + 1}. ${label({ ...i, media_type: "movie" })}`));
}
const { j: tr, ms } = await get("movie/406994/translations");
console.log(`\ntranslations 406994 (${ms}ms)`);
tr.translations.forEach((t) => console.log(`  ${t.iso_639_1}-${t.iso_3166_1}: ${t.data.title}`));
const { j: alt, ms: ms2 } = await get("movie/406994/alternative_titles");
console.log(`\nalternative_titles (${ms2}ms)`);
alt.titles.forEach((t) => console.log(`  ${t.iso_3166_1}: ${t.title} [${t.type}]`));
const { j: ap, ms: ms3 } = await get("movie/406994", {
  language: "en-US",
  append_to_response: "alternative_titles,translations",
});
console.log(
  `\nappend_to_response (${ms3}ms) title=${ap.title} orig=${ap.original_title} pop=${ap.popularity} votes=${ap.vote_count}`,
);
