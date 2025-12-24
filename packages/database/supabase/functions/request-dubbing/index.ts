import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const ADMIN_EMAIL = Deno.env.get("ADMIN_EMAIL");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { media_type, media_id, media_title, user_email } = await req.json();

    if (!RESEND_API_KEY) {
      throw new Error("Missing RESEND_API_KEY");
    }
    if (!ADMIN_EMAIL) {
      throw new Error("Missing ADMIN_EMAIL");
    }

    // Determine route type for links
    // Mobile app uses 'serie' in routes, but API often uses 'tv' or 'show'
    // We'll normalize to 'movie' or 'serie' for the links
    const route_type = media_type === 'movie' ? 'movie' : 'serie';

    const deepLink = `dubbingbase://${route_type}/${media_id}`;
    const webLink = `https://dubbingbase.app/${route_type}/${media_id}`;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "DubbingBase <noreply@dubbingbase.app>", // Default sender
        to: [ADMIN_EMAIL],
        reply_to: user_email,
        subject: `Dubbing Request: ${media_title}`,
        html: `
          <h1>Dubbing Request</h1>
          <p><strong>User:</strong> ${user_email}</p>
          <p><strong>Media:</strong> ${media_title} (ID: ${media_id}, Type: ${media_type})</p>
          <p>
            <a href="${deepLink}">Open in App</a>
          </p>
          <p>
            <a href="${webLink}">Open on Website</a>
          </p>
        `,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
        return new Response(JSON.stringify({ error: data }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 400,
        });
    }

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
