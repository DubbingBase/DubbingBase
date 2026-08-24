export default defineEventHandler(async (event) => {
  const user = event.context.user;
  if (!user) {
    throw createError({ statusCode: 401, message: "Unauthorized" });
  }

  try {
    const formData = await readMultipartFormData(event);

    if (!formData) {
      throw createError({
        statusCode: 400,
        message: "Content type must be multipart/form-data",
      });
    }

    const getField = (name: string) =>
      formData.find((f) => f.name === name)?.data?.toString();

    const category = getField("category");
    const entityId = getField("entityId");

    if (!category || !entityId) {
      throw createError({
        statusCode: 400,
        message: "Missing category or entityId",
      });
    }

    const supabaseAdmin = event.context.supabaseAdmin;
    let pointsAwarded = 0;
    let action = "";
    let entityType = "";
    let newValue = null;

    if (category === "enrich_voice_actor") {
      entityType = "voice_actor";
      const updates: any = {};
      const newValues: any = {};

      const fileField = formData.find((f) => f.name === "file");
      if (fileField?.data) {
        const fileExt = fileField.filename?.split(".").pop() || "bin";
        const fileName = `${crypto.randomUUID()}.${fileExt}`;
        const filePath = `${entityId}/${fileName}`;
        const { error: uploadError, data: uploadData } =
          await supabaseAdmin.storage
            .from("voice_actor_profile_pictures")
            .upload(filePath, fileField.data, {
              contentType: fileField.type || "application/octet-stream",
            });
        if (!uploadError && uploadData) {
          updates.profile_picture = uploadData.path;
          newValues.profile_picture = uploadData.path;
          pointsAwarded += 10;
          action += "added_profile_picture ";
        }
      }

      const nationality = getField("nationality");
      if (nationality) {
        updates.nationality = nationality;
        newValues.nationality = nationality;
        pointsAwarded += 5;
        action += "added_nationality ";
      }

      const dateOfBirth = getField("date_of_birth");
      if (dateOfBirth) {
        updates.date_of_birth = dateOfBirth;
        newValues.date_of_birth = dateOfBirth;
        pointsAwarded += 5;
        action += "added_dob ";
      }

      const bio = getField("bio");
      if (bio) {
        updates.bio = bio;
        newValues.bio = bio;
        pointsAwarded += 10;
        action += "added_bio ";
      }

      const tmdb_id = getField("tmdb_id");
      if (tmdb_id) {
        updates.tmdb_id = parseInt(tmdb_id, 10);
        newValues.tmdb_id = parseInt(tmdb_id, 10);
        pointsAwarded += 5;
        action += "added_tmdb_id ";
      }

      const wikidata_id = getField("wikidata_id");
      if (wikidata_id) {
        updates.wikidata_id = wikidata_id;
        newValues.wikidata_id = wikidata_id;
        pointsAwarded += 5;
        action += "added_wikidata_id ";
      }

      const twitter = getField("twitter");
      const instagram = getField("instagram");
      const tiktok = getField("tiktok");
      const facebook = getField("facebook");

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
        throw createError({
          statusCode: 400,
          message: "No fields to update",
        });
      }
      newValue = newValues;
    } else if (category === "enrich_studio") {
      entityType = "studio";
      const updates: any = {};
      const newValues: any = {};

      const fileField = formData.find((f) => f.name === "file");
      if (fileField?.data) {
        const fileExt = fileField.filename?.split(".").pop() || "bin";
        const fileName = `${crypto.randomUUID()}.${fileExt}`;
        const filePath = `${entityId}/${fileName}`;
        const { error: uploadError, data: uploadData } =
          await supabaseAdmin.storage
            .from("studio_logos")
            .upload(filePath, fileField.data, {
              contentType: fileField.type || "application/octet-stream",
            });
        if (!uploadError && uploadData) {
          updates.logo_url = uploadData.path;
          newValues.logo_url = uploadData.path;
          pointsAwarded += 10;
          action += "added_logo ";
        }
      }

      const country = getField("country");
      if (country) {
        updates.country = country;
        newValues.country = country;
        pointsAwarded += 5;
        action += "added_country ";
      }

      const city = getField("city");
      if (city) {
        updates.city = city;
        newValues.city = city;
        pointsAwarded += 5;
        action += "added_city ";
      }

      const website = getField("website_url");
      if (website) {
        updates.website_url = website;
        newValues.website_url = website;
        pointsAwarded += 5;
        action += "added_website ";
      }

      const twitter = getField("twitter");
      const instagram = getField("instagram");
      const tiktok = getField("tiktok");
      const facebook = getField("facebook");

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
        throw createError({
          statusCode: 400,
          message: "No fields to update",
        });
      }
      newValue = newValues;
    } else {
      throw createError({ statusCode: 400, message: "Invalid category" });
    }

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
    }

    await supabaseAdmin
      .from("gamification_task_locks")
      .delete()
      .eq("category", category)
      .eq("entity_id", entityId);

    return { success: true, pointsAwarded };
  } catch (error) {
    if (error && typeof error === "object" && "statusCode" in error)
      throw error;
    console.error("Unexpected error:", error);
    throw createError({ statusCode: 500, message: "Internal server error" });
  }
});
