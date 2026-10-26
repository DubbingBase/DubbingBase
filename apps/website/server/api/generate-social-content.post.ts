import { useSupabaseAdmin } from "../utils/db/client";
import { requireAdmin } from "../utils/auth";
import { llmGenerateObject } from "../utils/llm";
import { z } from "zod";

export default defineEventHandler(async (event) => {
  const internalSecret = getHeader(event, "x-internal-secret");
  const config = useRuntimeConfig();
  const isInternalTrigger =
    Boolean(internalSecret) && internalSecret === config.supabaseSecretKey;

  if (!isInternalTrigger) {
    requireAdmin(event);
  }

  try {
    const supabaseAdmin = useSupabaseAdmin();

    const today = new Date();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");
    const birthdaySuffix = `${month}-${day}`;

    const { data: voiceActors } = await supabaseAdmin
      .from("voice_actors")
      .select("*")
      .like("date_of_birth", `%-${birthdaySuffix}`);

    let contextData: any = null;
    let imageContextUrl = null;
    let promptTopic = "";

    if (voiceActors && voiceActors.length > 0) {
      promptTopic =
        "C'est l'anniversaire de ces comédiens de doublage aujourd'hui !";
      contextData = voiceActors.map((va: any) => ({
        name: `${va.firstname} ${va.lastname}`,
        bio: va.bio,
        date_of_birth: va.date_of_birth,
      }));

      const imageActor = voiceActors.find((va: any) => va.profile_picture);
      if (imageActor) {
        imageContextUrl = imageActor.profile_picture;
      }
    } else {
      const { data: topActors } = await supabaseAdmin
        .from("voice_actors")
        .select("*")
        .order("id", { ascending: false })
        .limit(50);

      if (topActors && topActors.length > 0) {
        const randomActor =
          topActors[Math.floor(Math.random() * topActors.length)]!;
        promptTopic = "Mise en lumière sur un comédien de doublage !";
        contextData = {
          name: `${randomActor.firstname} ${randomActor.lastname}`,
          bio: randomActor.bio,
        };
        imageContextUrl = randomActor.profile_picture;
      }
    }

    const schema = z.object({
      twitter_post: z.string(),
      instagram_post: z.string(),
    });

    const generatedTexts = await llmGenerateObject(
      `Sujet : ${promptTopic}\nDonnées : ${JSON.stringify(contextData)}`,
      schema,
      {
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
        temperature: 0,
      },
    );

    const resendApiKey = config.resendApiKey;
    if (!resendApiKey) {
      throw new Error("RESEND_API_KEY is not set");
    }

    const adminEmail = config.adminEmail || "contact@dubbingbase.com";

    const emailHtml = `
    <h1>Validation requise : Posts réseaux sociaux</h1>
    <h2>Twitter</h2>
    <p>${generatedTexts.data.twitter_post}</p>
    <br />
    <h2>Instagram</h2>
    <p>${generatedTexts.data.instagram_post}</p>
    <br />
    <p>Image suggérée (chemin) : ${imageContextUrl || "Aucune image spécifique trouvée"}</p>
    <p>Modèle LLM : ${generatedTexts.model}</p>
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

    return {
      success: true,
      message: "Content generated and email sent.",
    };
  } catch (error: any) {
    console.error("Error in generate-social-content:", error);
    throw createError({ statusCode: 500, message: error.message });
  }
});
