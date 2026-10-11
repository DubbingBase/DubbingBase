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

function median(values: number[]): number {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

describe("Wikipedia extraction fixture benchmark", () => {
  it("compares per-section extraction with bounded concurrent batching", async () => {
    const batches = buildWikipediaExtractionBatches(fixture);
    expect(batches).toHaveLength(1);

    const beforeDurations: number[] = [];
    const afterDurations: number[] = [];
    const repetitions = 5;

    for (let repetition = 0; repetition < repetitions; repetition += 1) {
      let startedAt = performance.now();
      await delay(2); // prior TOC refresh
      for (const section of fixture) {
        await delay(2); // prior sequential section request
        await delay(5); // prior per-section LLM call
        expect(section.wikitext.length).toBeGreaterThan(0);
      }
      beforeDurations.push(performance.now() - startedAt);

      startedAt = performance.now();
      await Promise.all(fixture.map(() => delay(2))); // concurrent section requests
      await delay(5); // one batched LLM call
      afterDurations.push(performance.now() - startedAt);
    }

    const beforePromptChars = fixture.reduce(
      (total, section) => total + fixtureSystemPrompt.length + section.wikitext.length,
      0,
    );
    const afterPromptChars = batches.reduce(
      (total, batch) => total + fixtureSystemPrompt.length + batch.prompt.length,
      0,
    );
    const metrics = {
      fixture: "three regional cast sections; mocked 2ms Wikipedia / 5ms LLM latency",
      repetitions,
      before: {
        llmCalls: fixture.length,
        wikipediaRequests: fixture.length + 1,
        estimatedInputTokens: Math.ceil(beforePromptChars / 4),
        medianDurationMs: Number(median(beforeDurations).toFixed(2)),
      },
      after: {
        llmCalls: batches.length,
        wikipediaRequests: fixture.length,
        estimatedInputTokens: Math.ceil(afterPromptChars / 4),
        medianDurationMs: Number(median(afterDurations).toFixed(2)),
      },
    };
    console.info(`[wiki-extraction-benchmark] ${JSON.stringify(metrics)}`);

    expect(metrics.after.llmCalls).toBe(1);
    expect(metrics.after.wikipediaRequests).toBe(metrics.before.wikipediaRequests - 1);
    expect(metrics.after.estimatedInputTokens).toBeLessThan(metrics.before.estimatedInputTokens);
    expect(metrics.after.medianDurationMs).toBeLessThan(metrics.before.medianDurationMs);
  });
});
