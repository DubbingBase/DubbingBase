import { withSupabase } from "npm:@supabase/server@^1";
import { Database } from "../_shared/database.types.ts";
import { buildSupabaseImageUrl } from "../_shared/supabase-urls.ts";

export default {
  fetch: withSupabase<Database>({ auth: "user" }, async (req, ctx) => {
    try {
      const formData = await req.formData();

      console.log("formData", formData);

      const file = formData.get("file") as File;
      const vaId = formData.get("voice_actor_id") as string;

      if (!file) {
        throw new Error("no file");
      }

      if (!vaId) {
        throw new Error("no vaId");
      }

      console.log("file", file);

      const { data, error } = await ctx.supabase.storage
        .from("voice_actor_profile_pictures")
        .upload(file.name, file);
      if (error) {
        console.error("error", error);
        return Response.json({ error: error.message }, { status: 500 });
      }
      console.log("data", data);
      console.log("error", error);

      const { data: data2, error: error2 } = await ctx.supabase
        .from("voice_actors")
        .update({
          profile_picture: data.path,
        })
        .eq("id", Number(vaId))
        .single();

      console.log("data2", data2);
      console.log("error2", error2);

      return Response.json({
        ok: true,
        fullPath: data.path,
        publicUrl: buildSupabaseImageUrl(ctx, data.path),
      });
    } catch (err) {
      console.error("Error in upload_profile_picture:", err);
      return Response.json(
        { error: err instanceof Error ? err.message : String(err) },
        { status: 500 },
      );
    }
  }),
};
