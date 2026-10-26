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

export function processVoiceActor<T extends { profile_picture?: string | null }>(
  va: T | null | undefined,
):
  | (Omit<T, "profile_picture"> & {
      profile_picture: string | null;
    })
  | null {
  if (!va) return null;
  return {
    ...va,
    profile_picture: buildSupabaseImageUrl(va.profile_picture),
  };
}
