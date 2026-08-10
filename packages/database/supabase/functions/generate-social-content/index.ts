import { withSupabase } from "npm:@supabase/server@^1";
import { Database } from "../_shared/database.types.ts";

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

      const mistralApiKey = Deno.env.get("MISTRAL_API_KEY");
      if (!mistralApiKey) {
        throw new Error("MISTRAL_API_KEY is not set");
      }

      const mistralResponse = await fetch(
        "https://api.mistral.ai/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${mistralApiKey}`,
          },
          body: JSON.stringify({
            model: "mistral-large-latest",
            response_format: { type: "json_object" },
            messages: [
              {
                role: "system",
                content: `Agis en tant que community manager de DubbingBase (encyclopédie du doublage).
Génère deux posts pour les réseaux sociaux basés sur les données fournies.
Tu dois retourner UNIQUEMENT un objet JSON avec deux clés : "twitter_post" et "instagram_post".

Contraintes Twitter:
- Moins de 280 caractères.
- Texte incisif.
- 2 hashtags maximum.

Contraintes Instagram:
- Texte plus détaillé et passionné.
- Inclure un fait surprenant (si possible à partir des données).
- Appel à l'action invitant à visiter DubbingBase.
- 5 à 10 hashtags pertinents.`,
              },
              {
                role: "user",
                content: `Sujet : ${promptTopic}\nDonnées : ${JSON.stringify(contextData)}`,
              },
            ],
          }),
        },
      );

      if (!mistralResponse.ok) {
        const errText = await mistralResponse.text();
        throw new Error(`Mistral API error: ${errText}`);
      }

      const mistralData = await mistralResponse.json();
      const generatedTexts = JSON.parse(mistralData.choices[0].message.content);

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
