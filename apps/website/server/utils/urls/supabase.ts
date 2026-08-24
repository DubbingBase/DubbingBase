export function buildSupabaseImageUrl(
  imagePath: string | null | undefined,
  bucket: string = "voice_actor_profile_pictures",
  size: string = "500",
): string | null {
  if (!imagePath) return null;
  if (imagePath.startsWith("http")) return imagePath;

  const config = useRuntimeConfig();
  const supabaseUrl = config.supabaseUrl;
  return `${supabaseUrl}/storage/v1/object/public/${bucket}/${imagePath}`;
}

export const processVoiceActor = (va: any) => {
  if (!va) return null;
  return {
    ...va,
    profile_picture: buildSupabaseImageUrl(va.profile_picture),
  };
};
