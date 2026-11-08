export type ShareDub = number | "original" | null | undefined;

interface ShareUrlInput {
  siteUrl: string;
  path: string;
  dub?: ShareDub;
  /** Query parameters required for the page to resolve its entity (e.g. TVDB characters). */
  keepQuery?: Record<string, string | undefined>;
}

/**
 * Builds the absolute public URL to share: the localized route path, a valid `dub`
 * selection only, and no hash or unrelated transient query parameters.
 */
export function buildShareUrl({ siteUrl, path, dub, keepQuery }: ShareUrlInput): string {
  const url = new URL(path, siteUrl);
  url.search = "";
  url.hash = "";
  for (const [key, value] of Object.entries(keepQuery ?? {})) {
    if (value) url.searchParams.set(key, value);
  }
  if (dub === "original" || (typeof dub === "number" && Number.isSafeInteger(dub) && dub > 0)) {
    url.searchParams.set("dub", String(dub));
  }
  return url.href;
}

export type ShareOutcome = "shared" | "copied" | "cancelled" | "manual";

interface ShareDeps {
  share?: (data: { title: string; url: string }) => Promise<void>;
  writeText?: (text: string) => Promise<void>;
}

/** Must be called synchronously from a user gesture. */
export async function shareUrl(
  title: string,
  url: string,
  { share, writeText }: ShareDeps,
): Promise<ShareOutcome> {
  if (share) {
    try {
      await share({ title, url });
      return "shared";
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return "cancelled";
      // Other failures (e.g. NotAllowedError): fall through to copying the link.
    }
  }
  if (writeText) {
    try {
      await writeText(url);
      return "copied";
    } catch {
      return "manual";
    }
  }
  return "manual";
}
