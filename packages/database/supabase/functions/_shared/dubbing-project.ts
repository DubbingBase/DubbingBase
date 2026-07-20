import { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { Database } from "./database.types.ts";

/**
 * Finds an existing dubbing project for the given content or creates a new one
 * with the default language 'fr'.
 */
export async function findOrCreateDubbingProject(
  supabase: SupabaseClient<Database>,
  contentId: number,
  contentType: string,
): Promise<number> {
  const { data: project, error: lookupError } = await supabase
    .from("dubbing_projects")
    .select("id")
    .eq("content_id", contentId)
    .eq("content_type", contentType)
    .limit(1)
    .maybeSingle();

  if (lookupError) {
    console.error("Error looking up dubbing project:", lookupError);
    throw lookupError;
  }

  if (project) {
    return project.id;
  }

  // Create new dubbing project
  const { data: newProject, error: insertError } = await supabase
    .from("dubbing_projects")
    .insert({
      content_id: contentId,
      content_type: contentType,
      language: "fr",
    })
    .select("id")
    .single();

  if (insertError) {
    console.error("Error creating dubbing project:", insertError);
    throw insertError;
  }

  return newProject.id;
}
