import { useSupabaseAdmin } from "./client";

export async function findOrCreateDubbingProject(
  contentId: number,
  contentType: string,
): Promise<number> {
  const supabase = useSupabaseAdmin();

  const { data: existing } = await supabase
    .from("dubbing_projects")
    .select("id")
    .eq("content_id", contentId)
    .eq("content_type", contentType)
    .limit(1)
    .maybeSingle();

  if (existing) {
    return existing.id;
  }

  const { data: newProject, error } = await supabase
    .from("dubbing_projects")
    .insert({
      content_id: contentId,
      content_type: contentType,
      language: "fr",
    })
    .select("id")
    .single();

  if (error) throw error;
  return newProject.id;
}
