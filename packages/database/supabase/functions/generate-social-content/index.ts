import { withSupabase } from "npm:@supabase/server@^1";
import { Database } from "../_shared/database.types.ts";
import { geminiGenerateObject } from "../_shared/index.ts";
import { z } from "npm:zod";

export default {
  fetch: withSupabase<Database>({ auth: "secret" }, async (req, ctx) => {
    try {
      const today = new Date();
      const month = String(today.getMonth() + 1).padStart(2, "0");
      const day = String(today.getDate()).padStart(2, "0");
      const birthdaySuffix = `${month}-${day}`;

      const { data: voiceActors, error: vaError } = await ctx.supabaseAdmin
        .from("voice_actors")
        .select("*")
        .like("date_of_birth", `%-${birthdaySuffix}`);

      let contextData: any = null;
      let imageContextUrl = null;
      let promptTopic = "";

      if (voiceActors && voiceActors.length > 0) {
        promptTopic =
          "C'est l'anniversaire de ces comédiens de doublage aujourd'hui !";
        contextData = voiceActors.map((va) => ({
          name: `${va.firstname} ${va.lastname}`,
          bio: va.bio,
          date_of_birth: va.date_of_birth,
        }));

        // Find first voice actor with profile picture to showcase
        const imageActor = voiceActors.find((va) => va.profile_picture);
        if (imageActor) {
          imageContextUrl = imageActor.profile_picture;
        }
      } else {
        // Fallback: random voice actor
        const { data: topActors } = await ctx.supabaseAdmin
          .from("voice_actors")
          .select("*")
          .order("id", { ascending: false })
          .limit(50);

        if (topActors && topActors.length > 0) {
          const randomActor =
            topActors[Math.floor(Math.random() * topActors.length)];
          promptTopic = "Mise en lumière sur un comédien de doublage !";
          contextData = {
            name: `${randomActor.firstname} ${randomActor.lastname}`,
            bio: randomActor.bio,
          };
          imageContextUrl = randomActor.profile_picture;
        }
      }

      const userContent = `Topic: ${promptTopic}\nData: ${JSON.stringify(contextData)}`;

      const schema = z.object({
        twitter_post: z.string(),
        instagram_post: z.string(),
      });

      const generatedTexts = await geminiGenerateObject(userContent, schema, {
        systemInstruction: `Act as a community manager for DubbingBase (a French voice acting encyclopedia). Generate two social media posts based on the provided data.

Twitter constraints:
- Under 280 characters.
- Punchy text.
- Maximum 2 hashtags.

Instagram constraints:
- More detailed and passionate text.
- Include a surprising fact (if possible from the data).
- Call to action inviting to visit DubbingBase.
- 5 to 10 relevant hashtags.`,
      });

      const resendApiKey = Deno.env.get("RESEND_API_KEY");
      if (!resendApiKey) {
        throw new Error("RESEND_API_KEY is not set");
      }

      const adminEmail =
        Deno.env.get("ADMIN_EMAIL") || "contact@dubbingbase.com";

      const emailHtml = `
      <h1>Validation requise : Posts réseaux sociaux</h1>
      <h2>Twitter</h2>
      <p>${generatedTexts.twitter_post}</p>
      <br />
      <h2>Instagram</h2>
      <p>${generatedTexts.instagram_post}</p>
      <br />
      <p>Image suggérée (chemin) : ${imageContextUrl || "Aucune image spécifique trouvée"}</p>
      `;

      const resendResponse = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${resendApiKey}`,
        },
        body: JSON.stringify({
          from: "DubbingBase <onboarding@resend.dev>",
          to: adminEmail,
          subject: "Nouveaux posts réseaux sociaux à valider",
          html: emailHtml,
        }),
      });

      if (!resendResponse.ok) {
        const resendErrText = await resendResponse.text();
        throw new Error(`Resend API error: ${resendErrText}`);
      }

      return Response.json({
        success: true,
        message: "Content generated and email sent.",
      });
    } catch (error: any) {
      return Response.json({ error: error.message }, { status: 500 });
    }
  }),
};
