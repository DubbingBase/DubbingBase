---
name: wikipedia-dubbing-corpus
description: Validate Wikipedia dubbing candidate selection, wikitext normalization, regional evidence classification, and queue evidence handling against the repository's real revision-pinned movie and show corpus.
---

# Wikipedia dubbing corpus

Use the real source cases in [the corpus guide](../../../docs/wikipedia-dubbing-corpus.md) when changing Wikipedia section selection, wikitext processing, regional evidence rules, or how the queue consumes that evidence. The guide links the selected movie/show pages and explains the expected outcomes and coverage limits.

- Read [the manifest](../../../apps/website/server/utils/fixtures/wikipedia-dubbing/manifest.json) and select the cases affected by the change. Run the existing corpus regression suite and the relevant classifier, normalization, candidate-selection, or queue tests. Passing invented examples alone is insufficient evidence for a new rule.
- For a new rule or a demonstrated gap, inspect a real page's full section context, then add a pinned case with the source URL, revision ID, raw section index, exact wikitext, SHA-256, and a manually justified expected outcome. Include an ordinary cast or ambiguous case when the rule could create false positives. If no source supports the rule, retain an unresolved outcome and document the gap.
- Validate fixture metadata offline with `mise exec -- node scripts/wikipedia-dubbing-corpus.mjs`. To compare with the exact source revision, use `mise exec -- node scripts/wikipedia-dubbing-corpus.mjs --fetch --page <id>`. Downloads go only to `scripts/scratch/wikipedia-dubbing-corpus/`; compare them before deliberately updating fixtures. Fetching never changes expected labels.
- Preserve the raw API wikitext, including headings, tables, links, references, templates, and line breaks. JSON formatting may escape newlines but must not normalize or rewrite the decoded string. Pass source sections through the production selection and processing utilities, rather than a separate fixture-only parser. Use the guide's processing pointers and test command.
- Attribute copied material to Wikipedia contributors with the revision URL and [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/). Expected classifications are repository annotations; they must follow the text's explicit dubbing evidence, not the article language or an actor's nationality.

The offline suite is the default for routine changes. Fetch new source material when adding coverage or investigating a source discrepancy; do not replace pinned revisions with the latest page automatically.
