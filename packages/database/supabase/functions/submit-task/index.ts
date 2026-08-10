import { withSupabase } from "npm:@supabase/server@^1";
import { Database } from "../_shared/database.types.ts";

export default {
  fetch: withSupabase<Database>({ auth: "user" }, async (req, ctx) => {
    try {
      const user = ctx.userClaims;
      if (!user) {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
      }

      if (req.method !== "POST") {
        return Response.json({ error: "Method not allowed" }, { status: 405 });
      }

      // Handle multipart form data for file uploads
      const contentType = req.headers.get("content-type") || "";
      if (!contentType.includes("multipart/form-data")) {
        return Response.json(
          { error: "Content type must be multipart/form-data" },
          { status: 400 },
        );
      }

      const formData = await req.formData();
      const category = formData.get("category")?.toString();
      const entityId = formData.get("entityId")?.toString();

      if (!category || !entityId) {
        return Response.json(
          { error: "Missing category or entityId" },
          { status: 400 },
        );
      }

      const supabaseAdmin = ctx.supabaseAdmin;
      let pointsAwarded = 0;
      let action = "";
      let entityType = "";
      let previousValue = null;
      let newValue = null;

      if (category === "enrich_voice_actor") {
        entityType = "voice_actor";
        const updates: any = {};
        const newValues: any = {};

        const file = formData.get("file") as File | null;
        if (file) {
          const fileExt = file.name.split(".").pop();
          const fileName = `${crypto.randomUUID()}.${fileExt}`;
          const filePath = `${entityId}/${fileName}`;
          const { error: uploadError, data: uploadData } =
            await supabaseAdmin.storage
              .from("voice_actor_profile_pictures")
              .upload(filePath, file, { contentType: file.type });
          if (!uploadError && uploadData) {
            updates.profile_picture = uploadData.path;
            newValues.profile_picture = uploadData.path;
            pointsAwarded += 10;
            action += "added_profile_picture ";
          }
        }

        const nationality = formData.get("nationality")?.toString();
        if (nationality) {
          updates.nationality = nationality;
          newValues.nationality = nationality;
          pointsAwarded += 5;
          action += "added_nationality ";
        }

        const dateOfBirth = formData.get("date_of_birth")?.toString();
        if (dateOfBirth) {
          updates.date_of_birth = dateOfBirth;
          newValues.date_of_birth = dateOfBirth;
          pointsAwarded += 5;
          action += "added_dob ";
        }

        const bio = formData.get("bio")?.toString();
        if (bio) {
          updates.bio = bio;
          newValues.bio = bio;
          pointsAwarded += 10;
          action += "added_bio ";
        }

        const tmdb_id = formData.get("tmdb_id")?.toString();
        if (tmdb_id) {
          updates.tmdb_id = parseInt(tmdb_id, 10);
          newValues.tmdb_id = parseInt(tmdb_id, 10);
          pointsAwarded += 5;
          action += "added_tmdb_id ";
        }

        const wikidata_id = formData.get("wikidata_id")?.toString();
        if (wikidata_id) {
          updates.wikidata_id = wikidata_id;
          newValues.wikidata_id = wikidata_id;
          pointsAwarded += 5;
          action += "added_wikidata_id ";
        }

        const twitter = formData.get("twitter")?.toString();
        const instagram = formData.get("instagram")?.toString();
        const tiktok = formData.get("tiktok")?.toString();
        const facebook = formData.get("facebook")?.toString();

        if (twitter || instagram || tiktok || facebook) {
          const { data: va } = await supabaseAdmin
            .from("voice_actors")
            .select("social_media_links")
            .eq("id", parseInt(entityId, 10))
            .single();
          const currentLinks =
            (va?.social_media_links as Record<string, string>) || {};

          if (twitter) currentLinks.twitter = twitter;
          if (instagram) currentLinks.instagram = instagram;
          if (tiktok) currentLinks.tiktok = tiktok;
          if (facebook) currentLinks.facebook = facebook;

          updates.social_media_links = currentLinks;
          newValues.social_media_links = currentLinks;
          pointsAwarded += 5;
          action += "added_social_links ";
        }

        if (Object.keys(updates).length > 0) {
          updates.updated_by = user.id;
          await supabaseAdmin
            .from("voice_actors")
            .update(updates)
            .eq("id", parseInt(entityId, 10));
        } else {
          return Response.json(
            { error: "No fields to update" },
            { status: 400 },
          );
        }
        newValue = newValues;
      } else if (category === "enrich_studio") {
        entityType = "studio";
        const updates: any = {};
        const newValues: any = {};

        const file = formData.get("file") as File | null;
        if (file) {
          const fileExt = file.name.split(".").pop();
          const fileName = `${crypto.randomUUID()}.${fileExt}`;
          const filePath = `${entityId}/${fileName}`;
          const { error: uploadError, data: uploadData } =
            await supabaseAdmin.storage
              .from("studio_logos")
              .upload(filePath, file, { contentType: file.type });
          if (!uploadError && uploadData) {
            updates.logo_url = uploadData.path;
            newValues.logo_url = uploadData.path;
            pointsAwarded += 10;
            action += "added_logo ";
          }
        }

        const country = formData.get("country")?.toString();
        if (country) {
          updates.country = country;
          newValues.country = country;
          pointsAwarded += 5;
          action += "added_country ";
        }

        const city = formData.get("city")?.toString();
        if (city) {
          updates.city = city;
          newValues.city = city;
          pointsAwarded += 5;
          action += "added_city ";
        }

        const website = formData.get("website_url")?.toString();
        if (website) {
          updates.website_url = website;
          newValues.website_url = website;
          pointsAwarded += 5;
          action += "added_website ";
        }

        const twitter = formData.get("twitter")?.toString();
        const instagram = formData.get("instagram")?.toString();
        const tiktok = formData.get("tiktok")?.toString();
        const facebook = formData.get("facebook")?.toString();

        if (twitter || instagram || tiktok || facebook) {
          const { data: std } = await supabaseAdmin
            .from("studios")
            .select("social_media_links")
            .eq("id", parseInt(entityId, 10))
            .single();
          const currentLinks =
            (std?.social_media_links as Record<string, string>) || {};

          if (twitter) currentLinks.twitter = twitter;
          if (instagram) currentLinks.instagram = instagram;
          if (tiktok) currentLinks.tiktok = tiktok;
          if (facebook) currentLinks.facebook = facebook;

          updates.social_media_links = currentLinks;
          newValues.social_media_links = currentLinks;
          pointsAwarded += 5;
          action += "added_social_links ";
        }

        if (Object.keys(updates).length > 0) {
          await supabaseAdmin
            .from("studios")
            .update(updates)
            .eq("id", parseInt(entityId, 10));
        } else {
          return Response.json(
            { error: "No fields to update" },
            { status: 400 },
          );
        }
        newValue = newValues;
      } else {
        return Response.json({ error: "Invalid category" }, { status: 400 });
      }

      // Record in audit_logs
      action = action.trim();
      const { error: auditError } = await supabaseAdmin
        .from("audit_logs")
        .insert({
          user_id: user.id,
          entity_type: entityType,
          entity_id: entityId,
          action: action,
          previous_value: null,
          new_value: newValue,
          points_awarded: pointsAwarded,
        });

      if (auditError) {
        console.error("Failed to insert audit log:", auditError);
        // We don't fail the request if audit logging fails, but it's bad
      }

      // Unlock task
      await supabaseAdmin
        .from("gamification_task_locks")
        .delete()
        .eq("category", category)
        .eq("entity_id", entityId);

      return Response.json({ success: true, pointsAwarded });
    } catch (error) {
      console.error("Unexpected error:", error);
      return Response.json({ error: "Internal server error" }, { status: 500 });
    }
  }),
};
