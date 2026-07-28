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

async function fetchImageAsDataUri(
  imageUrl: string,
): Promise<string | null> {
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

function buildCareerGridImage(params: {
  name: string;
  avatarDataUri: string | null;
  works: Array<{ title: string; characterName: string }>;
}): { svgHeight: number; template: any } {
  const MAX_COLS = 3;
  const WORK_WIDTH = 340;
  const WORK_HEIGHT = 80;
  const WORK_GAP = 16;
  const PADDING = 48;
  const HEADER_HEIGHT = 140;
  const FOOTER_HEIGHT = 40;

  const works = params.works.slice(0, 30);
  const cols = Math.min(works.length, MAX_COLS);
  const rows = Math.ceil(works.length / MAX_COLS);
  const rowWidth = cols * WORK_WIDTH + (cols - 1) * WORK_GAP;
  const gridX = (1200 - rowWidth) / 2;
  const gridHeight = rows * WORK_HEIGHT + (rows - 1) * WORK_GAP;

  const totalHeight = PADDING + HEADER_HEIGHT + PADDING + gridHeight + PADDING +
    FOOTER_HEIGHT;

  const avatarNode = params.avatarDataUri
    ? {
      type: "img",
      props: {
        src: params.avatarDataUri,
        width: 100,
        height: 100,
        style: {
          borderRadius: "50px",
          objectFit: "cover",
          border: "4px solid rgba(99, 102, 241, 0.5)",
        },
      },
    }
    : {
      type: "div",
      props: {
        style: {
          width: "100px",
          height: "100px",
          borderRadius: "50px",
          background: "linear-gradient(135deg, #334155, #475569)",
          border: "4px solid rgba(99, 102, 241, 0.5)",
          color: "#64748b",
          fontSize: "42px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        },
        children: params.name.charAt(0).toUpperCase(),
      },
    };

  const workNodes = works.map((work, i) => {
    const col = i % MAX_COLS;
    const row = Math.floor(i / MAX_COLS);
    const x = gridX + col * (WORK_WIDTH + WORK_GAP);
    const y = PADDING + HEADER_HEIGHT + PADDING +
      row * (WORK_HEIGHT + WORK_GAP);

    return {
      type: "div",
      props: {
        style: {
          position: "absolute",
          left: `${x}px`,
          top: `${y}px`,
          width: `${WORK_WIDTH}px`,
          height: `${WORK_HEIGHT}px`,
          background: "#1e293b",
          borderRadius: "8px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "12px 16px",
          border: "1px solid rgba(148, 163, 184, 0.1)",
        },
        children: [
          {
            type: "p",
            props: {
              style: {
                fontSize: "16px",
                fontWeight: 600,
                color: "#f1f5f9",
                margin: "0 0 4px 0",
              },
              children: work.title,
            },
          },
          {
            type: "p",
            props: {
              style: {
                fontSize: "13px",
                color: "#94a3b8",
                margin: "0",
              },
              children: `as ${work.characterName}`,
            },
          },
        ],
      },
    };
  });

  return {
    svgHeight: totalHeight,
    template: {
      type: "div",
      props: {
        style: {
          display: "flex",
          flexDirection: "column",
          width: "1200px",
          height: `${totalHeight}px`,
          background:
            "linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)",
          color: "white",
          fontFamily: "Inter",
          padding: `${PADDING}px`,
          position: "relative",
        },
        children: [
          {
            type: "div",
            props: {
              style: {
                display: "flex",
                alignItems: "center",
                gap: "20px",
                marginBottom: "8px",
              },
              children: [avatarNode, {
                type: "div",
                props: {
                  style: {
                    display: "flex",
                    flexDirection: "column",
                  },
                  children: [
                    {
                      type: "p",
                      props: {
                        style: {
                          fontSize: "16px",
                          color: "#94a3b8",
                          margin: "0 0 6px 0",
                          letterSpacing: "3px",
                          textTransform: "uppercase" as const,
                        },
                        children: "Voice Actor",
                      },
                    },
                    {
                      type: "p",
                      props: {
                        style: {
                          fontSize: "42px",
                          fontWeight: 700,
                          margin: "0",
                          color: "#f1f5f9",
                          lineHeight: 1.1,
                        },
                        children: params.name,
                      },
                    },
                    {
                      type: "p",
                      props: {
                        style: {
                          fontSize: "16px",
                          color: "#64748b",
                          margin: "8px 0 0 0",
                        },
                        children: `${params.works.length} ${
                          params.works.length === 1 ? "Role" : "Roles"
                        }`,
                      },
                    },
                  ],
                },
              }],
            },
          },
          ...workNodes,
          {
            type: "p",
            props: {
              style: {
                position: "absolute",
                bottom: `${PADDING}px`,
                right: `${PADDING}px`,
                fontSize: "14px",
                color: "#475569",
                margin: "0",
              },
              children: "DubbingBase",
            },
          },
        ],
      },
    },
  };
}

export default {
  fetch: withSupabase<Database>({ auth: "none" }, async (req, ctx) => {
    try {
      await initialize();

      const url = new URL(req.url);
      const idParam = url.searchParams.get("id");

      if (!idParam) {
        return createErrorResponse("Missing id parameter", 400);
      }

      const id = Number(idParam);
      if (isNaN(id)) {
        return createErrorResponse(
          `Invalid id parameter: expected a number, got "${idParam}"`,
          400,
        );
      }

      const { data: voiceActor, error } = await ctx.supabaseAdmin
        .from("voice_actors")
        .select(
          "id, firstname, lastname, profile_picture, voice_actor_name, work(id, dubbing_projects(content_id, content_type), performance)",
        )
        .eq("id", id)
        .single();

      if (error || !voiceActor) {
        return createErrorResponse(
          `Voice actor with id=${id} not found`,
          404,
        );
      }

      const works = (voiceActor.work || []).map((w: any) => ({
        title: w.dubbing_projects?.content_id
          ? `Work #${w.dubbing_projects.content_id}`
          : "Unknown Work",
        characterName: w.performance || "Unknown",
      }));

      const name = `${voiceActor.firstname} ${voiceActor.lastname}`.trim() ||
        voiceActor.voice_actor_name ||
        "Unknown";

      let avatarDataUri: string | null = null;
      if (voiceActor.profile_picture) {
        const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
        const bucket = "voice_actor_profile_pictures";
        const storageUrl =
          `${supabaseUrl}/storage/v1/object/public/${bucket}/${voiceActor.profile_picture}`;
        avatarDataUri = await fetchImageAsDataUri(storageUrl);
      }

      const { svgHeight, template } = buildCareerGridImage({
        name,
        avatarDataUri,
        works,
      });

      const svg = await satori(template, {
        width: 1200,
        height: svgHeight,
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
          "Cache-Control": "public, max-age=3600, s-maxage=3600",
        },
      });
    } catch (error) {
      console.error("Error generating career grid image:", error);
      return createErrorResponse("Failed to generate career grid image");
    }
  }),
};
