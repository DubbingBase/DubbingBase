import { performance } from "node:perf_hooks";

const languages = ["fr", "en", "ja", "de", "es", "pt-BR", "ru", "zh-Hans"];

function oldRequest(locale, codes, missingFallback) {
  return codes.map((code) => {
    if (!code) return missingFallback;
    try {
      const names = new Intl.DisplayNames([locale || "en"], { type: "language" });
      const name = names.of(code);
      return typeof name === "string" && name.length > 0
        ? name.charAt(0).toUpperCase() + name.slice(1)
        : code;
    } catch {
      return code;
    }
  });
}

function cachedRequest(locale, codes, missingFallback) {
  let names;
  try {
    names = new Intl.DisplayNames([locale || "en"], { type: "language" });
  } catch {
    names = undefined;
  }
  return codes.map((code) => {
    if (!code) return missingFallback;
    try {
      const name = names?.of(code);
      return typeof name === "string" && name.length > 0
        ? name.charAt(0).toUpperCase() + name.slice(1)
        : code;
    } catch {
      return code;
    }
  });
}

function measure(fn, locale, codes, missingFallback, iterations) {
  const samples = [];
  let checksum = 0;
  for (let index = 0; index < iterations; index += 1) {
    const start = performance.now();
    const result = fn(locale, codes, missingFallback);
    samples.push(performance.now() - start);
    for (const value of result) checksum += value.length;
  }
  samples.sort((left, right) => left - right);
  return { medianMs: samples[Math.floor(samples.length / 2)], checksum };
}

for (const locale of ["fr-FR", "invalid_locale"] ) {
  for (const [label, codes, missingFallback] of [
    ["8 languages", languages, "Unknown"],
    ["7 languages + missing", [...languages.slice(0, 7), null], "Not specified"],
  ]) {
    const equivalent =
      JSON.stringify(oldRequest(locale, codes, missingFallback)) ===
      JSON.stringify(cachedRequest(locale, codes, missingFallback));
    if (!equivalent) throw new Error(`Output mismatch for ${locale}: ${label}`);
    const iterations = 10_000;
    measure(oldRequest, locale, codes, missingFallback, 500);
    measure(cachedRequest, locale, codes, missingFallback, 500);
    const old = measure(oldRequest, locale, codes, missingFallback, iterations);
    const cached = measure(cachedRequest, locale, codes, missingFallback, iterations);
    if (old.checksum !== cached.checksum) {
      throw new Error(`Checksum mismatch for ${locale}: ${label}`);
    }
    console.log(
      JSON.stringify({
        locale,
        scenario: label,
        iterations,
        equivalent,
        checksumEquivalent: old.checksum === cached.checksum,
        oldMedianMs: old.medianMs,
        cachedMedianMs: cached.medianMs,
        speedup: old.medianMs / cached.medianMs,
      }),
    );
  }
}
