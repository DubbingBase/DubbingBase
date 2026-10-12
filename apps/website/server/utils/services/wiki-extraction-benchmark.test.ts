import { describe, expect, it } from "vitest";
import { buildWikipediaExtractionBatches } from "./wiki-extraction-batching";

const fixture = [
  {
    index: 8,
    heading: "Version française",
    wikitext:
      '{| class="wikitable"\n| Personnage || Comédien || Voix française\n| Alice || Actor One || Dubber A\n|}\n',
  },
  {
    index: 11,
    heading: "Version québécoise",
    wikitext:
      '{| class="wikitable"\n| Personnage || Comédien || Voix québécoise\n| Bob || Actor Two || Dubber B\n|}\n',
  },
  {
    index: 14,
    heading: "Additional French cast",
    wikitext:
      '{| class="wikitable"\n| Character || Actor || Voice\n| Carol || Actor Three || Dubber C\n|}\n',
  },
];

const fixtureSystemPrompt =
  "Extract target-region dubbing credits. Preserve source section boundaries and actor mappings. ".repeat(
    8,
  );

describe("Wikipedia extraction fixture benchmark", () => {
  it("compares deterministic call-count and prompt-size proxies", () => {
    const batches = buildWikipediaExtractionBatches(fixture);
    expect(batches).toHaveLength(1);

    const modeledBeforePromptChars = fixture.reduce(
      (total, section) => total + fixtureSystemPrompt.length + section.wikitext.length,
      0,
    );
    const afterPromptChars = batches.reduce(
      (total, batch) => total + fixtureSystemPrompt.length + batch.prompt.length,
      0,
    );
    const metrics = {
      fixture: "three regional cast sections; deterministic structure-only comparison",
      before: {
        llmCalls: fixture.length,
        estimatedInputTokens: Math.ceil(modeledBeforePromptChars / 4),
      },
      after: {
        llmCalls: batches.length,
        estimatedInputTokens: Math.ceil(afterPromptChars / 4),
      },
    };
    console.info(`[wiki-extraction-benchmark] ${JSON.stringify(metrics)}`);

    expect(metrics.after.llmCalls).toBe(1);
    expect(metrics.after.estimatedInputTokens).toBeLessThan(metrics.before.estimatedInputTokens);
  });
});
