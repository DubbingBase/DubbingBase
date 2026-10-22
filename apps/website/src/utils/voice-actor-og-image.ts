export function isVoiceActorOgImagesEnabled(value: boolean | string): boolean {
  return String(value).toLowerCase() === "true";
}

export type VoiceActorOgImageMetadata = {
  url: string;
  width: number;
  height: number;
  twitterCard: "summary" | "summary_large_image";
};

export function getVoiceActorOgImageMetadata(
  enabled: boolean,
  voiceActorId: number,
  siteUrl: string,
): VoiceActorOgImageMetadata {
  if (!enabled || !Number.isSafeInteger(voiceActorId) || voiceActorId <= 0) {
    return {
      url: new URL("/android-chrome-512x512.png", siteUrl).href,
      width: 512,
      height: 512,
      twitterCard: "summary",
    };
  }

  return {
    url: new URL(`/api/og-image?type=voice-actor&id=${voiceActorId}`, siteUrl).href,
    width: 1200,
    height: 630,
    twitterCard: "summary_large_image",
  };
}
