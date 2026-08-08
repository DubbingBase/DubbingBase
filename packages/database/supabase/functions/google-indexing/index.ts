import { withSupabase } from "npm:@supabase/server@^1";
import { Database } from "../_shared/database.types.ts";
import { JWT } from "npm:google-auth-library@^9.0.0";

const GOOGLE_INDEXING_API_URL = "https://indexing.googleapis.com/v3/urlNotifications:publish";
const SITE_URL = "https://dubbingbase.com"; // adjust if it needs to be dynamic

export default {
  fetch: withSupabase<Database>(
    { auth: "secret" }, // Only invoked by Database Webhooks
    async (req, ctx) => {
      try {
        const body = await req.json();
        const record = body.record;

        if (!record || !record.dubbing_project_id || !record.voice_actor_id) {
          console.error("[Google Indexing] Invalid payload missing dubbing_project_id or voice_actor_id", body);
          return Response.json(
            { ok: false, error: "Invalid payload missing required fields" },
            { status: 400 }
          );
        }

        const voiceActorId = record.voice_actor_id;
        const actorId = record.actor_id;
        const dubbingProjectId = record.dubbing_project_id;

        // 1. Resolve dubbing project
        const { data: project, error: projectError } = await ctx.supabaseAdmin
          .from("dubbing_projects")
          .select("content_id, content_type")
          .eq("id", dubbingProjectId)
          .single();

        if (projectError || !project) {
          throw new Error(`Dubbing project ${dubbingProjectId} not found`);
        }

        // 2. Build URLs
        const urlsToUpdate: string[] = [];

        // Voice actor URL
        urlsToUpdate.push(`${SITE_URL}/voice-actor/${voiceActorId}`);

        // Actor URL
        if (actorId) {
          urlsToUpdate.push(`${SITE_URL}/actor/${actorId}`);
        }

        // Media URL
        let mediaType = project.content_type;
        if (mediaType === "tv") {
          mediaType = "show";
        }
        urlsToUpdate.push(`${SITE_URL}/${mediaType}/${project.content_id}`);

        // 3. Authenticate with Google
        const serviceAccountJsonStr = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON");
        if (!serviceAccountJsonStr) {
          throw new Error("Missing GOOGLE_SERVICE_ACCOUNT_JSON environment variable");
        }

        let serviceAccountCredentials;
        try {
          serviceAccountCredentials = JSON.parse(serviceAccountJsonStr);
        } catch (e) {
          throw new Error("Invalid GOOGLE_SERVICE_ACCOUNT_JSON format");
        }

        const jwtClient = new JWT({
          email: serviceAccountCredentials.client_email,
          key: serviceAccountCredentials.private_key,
          scopes: ["https://www.googleapis.com/auth/indexing"],
        });

        // Ensure we're authenticated
        const tokens = await jwtClient.authorize();
        const accessToken = tokens.access_token;
        if (!accessToken) {
          throw new Error("Failed to retrieve access token from Google");
        }

        // 4. Send requests to Indexing API
        const results = [];
        for (const url of urlsToUpdate) {
          console.log(`[Google Indexing] Notifying update for URL: ${url}`);

          try {
            const res = await fetch(GOOGLE_INDEXING_API_URL, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${accessToken}`,
              },
              body: JSON.stringify({
                url: url,
                type: "URL_UPDATED",
              }),
            });

            if (!res.ok) {
              const errData = await res.text();
              console.error(`[Google Indexing] Failed to update URL ${url}: ${res.status} - ${errData}`);
              results.push({ url, success: false, error: errData, status: res.status });
            } else {
              const data = await res.json();
              results.push({ url, success: true, data });
            }
          } catch (err) {
            console.error(`[Google Indexing] Error updating URL ${url}:`, err);
            results.push({ url, success: false, error: err instanceof Error ? err.message : String(err) });
          }
        }

        return Response.json({ ok: true, results });
      } catch (err) {
        console.error("[Google Indexing] Error:", err);
        const errorMessage = err instanceof Error ? err.message : String(err);
        return Response.json({ ok: false, error: errorMessage }, { status: 500 });
      }
    }
  ),
};
