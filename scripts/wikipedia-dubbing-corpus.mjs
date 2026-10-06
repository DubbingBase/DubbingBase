#!/usr/bin/env node

import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const defaultManifest = join(
  root,
  "apps/website/server/utils/fixtures/wikipedia-dubbing/manifest.json",
);
const help = `Usage: mise exec -- node scripts/wikipedia-dubbing-corpus.mjs [manifest.json] [--fetch] [--page <id>]

Default: validate the pinned corpus offline (metadata, expectations, and hashes).
--fetch: download pinned TOC and raw sections to scripts/scratch/wikipedia-dubbing-corpus/.
--page: limit validation/downloads to one manifest page ID.
Downloads never overwrite fixtures or expected labels.
Source material: Wikipedia contributors, CC BY-SA 4.0; see each revision URL.
API: https://www.mediawiki.org/wiki/API:Parsing_wikitext
`;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function hash(text) {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

function validateExpected(expected, label) {
  assert(
    expected && typeof expected === "object",
    `${label}: missing expected outcome`,
  );
  assert(
    Array.isArray(expected.resolved),
    `${label}: expected.resolved must be an array`,
  );
  assert(
    Array.isArray(expected.unresolved),
    `${label}: expected.unresolved must be an array`,
  );
  for (const result of [...expected.resolved, ...expected.unresolved]) {
    assert(
      Array.isArray(result.sectionIndexes) &&
        result.sectionIndexes.every(
          (index) => Number.isSafeInteger(index) && index >= 0,
        ),
      `${label}: outcome sectionIndexes must be nonnegative integers`,
    );
  }
  for (const result of expected.resolved) {
    assert(
      typeof result.language === "string" && result.language.length > 0,
      `${label}: resolved language missing`,
    );
  }
  for (const result of expected.unresolved) {
    assert(
      typeof result.reason === "string" && result.reason.length > 0,
      `${label}: unresolved reason missing`,
    );
  }
}

function validatePage(page) {
  assert(
    typeof page.id === "string" && /^[a-z0-9-]+$/.test(page.id),
    "Page ID must contain lowercase letters, digits, or hyphens",
  );
  assert(
    typeof page.language === "string" &&
      /^[a-z][a-z0-9-]*$/.test(page.language),
    `${page.id}: invalid Wikipedia language`,
  );
  assert(
    typeof page.title === "string" && page.title.length > 0,
    `${page.id}: missing title`,
  );
  assert(
    Number.isSafeInteger(page.revisionId) && page.revisionId > 0,
    `${page.id}: invalid revision ID`,
  );
  assert(
    ["movie", "show"].includes(page.kind),
    `${page.id}: kind must be movie or show`,
  );
  const source = new URL(page.url);
  assert(
    source.protocol === "https:" &&
      source.hostname === `${page.language}.wikipedia.org`,
    `${page.id}: source must be its Wikipedia edition`,
  );
  assert(
    source.searchParams.get("oldid") === String(page.revisionId),
    `${page.id}: source URL must pin revisionId with oldid`,
  );
  assert(
    Array.isArray(page.sections) && page.sections.length > 0,
    `${page.id}: no source sections`,
  );
  const indexes = new Set();
  for (const section of page.sections) {
    const label = `${page.id}/${section.index}`;
    assert(
      Number.isSafeInteger(section.index) && section.index >= 0,
      `${label}: section index must be a nonnegative integer`,
    );
    assert(!indexes.has(section.index), `${label}: duplicate section index`);
    indexes.add(section.index);
    assert(
      typeof section.heading === "string" && section.heading.length > 0,
      `${label}: missing heading`,
    );
    assert(
      typeof section.wikitext === "string" && section.wikitext.length > 0,
      `${label}: missing raw wikitext`,
    );
    if (section.sha256 !== undefined) {
      assert(
        typeof section.sha256 === "string" &&
          /^[a-f0-9]{64}$/.test(section.sha256),
        `${label}: invalid SHA-256`,
      );
      assert(
        section.sha256 === hash(section.wikitext),
        `${label}: raw wikitext SHA-256 mismatch`,
      );
    }
    validateExpected(section.expected, label);
    for (const result of [
      ...section.expected.resolved,
      ...section.expected.unresolved,
    ]) {
      assert(
        result.sectionIndexes.every((index) =>
          page.sections.some((entry) => entry.index === index),
        ),
        `${label}: outcome refers to an absent section`,
      );
    }
  }
}

async function parse(page, properties, section) {
  const url = new URL(`https://${page.language}.wikipedia.org/w/api.php`);
  url.search = new URLSearchParams({
    action: "parse",
    oldid: String(page.revisionId),
    prop: properties,
    format: "json",
    formatversion: "2",
    ...(section === undefined ? {} : { section: String(section) }),
  }).toString();
  const response = await fetch(url, {
    headers: {
      "User-Agent":
        "DubbingBaseWikipediaCorpus/1.0 (https://github.com/DubbingBase; offline regression corpus)",
    },
    signal: AbortSignal.timeout(30000),
  });
  assert(response.ok, `${page.id}: HTTP ${response.status} (${url})`);
  const body = await response.json();
  assert(
    !body.error,
    `${page.id}: Wikipedia API error ${body.error?.code}: ${body.error?.info}`,
  );
  assert(
    body.parse && body.parse.revid === page.revisionId,
    `${page.id}: API returned the wrong revision`,
  );
  return body;
}

async function fetchPage(page) {
  const directory = join(
    root,
    "scripts/scratch/wikipedia-dubbing-corpus",
    page.id,
  );
  await mkdir(directory, { recursive: true });
  const toc = await parse(page, "tocdata|revid");
  assert(
    Array.isArray(toc.parse.tocdata?.sections),
    `${page.id}: missing TOC sections`,
  );
  await writeFile(
    join(directory, "tocdata.json"),
    `${JSON.stringify(toc, null, 2)}\n`,
  );
  for (const section of page.sections) {
    assert(
      toc.parse.tocdata.sections.some(
        (entry) => String(entry.index) === String(section.index),
      ),
      `${page.id}/${section.index}: pinned TOC has no matching index`,
    );
    const body = await parse(page, "wikitext|revid", section.index);
    assert(
      typeof body.parse.wikitext === "string",
      `${page.id}/${section.index}: missing raw wikitext`,
    );
    await writeFile(
      join(directory, `section-${section.index}.json`),
      `${JSON.stringify(body, null, 2)}\n`,
    );
    await writeFile(
      join(directory, `section-${section.index}.wikitext`),
      body.parse.wikitext,
    );
    const matches = hash(body.parse.wikitext) === hash(section.wikitext);
    assert(
      matches,
      `${page.id}/${section.index}: downloaded source differs from the fixture; inspect ${directory}`,
    );
  }
  await writeFile(
    join(directory, "source.json"),
    `${JSON.stringify(
      {
        title: page.title,
        revisionId: page.revisionId,
        url: page.url,
        attribution: "Wikipedia contributors",
        license: "https://creativecommons.org/licenses/by-sa/4.0/",
      },
      null,
      2,
    )}\n`,
  );
  console.log(`${page.id}: pinned source matches (${page.url})`);
}

async function main() {
  const args = process.argv.slice(2);
  let manifestPath = defaultManifest;
  let manifestGiven = false;
  let shouldFetch = false;
  let pageId;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--help" || args[i] === "-h") {
      console.log(help);
      return;
    }
    if (args[i] === "--fetch") shouldFetch = true;
    else if (args[i] === "--page") {
      pageId = args[++i];
      assert(pageId && !pageId.startsWith("-"), "--page needs a manifest ID");
    } else {
      assert(
        !args[i].startsWith("-") && !manifestGiven,
        `Unexpected argument: ${args[i]}`,
      );
      manifestPath = resolve(args[i]);
      manifestGiven = true;
    }
  }
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  assert(
    manifest.schemaVersion === 1 && Array.isArray(manifest.pages),
    "Expected schemaVersion: 1 and pages array",
  );
  assert(manifest.pages.length > 0, "Corpus has no pages");
  const ids = new Set();
  for (const page of manifest.pages) {
    assert(!ids.has(page.id), `Duplicate page ID: ${page.id}`);
    ids.add(page.id);
  }
  const pages = pageId
    ? manifest.pages.filter((page) => page.id === pageId)
    : manifest.pages;
  assert(pages.length > 0, `No manifest page found: ${pageId}`);
  for (const page of pages) validatePage(page);
  console.log(
    `Validated ${pages.length} pinned pages offline (${pages.reduce((count, page) => count + page.sections.length, 0)} sections).`,
  );
  if (shouldFetch) for (const page of pages) await fetchPage(page);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
