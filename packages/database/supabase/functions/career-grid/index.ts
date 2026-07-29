import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createErrorResponse } from "../_shared/http-utils.ts";
import { withSupabase } from "npm:@supabase/server@^1";
import { Database } from "../_shared/database.types.ts";
import satori from "npm:satori";
import { initWasm, Resvg } from "npm:@resvg/resvg-wasm@2.6.2";
import { DatabaseClient, MediaService, tmdbClient } from "../_shared/index.ts";
import en from "../../../../locales/en.json" with { type: "json" };
import fr from "../../../../locales/fr.json" with { type: "json" };

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

async function fetchImageAsDataUri(url: string): Promise<string | null> {
  if (!url) return null;
  let finalUrl = url;

  // If running locally, rewrite 127.0.0.1 or localhost to SUPABASE_URL (e.g. kong:8000)
  // because the Edge Function container cannot access the host's localhost port directly.
  if (finalUrl.includes("127.0.0.1") || finalUrl.includes("localhost")) {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    if (supabaseUrl) {
      try {
        const urlObj = new URL(finalUrl);
        const supabaseObj = new URL(supabaseUrl);
        urlObj.protocol = supabaseObj.protocol;
        urlObj.host = supabaseObj.host;
        finalUrl = urlObj.toString();
      } catch (e) {
        console.error("Failed to rewrite local URL:", e);
      }
    }
  }

  try {
    const res = await fetch(finalUrl);
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
  otherRolesCount: number;
  works: Array<{
    title: string;
    characterName: string;
    mediaDataUri: string | null;
    characterDataUri: string | null;
  }>;
  lang: string;
}): { svgWidth: number; svgHeight: number; template: any } {
  const isFr = params.lang.startsWith("fr");
  const dict = isFr ? fr : en;

  const tVoiceActor = dict.profile?.voiceActorProfile || (isFr ? "Comédien de doublage" : "Voice Actor");
  const tRole = (count: number) => {
    return count === 1 ? dict.actor?.role || (isFr ? "Rôle" : "Role") : dict.actor?.roles || (isFr ? "Rôles" : "Roles");
  };
  const tAs = dict.actor?.as || (isFr ? "dans le rôle de" : "as");
  const tSeeOtherRoles = (count: number) => {
    // There is no translation for this in the locales yet, so keep fallback
    if (isFr) return `Voir les ${count} autres rôles sur dubbingbase.com`;
    return `See ${count} other roles at dubbingbase.com`;
  };

  const MAX_COLS = 5;
  const WORK_WIDTH = 340;
  const WORK_HEIGHT = 80;
  const WORK_GAP = 12;
  const PADDING = 48;
  const HEADER_HEIGHT = 140;
  const FOOTER_HEIGHT = 40;

  const works = params.works;
  const cols = Math.min(Math.max(works.length, 1), MAX_COLS);
  const rows = Math.ceil(works.length / MAX_COLS);
  const rowWidth = cols * WORK_WIDTH + (cols - 1) * WORK_GAP;
  const svgWidth = Math.max(1200, PADDING * 2 + rowWidth);
  const gridX = (svgWidth - rowWidth) / 2;
  const gridHeight = Math.max(0, rows * WORK_HEIGHT + (rows - 1) * WORK_GAP);

  const totalHeight =
    PADDING + HEADER_HEIGHT + PADDING + gridHeight + PADDING + FOOTER_HEIGHT;

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
    const y =
      PADDING + HEADER_HEIGHT + PADDING + row * (WORK_HEIGHT + WORK_GAP);

    const mediaPoster = work.mediaDataUri
      ? {
          type: "img",
          props: {
            src: work.mediaDataUri,
            style: {
              width: "40px",
              height: "60px",
              borderRadius: "4px",
              objectFit: "cover",
              marginRight: "8px",
            },
          },
        }
      : {
          type: "div",
          props: {
            style: {
              width: "40px",
              height: "60px",
              borderRadius: "4px",
              background: "#334155",
              marginRight: "8px",
            },
          },
        };

    const characterAvatar = work.characterDataUri
      ? {
          type: "img",
          props: {
            src: work.characterDataUri,
            style: {
              width: "40px",
              height: "40px",
              borderRadius: "20px",
              objectFit: "cover",
              border: "2px solid rgba(148, 163, 184, 0.3)",
              marginLeft: "auto",
            },
          },
        }
      : null;

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
          flexDirection: "row",
          alignItems: "center",
          padding: "10px",
          border: "1px solid rgba(148, 163, 184, 0.1)",
        },
        children: [
          mediaPoster,
          {
            type: "div",
            props: {
              style: {
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                flex: 1,
                minWidth: 0,
                marginRight: "8px",
              },
              children: [
                {
                  type: "p",
                  props: {
                    style: {
                      fontSize: "14px",
                      fontWeight: 600,
                      color: "#f1f5f9",
                      margin: "0 0 4px 0",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    },
                    children: work.title,
                  },
                },
                {
                  type: "p",
                  props: {
                    style: {
                      fontSize: "12px",
                      color: "#94a3b8",
                      margin: "0",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    },
                    children: work.characterName
                      ? `${tAs} ${work.characterName}`
                      : "",
                  },
                },
              ],
            },
          },
          characterAvatar,
        ],
      },
    };
  });

  return {
    svgWidth,
    svgHeight: totalHeight,
    template: {
      type: "div",
      props: {
        style: {
          display: "flex",
          flexDirection: "column",
          width: `${svgWidth}px`,
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
              children: [
                avatarNode,
                {
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
                          children: tVoiceActor,
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
                          children: `${params.works.length} ${tRole(params.works.length)}`,
                        },
                      },
                    ],
                  },
                },
              ],
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
                color: "#94a3b8",
                margin: "0",
              },
              children:
                params.otherRolesCount > 0
                  ? tSeeOtherRoles(params.otherRolesCount)
                  : "dubbingbase.com",
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
      const langParam = url.searchParams.get("lang") || "fr-FR";

      if (!idParam) {
        return createErrorResponse("Missing id parameter", 400);
      }

      const id = parseInt(idParam, 10);
      if (isNaN(id)) {
        return createErrorResponse(
          "Invalid id parameter, must be a number",
          400,
        );
      }

      const dbClient = new DatabaseClient(ctx);
      const mediaService = new MediaService(dbClient, tmdbClient, ctx);

      const result = await mediaService.getVoiceActorWithWorkAndMedia(id, langParam);

      if (!result?.voiceActor) {
        return createErrorResponse("Voice actor not found", 404);
      }

      const { voiceActor, medias, characterProfilePictures } = result;

      // Extract and format all works, link with media
      let mappedWorks = (voiceActor.work || []).reduce((acc: any[], w: any) => {
        const contentId = w.dubbing_projects?.content_id;
        const media = medias.find((m: any) => m.id === contentId);

        if (!media || !media.credits?.cast) return acc;

        const castMember = media.credits.cast.find(
          (c: any) => c.id === w.actor_id,
        );

        if (!castMember) return acc;

        let characterName = castMember.character || w.performance || "";

        // Sometimes performance is "dialogues", which we don't want to display
        if (characterName.toLowerCase().includes("dialogue")) {
          characterName = "";
        }

        let characterImage = null;
        if (castMember.profile_path) {
          characterImage = castMember.profile_path.replace("/w500/", "/w92/");
        }

        // Try finding character profile from TVDB mapping if TMDB is missing
        if (
          !characterImage &&
          characterProfilePictures &&
          Array.isArray(characterProfilePictures)
        ) {
          const pic = characterProfilePictures.find(
            (cp: any) =>
              (cp.movieId === contentId || cp.showId === contentId) &&
              cp.name &&
              characterName &&
              cp.name.toLowerCase() === characterName.toLowerCase(),
          );
          if (pic) {
            characterImage = pic.image || pic.profile_path || null;
          }
        }

        let title = "Unknown Work";
        let popularity = 0;
        let mediaPoster = null;

        if (media) {
          title = media.title || media.name || title;
          popularity = media.popularity || 0;
          if (media.poster_path) {
            mediaPoster = media.poster_path.replace("/w500/", "/w92/");
          }
        } else {
          title = contentId ? `Work #${contentId}` : title;
        }

        acc.push({
          title,
          characterName: characterName || "",
          popularity,
          mediaPosterUrl: mediaPoster,
          characterImageUrl: characterImage,
        });

        return acc;
      }, []);

      // Sort by popularity descending
      mappedWorks.sort((a: any, b: any) => b.popularity - a.popularity);

      const totalWorks = mappedWorks.length;
      const DISPLAY_LIMIT = 50;
      const otherRolesCount = Math.max(0, totalWorks - DISPLAY_LIMIT);
      mappedWorks = mappedWorks.slice(0, DISPLAY_LIMIT);

      // Concurrently fetch images as Data URIs for all mappedWorks
      const worksPromises = mappedWorks.map(async (work: any) => {
        const [mediaDataUri, characterDataUri] = await Promise.all([
          work.mediaPosterUrl
            ? fetchImageAsDataUri(work.mediaPosterUrl)
            : Promise.resolve(null),
          work.characterImageUrl
            ? fetchImageAsDataUri(work.characterImageUrl)
            : Promise.resolve(null),
        ]);
        return {
          title: work.title,
          characterName: work.characterName,
          mediaDataUri,
          characterDataUri,
        };
      });

      const works = await Promise.all(worksPromises);

      const name =
        `${voiceActor.firstname} ${voiceActor.lastname}`.trim() ||
        voiceActor.voice_actor_name ||
        "Unknown";

      let avatarDataUri: string | null = null;
      if (voiceActor.profile_picture) {
        avatarDataUri = await fetchImageAsDataUri(voiceActor.profile_picture);
      }

      const { svgWidth, svgHeight, template } = buildCareerGridImage({
        name,
        avatarDataUri,
        otherRolesCount,
        works,
        lang: langParam,
      });

      const svg = await satori(template, {
        width: svgWidth,
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
        font: { loadSystemFonts: false },
        fitTo: {
          mode: "width",
          value: svgWidth,
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
