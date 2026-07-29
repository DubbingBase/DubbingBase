import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createErrorResponse } from "../_shared/http-utils.ts";
import { withSupabase } from "npm:@supabase/server@^1";
import { Database } from "../_shared/database.types.ts";
import satori from "npm:satori";
import { initWasm, Resvg } from "npm:@resvg/resvg-wasm@2.6.2";

let wasmInitialized = false;
let fontDataRegular: ArrayBuffer | null = null;
let fontDataBold: ArrayBuffer | null = null;

async function initialize() {
  if (!wasmInitialized) {
    const wasmRes = await fetch(
      "https://unpkg.com/@resvg/resvg-wasm@2.6.2/index_bg.wasm",
    );
    const wasmBuffer = await wasmRes.arrayBuffer();
    await initWasm(wasmBuffer);
    wasmInitialized = true;
  }

  if (!fontDataRegular) {
    const fontRes = await fetch(
      "https://cdn.jsdelivr.net/npm/inter-font@3.19.0/ttf/Inter-Regular.ttf",
    );
    fontDataRegular = await fontRes.arrayBuffer();
  }

  if (!fontDataBold) {
    const fontRes = await fetch(
      "https://cdn.jsdelivr.net/npm/inter-font@3.19.0/ttf/Inter-Bold.ttf",
    );
    fontDataBold = await fontRes.arrayBuffer();
  }
}

// Fetch an image and convert to a base64 data URI for embedding in satori
async function fetchImageAsDataUri(imageUrl: string): Promise<string | null> {
  try {
    const res = await fetch(imageUrl);
    if (!res.ok) return null;
    const buffer = await res.arrayBuffer();
    const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
    const contentType = res.headers.get("content-type") || "image/jpeg";
    return `data:${contentType};base64,${base64}`;
  } catch {
    return null;
  }
}

// Build satori-compatible virtual DOM nodes directly (no satori-html needed)
function buildVoiceActorOg(params: {
  name: string;
  imageDataUri: string | null;
  worksCount: number;
}) {
  const avatarNode = params.imageDataUri
    ? {
        type: "img",
        props: {
          src: params.imageDataUri,
          width: 240,
          height: 240,
          style: {
            borderRadius: "120px",
            objectFit: "cover",
            border: "4px solid rgba(148, 163, 184, 0.3)",
            boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.6)",
          },
        },
      }
    : {
        type: "div",
        props: {
          style: {
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "240px",
            height: "240px",
            borderRadius: "120px",
            background: "linear-gradient(135deg, #334155, #475569)",
            border: "4px solid rgba(148, 163, 184, 0.3)",
            color: "#64748b",
            fontSize: "100px",
          },
          children: params.name.charAt(0).toUpperCase(),
        },
      };

  return {
    type: "div",
    props: {
      style: {
        display: "flex",
        flexDirection: "row",
        width: "1200px",
        height: "630px",
        background:
          "linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)",
        color: "white",
        fontFamily: "Inter",
        padding: "48px",
      },
      children: [
        // Left: Avatar
        {
          type: "div",
          props: {
            style: {
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "320px",
              flexShrink: 0,
            },
            children: avatarNode,
          },
        },
        // Right: Info
        {
          type: "div",
          props: {
            style: {
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              flex: 1,
              paddingLeft: "32px",
            },
            children: [
              // "VOICE ACTOR" label
              {
                type: "p",
                props: {
                  style: {
                    fontSize: "20px",
                    color: "#94a3b8",
                    margin: "0 0 12px 0",
                    letterSpacing: "2px",
                    textTransform: "uppercase" as const,
                  },
                  children: "Voice Actor",
                },
              },
              // Name
              {
                type: "p",
                props: {
                  style: {
                    fontSize: "56px",
                    fontWeight: 700,
                    margin: "0",
                    color: "#f1f5f9",
                    lineHeight: 1.1,
                  },
                  children: params.name,
                },
              },
              // Roles badge
              {
                type: "div",
                props: {
                  style: {
                    display: "flex",
                    alignItems: "center",
                    marginTop: "24px",
                  },
                  children: {
                    type: "div",
                    props: {
                      style: {
                        display: "flex",
                        alignItems: "center",
                        background: "rgba(99, 102, 241, 0.15)",
                        border: "1px solid rgba(99, 102, 241, 0.3)",
                        borderRadius: "12px",
                        padding: "10px 20px",
                      },
                      children: {
                        type: "p",
                        props: {
                          style: {
                            fontSize: "24px",
                            color: "#a5b4fc",
                            margin: "0",
                            fontWeight: 600,
                          },
                          children: `${params.worksCount} ${params.worksCount === 1 ? "Role" : "Roles"}`,
                        },
                      },
                    },
                  },
                },
              },
              // Branding
              {
                type: "p",
                props: {
                  style: {
                    fontSize: "18px",
                    color: "#475569",
                    margin: "40px 0 0 0",
                  },
                  children: "DubbingBase",
                },
              },
            ],
          },
        },
      ],
    },
  };
}

export default {
  fetch: withSupabase<Database>({ auth: "none" }, async (req, ctx) => {
    try {
      const url = new URL(req.url);
      const type = url.searchParams.get("type");

      if (!type) {
        return createErrorResponse("Missing type parameter", 400);
      }

      await initialize();

      let template;

      if (type === "voice-actor") {
        const id = url.searchParams.get("id");
        if (!id) return createErrorResponse("Missing id parameter", 400);

        // Lightweight query: only fetch voice actor + work count
        // Use supabaseAdmin since auth: "none" doesn't provide ctx.supabase
        const { data: voiceActor, error } = await ctx.supabaseAdmin
          .from("voice_actors")
          .select("id, firstname, lastname, profile_picture, work(id)")
          .eq("id", Number(id))
          .single();

        if (error || !voiceActor) {
          return createErrorResponse("Actor not found", 404);
        }

        const name =
          `${voiceActor.firstname} ${voiceActor.lastname}`.trim() || "Unknown";
        const worksCount = voiceActor.work?.length ?? 0;

        // Build the profile picture URL using the internal SUPABASE_URL
        // (buildSupabaseImageUrl can't be used here: it relies on ctx.supabase
        // which isn't available in auth:"none", and rewrites URLs to 127.0.0.1
        // in dev mode which is unreachable from inside the edge runtime)
        let imageDataUri: string | null = null;
        if (voiceActor.profile_picture) {
          const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
          const bucket = "voice_actor_profile_pictures";
          const storageUrl = `${supabaseUrl}/storage/v1/object/public/${bucket}/${voiceActor.profile_picture}`;
          console.log("Fetching profile picture from:", storageUrl);
          imageDataUri = await fetchImageAsDataUri(storageUrl);
        }

        template = buildVoiceActorOg({ name, imageDataUri, worksCount });
      } else {
        return createErrorResponse(`Unsupported type: ${type}`, 400);
      }

      const svg = await satori(template, {
        width: 1200,
        height: 630,
        fonts: [
          {
            name: "Inter",
            data: fontDataRegular!,
            weight: 400,
            style: "normal",
          },
          {
            name: "Inter",
            data: fontDataBold!,
            weight: 700,
            style: "normal",
          },
        ],
      });

      const resvg = new Resvg(svg, {
        fitTo: {
          mode: "width",
          value: 1200,
        },
      });

      const pngData = resvg.render();
      const pngBuffer = pngData.asPng();

      return new Response(pngBuffer as any, {
        headers: {
          "Content-Type": "image/png",
          "Cache-Control": "public, max-age=86400, s-maxage=86400",
        },
      });
    } catch (error) {
      console.error("Error generating OG image:", error);
      return createErrorResponse("Failed to generate OG image");
    }
  }),
};
