export function buildSupabaseImageUrl(
  imagePath: string | null | undefined,
  bucket: string = "voice_actor_profile_pictures",
  _size: string = "500",
): string | null {
  if (!imagePath) return null;
  if (imagePath.startsWith("http")) return imagePath;

  const config = useRuntimeConfig();
  const supabaseUrl = config.supabaseUrl;
  return `${supabaseUrl}/storage/v1/object/public/${bucket}/${imagePath}`;
}

export const withVoiceActorImageUrl = <T extends object>(va: T) => {
  const profilePicture = Reflect.get(va, "profile_picture");
  return {
    ...va,
    profile_picture: buildSupabaseImageUrl(
      typeof profilePicture === "string" ? profilePicture : undefined,
    ),
  };
};

export const processVoiceActor = <T extends object>(va: T | null | undefined) =>
  va ? withVoiceActorImageUrl(va) : null;
