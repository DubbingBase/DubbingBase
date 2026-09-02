import { requireUser } from "../utils/auth";
import { useSupabaseAdmin } from "../utils/db/client";

export default defineEventHandler(async (event) => {
  const user = requireUser(event);

  const isAdmin =
    user.app_metadata?.role === "admin" ||
    user.user_metadata?.role === "admin" ||
    (user as any).role === "admin";

  if (!isAdmin) {
    throw createError({
      statusCode: 403,
      message: "Admin access required to create internal media records",
    });
  }

  const body = await readBody(event);
  const { media_type, name, brand, manufacturer, description, language } = body;

  if (!media_type || !name) {
    throw createError({
      statusCode: 400,
      message: "media_type and name are required",
    });
  }

  const validInternalTypes = ["advertisement", "toy"];
  if (!validInternalTypes.includes(media_type)) {
    throw createError({
      statusCode: 400,
      message: `Can only create internal records for: ${validInternalTypes.join(", ")}. For other types, search for existing entries instead.`,
    });
  }

  const supabase = useSupabaseAdmin();

  // Generate content_id for internal types (ad/toy).
  // Use negative IDs — external APIs (TMDB, IGDB, OpenLibrary) are always positive,
  // so there's zero collision risk without any magic numbers or sequences.
  const { data: minRow } = await supabase
    .from("dubbing_projects")
    .select("content_id")
    .eq("content_type", media_type)
    .order("content_id", { ascending: true })
    .limit(1)
    .maybeSingle();

  const newContentId = minRow ? Number(minRow.content_id) - 1 : -1;

  const { data: newProject, error } = await supabase
    .from("dubbing_projects")
    .insert({
      content_id: newContentId,
      content_type: media_type,
      language: language || "fr",
      status: "validated",
    })
    .select()
    .single();

  if (error) throw error;

  return {
    media: {
      id: newProject.content_id,
      content_id: newProject.content_id,
      project_id: newProject.id,
      title: name,
      name,
      media_type,
      brand: brand || null,
      manufacturer: manufacturer || null,
      description: description || null,
    },
  };
});
