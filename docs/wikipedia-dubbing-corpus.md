# Real Wikipedia dubbing corpus

Inspected on 2026-10-06. This is a deliberately selected regression corpus, not a random sample or a measurement of accuracy across Wikipedia. It contains 16 movie/show pages from three editions and 23 selected sections. Expected outcomes were annotated from source text before classifier changes.

## Relevant pages

Each link opens the captured revision, not the changing current article. Copied source is attributed to Wikipedia contributors under [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/).

| Edition / kind | Revision-pinned page                                                                                                                                       | Why it belongs                                                                                                                     |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| fr / movie     | [Titanic (film, 1997)](https://fr.wikipedia.org/w/index.php?title=Titanic_%28film%2C_1997%29&oldid=240016512)                                              | Named VF/VQ parameters in Doublage templates; both regions in the same selected parent.                                            |
| fr / movie     | [La Reine des neiges (film, 2013)](https://fr.wikipedia.org/w/index.php?title=La_Reine_des_neiges_%28film%2C_2013%29&oldid=239541302)                      | Original voices are negative; French and Quebec voice subsections contain actor–role lists.                                        |
| fr / show      | [South Park](https://fr.wikipedia.org/w/index.php?title=South_Park&oldid=240115397)                                                                        | Several independently labeled French/Quebec credit groups in one Distribution section.                                             |
| fr / show      | [Breaking Bad](https://fr.wikipedia.org/w/index.php?title=Breaking_Bad&oldid=239958998)                                                                    | Inline French voice credits in the original actor list; the principal-character child preserves credits inside a colonnes wrapper. |
| fr / show      | [Les Simpson](https://fr.wikipedia.org/w/index.php?title=Les_Simpson&oldid=239880210)                                                                      | Original, French, and Quebec voice columns; character names occur as row headers.                                                  |
| fr / show      | [Over There (série télévisée)](https://fr.wikipedia.org/w/index.php?title=Over_There_%28s%C3%A9rie_t%C3%A9l%C3%A9vis%C3%A9e%29&oldid=233070359)            | Actual VF template credits, alongside dubbing production metadata.                                                                 |
| fr / movie     | [Digger (film, 2026)](https://fr.wikipedia.org/w/index.php?title=Digger_%28film%2C_2026%29&oldid=240100243)                                                | Current revision has actual VF credits. It is not the historical no-dubbing example.                                               |
| fr / movie     | [The Uprising](https://fr.wikipedia.org/w/index.php?title=The_Uprising&oldid=239445697)                                                                    | Ordinary original actor/role credits; no regional dubbing evidence.                                                                |
| pt / movie     | [Alice Through the Looking Glass (filme)](https://pt.wikipedia.org/w/index.php?title=Alice%20Through%20the%20Looking%20Glass%20%28filme%29&oldid=71753041) | Original/Brasil/Portugal columns with actual separate actor credits and flag templates.                                            |
| pt / movie     | [Toy Story 3](https://pt.wikipedia.org/w/index.php?title=Toy%20Story%203&oldid=73045655)                                                                   | Original voices (including PBPE2 translated character names) are negative; Versão brasileira is positive.                          |
| pt / show      | [Abby Hatcher](https://pt.wikipedia.org/w/index.php?title=Abby%20Hatcher&oldid=70633227)                                                                   | Original character descriptions are negative; explicit Brazilian dubbing table is positive.                                        |
| pt / movie     | [Son excellence Antonin](https://pt.wikipedia.org/w/index.php?title=Son%20excellence%20Antonin&oldid=71805460)                                             | Original Elenco is negative; Dobragem portuguesa lists actual voices.                                                              |
| es / movie     | [La llegada](https://es.wikipedia.org/w/index.php?title=La%20llegada&oldid=174446532)                                                                      | Spain table and Hispanoamérica actor list are separately introduced within one section.                                            |
| es / show      | [Count Duckula](https://es.wikipedia.org/w/index.php?title=Count%20Duckula&oldid=172368481)                                                                | Original actor list followed by separate Spain and Hispanoamérica version subsections.                                             |
| es / show      | [Columbo](https://es.wikipedia.org/w/index.php?title=Columbo&oldid=175673605)                                                                              | Spain credits plus explicitly named Catalan/Galician version performers: ca-ES and es-ES resolve; Galician stays unsupported.      |
| es / show      | [Babylon 5](https://es.wikipedia.org/w/index.php?title=Babylon%205&oldid=174996339)                                                                        | Separate Castellano, Catalán and Mexicano credit tables. Catalan is a supported ca-ES target, not Spanish.                         |

## Source format and acquisition

The tracked [manifest](../apps/website/server/utils/fixtures/wikipedia-dubbing/manifest.json) contains `schemaVersion`, source attribution, and `pages`. Each page records its ID, edition, title, revision ID, permanent URL and movie/show kind. Each section records its numeric index, heading, decoded raw `wikitext`, acquisition method, UTF-8 SHA-256, candidate-selection expectation, and independently annotated `expected.resolved` / `expected.unresolved` arrays. Section indexes in expected results are numeric and refer to the captured parent section; nested versions can share that index.

Use `action=parse&oldid=<revision>&prop=tocdata|revid&formatversion=2` to identify sections at the pinned revision, then `action=parse&oldid=<revision>&section=<index>&prop=wikitext|revid&formatversion=2` to obtain the raw section. Verify returned revision IDs. Do not slice using MediaWiki byte offsets as JavaScript string offsets: UTF-8 and parser transformations can misalign them. Parent section payloads include nested subsections. Preserve decoded text exactly, including templates, links, references and line breaks; only JSON escaping/formatting may change.

`acquisition: revision-section-api` means a direct pinned section response. `revision-wikitext-heading-slice`, if present, explicitly denotes a heading-boundary slice of pinned full-page wikitext rather than a section response; source comparison can detect differences such as trailing blank lines. Do not disguise derived text as an API payload.

API reference: [MediaWiki parsing wikitext](https://www.mediawiki.org/wiki/API:Parsing_wikitext).

## Process and validate

From the repository root:

```sh
mise exec -- node scripts/wikipedia-dubbing-corpus.mjs
mise exec -- pnpm --filter @app/website exec vitest run server/utils/dubbing-region-corpus.test.ts server/utils/dubbing-region-detection.test.ts server/utils/cache/wikipedia.test.ts
```

The suite also tests an unchanged production/source-note fragment from Over There as a negative case; this is explicitly a fragment, not an extra complete section or a claim that the full page lacks dubbed credits.

The offline suite imports the manifest and calls production `selectDubbingCandidateSections` and `detectDubbingRegionFromWikitext`; it verifies source hashes and repeats classifications with another edition label to detect edition-based guessing. The helper checks metadata and expectations without network access. For a source discrepancy or new case:

```sh
mise exec -- node scripts/wikipedia-dubbing-corpus.mjs --fetch --page fr-titanic
```

Downloads go to ignored `scripts/scratch/wikipedia-dubbing-corpus/`. Fetching never changes expected labels or tracked source. Compare the response before deliberately updating text, revision, hash and annotation together. Respect Wikimedia Retry-After responses; avoid repeated parallel requests.

Production processing pointers:

- `apps/website/server/utils/cache/wikipedia.ts`: candidate heading selection and raw section fetching. Candidate selection does not prove dubbing exists.
- `apps/website/server/utils/dubbing-region-detection.ts`: preserves meaningful credit syntax, classifies explicit regional evidence, and returns selected source indexes.
- `apps/website/server/api/process-media-queue.post.ts` in the next stacked PR: consumes resolved/unresolved evidence and queues each supported target.
- `apps/website/server/utils/services/media-preparation.ts` in the next stacked PR: extracts only the requested target version from shared sections, excluding original cast and other regional versions.
- `.agents/skills/wikipedia-dubbing-corpus/SKILL.md`: when to run and extend this corpus.

## Interpretation and coverage limits

VF → fr-FR, VQ → fr-CA, and explicit Hispanoamérica/LATAM → es-MX are existing application target conventions. LATAM evidence does not prove a dub was made in Mexico, and VF does not prove the studio location. No edition, actor nationality, production studio or translated character name establishes a regional dub.

Tables and subsections may legitimately contain several versions. Different labeled voice columns, VF/VQ credit parameters, or separate version blocks must not be treated as contradictory claims about one credit. A caption for a Catalan table cannot be inherited as Spanish merely because its parent heading says España. Source notes and production credits alone do not establish actor/character dubbing credits.

Columbo supplies actual unsupported Galician-version evidence. This corpus does not empirically validate Belgian French markers or the existing unsupported Spanish-market markers. Those retain synthetic unit coverage; do not describe them as validated on real pages. Other editions, rare templates, and ambiguous layouts remain outside this sample. Add real cases when extending those rules.

These regressions validate deterministic candidate selection and classification. Candidate-selection checks cover retained source headings, not every heading on every page or a measured false-selection rate. They do not prove downstream LLM extraction accuracy: target filtering in mixed-version tables still requires extraction-specific verification when that code changes.
