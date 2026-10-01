import { requireUser } from "../utils/auth";
import { useSupabaseAdmin } from "../utils/db/client";
import { buildSupabaseImageUrl } from "../utils/urls/supabase";

export default defineEventHandler(async (event) => {
  requireUser(event);

  try {
    const formData = await readMultipartFormData(event);
    if (!formData) {
      throw createError({ statusCode: 400, message: "No form data provided" });
    }

    const fileField = formData.find((f) => f.name === "file");
    const vaIdField = formData.find((f) => f.name === "voice_actor_id");

    if (!fileField || !fileField.data) {
      throw createError({ statusCode: 400, message: "no file" });
    }

    if (!vaIdField || !vaIdField.data) {
      throw createError({ statusCode: 400, message: "no vaId" });
    }

    const vaId = vaIdField.data.toString();
    const filename = fileField.filename || "upload.jpg";
    const fileExt = filename.split(".").pop() || "jpg";
    const filePath = `${vaId}.${fileExt}`;

    const supabaseAdmin = useSupabaseAdmin();

    const { data, error } = await supabaseAdmin.storage
      .from("voice_actor_profile_pictures")
      .upload(filePath, fileField.data, { upsert: true });

    if (error) {
      console.error("error uploading profile picture:", error);
      throw createError({ statusCode: 500, message: error.message });
    }

    const { error: updateError } = await supabaseAdmin
      .from("voice_actors")
      .update({
        profile_picture: data.path,
      })
      .eq("id", Number(vaId));

    if (updateError) {
      console.error("error updating voice actor profile picture:", updateError);
    }

    return {
      ok: true,
      fullPath: data.path,
      publicUrl: buildSupabaseImageUrl(data.path),
    };
  } catch (err) {
    console.error("Error in upload_profile_picture:", err);
    if (err instanceof Error && "statusCode" in err) throw err;
    throw createError({
      statusCode: 500,
      message: err instanceof Error ? err.message : String(err),
    });
  }
});
