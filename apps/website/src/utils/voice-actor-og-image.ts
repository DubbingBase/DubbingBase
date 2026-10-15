const SITE_ORIGIN = "https://dubbingbase.com";

export const STATIC_VOICE_ACTOR_OG_IMAGE_URL = `${SITE_ORIGIN}/android-chrome-512x512.png`;

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
): VoiceActorOgImageMetadata {
  if (!enabled || !Number.isSafeInteger(voiceActorId) || voiceActorId <= 0) {
    return {
      url: STATIC_VOICE_ACTOR_OG_IMAGE_URL,
      width: 512,
      height: 512,
      twitterCard: "summary",
    };
  }

  return {
    url: `${SITE_ORIGIN}/api/og-image?type=voice-actor&id=${voiceActorId}`,
    width: 1200,
    height: 630,
    twitterCard: "summary_large_image",
  };
}
