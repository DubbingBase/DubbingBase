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

function buildHomeOgImage(lang: string) {
  const isFr = lang.startsWith("fr");
  return {
    svgWidth: 1200,
    svgHeight: 630,
    template: {
      type: "div",
      props: {
        style: {
          display: "flex",
          flexDirection: "column",
          width: "1200px",
          height: "630px",
          background:
            "linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)",
          color: "white",
          fontFamily: "Inter",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
        },
        children: [
          {
            type: "h1",
            props: {
              style: {
                fontSize: "100px",
                fontWeight: 700,
                margin: "0 0 20px 0",
                background: "linear-gradient(to right, #60a5fa, #818cf8)",
                backgroundClip: "text",
                color: "transparent",
              },
              children: "DubbingBase",
            },
          },
          {
            type: "p",
            props: {
              style: {
                fontSize: "40px",
                fontWeight: 400,
                color: "#94a3b8",
                margin: 0,
                textAlign: "center",
                maxWidth: "800px",
              },
              children: isFr
                ? "La base de données collaborative du doublage"
                : "The collaborative dubbing database",
            },
          },
        ],
      },
    },
  };
}

function buildMediaOgImage(
  media: any,
  posterDataUri: string | null,
  lang: string,
) {
  const isFr = lang.startsWith("fr");
  const title = media.title || media.name || "Unknown";
  const releaseDate = media.release_date || media.first_air_date || "";
  const year = releaseDate ? releaseDate.split("-")[0] : "";
  const overview = media.overview || "";

  return {
    svgWidth: 1200,
    svgHeight: 630,
    template: {
      type: "div",
      props: {
        style: {
          display: "flex",
          width: "1200px",
          height: "630px",
          background:
            "linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)",
          color: "white",
          fontFamily: "Inter",
          padding: "60px",
          gap: "60px",
          alignItems: "center",
          position: "relative",
        },
        children: [
          posterDataUri
            ? {
                type: "img",
                props: {
                  src: posterDataUri,
                  style: {
                    width: "340px",
                    height: "510px",
                    borderRadius: "16px",
                    objectFit: "cover",
                    boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
                  },
                },
              }
            : {
                type: "div",
                props: {
                  style: {
                    width: "340px",
                    height: "510px",
                    borderRadius: "16px",
                    background: "#334155",
                  },
                },
              },
          {
            type: "div",
            props: {
              style: {
                display: "flex",
                flexDirection: "column",
                flex: 1,
                justifyContent: "center",
              },
              children: [
                {
                  type: "h1",
                  props: {
                    style: {
                      fontSize: "64px",
                      fontWeight: 700,
                      margin: "0 0 16px 0",
                      color: "#f1f5f9",
                      lineHeight: 1.1,
                      overflow: "hidden",
                    },
                    children: title,
                  },
                },
                {
                  type: "p",
                  props: {
                    style: {
                      fontSize: "32px",
                      color: "#94a3b8",
                      margin: "0 0 32px 0",
                    },
                    children: year,
                  },
                },
                {
                  type: "p",
                  props: {
                    style: {
                      fontSize: "24px",
                      color: "#cbd5e1",
                      margin: "0",
                      lineHeight: 1.5,
                      maxHeight: "180px",
                      overflow: "hidden",
                    },
                    children:
                      overview.length > 200
                        ? overview.substring(0, 200) + "..."
                        : overview,
                  },
                },
                {
                  type: "div",
                  props: {
                    style: {
                      marginTop: "40px",
                      padding: "16px 24px",
                      background: "rgba(59, 130, 246, 0.1)",
                      border: "1px solid rgba(59, 130, 246, 0.3)",
                      borderRadius: "12px",
                      display: "flex",
                    },
                    children: [
                      {
                        type: "p",
                        props: {
                          style: {
                            fontSize: "24px",
                            color: "#60a5fa",
                            margin: 0,
                            fontWeight: 600,
                          },
                          children: isFr
                            ? "Découvrez le casting VF sur DubbingBase"
                            : "Discover the dubbing cast on DubbingBase",
                        },
                      },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
  };
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
}) {
  const isFr = params.lang.startsWith("fr");
  const dict = (isFr ? fr : en) as any;

  const tVoiceActor =
    dict.profile?.voiceActorProfile ||
    (isFr ? "Comédien de doublage" : "Voice Actor");
  const tRole = (count: number) => {
    return count === 1
      ? dict.actor?.role || (isFr ? "Rôle" : "Role")
      : dict.actor?.roles || (isFr ? "Rôles" : "Roles");
  };
  const tAs = dict.actor?.as || (isFr ? "dans le rôle de" : "as");
  const tSeeOtherRoles = (count: number) => {
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
      const typeParam = url.searchParams.get("type") || "actor";
      const langParam = url.searchParams.get("lang") || "fr-FR";

      let svgWidth = 1200;
      let svgHeight = 630;
      let template: any = null;

      const dbClient = new DatabaseClient(ctx);
      const acceptLanguage = req.headers.get("Accept-Language") || undefined;
      const mediaService = new MediaService(
        dbClient,
        tmdbClient,
        ctx,
        acceptLanguage,
      );

      if (typeParam === "home") {
        const result = buildHomeOgImage(langParam);
        svgWidth = result.svgWidth;
        svgHeight = result.svgHeight;
        template = result.template;
      } else if (typeParam === "movie" || typeParam === "series") {
        const idParam = url.searchParams.get("id");
        if (!idParam) return createErrorResponse("Missing id parameter", 400);
        const id = parseInt(idParam, 10);
        if (isNaN(id)) return createErrorResponse("Invalid id parameter", 400);

        const { media } = await mediaService.getMediaWithVoiceActors(
          typeParam === "movie" ? "movie" : "tv",
          id,
        );

        if (!media) {
          return createErrorResponse("Media not found", 404);
        }

        let posterDataUri = null;
        if (media.poster_path) {
          // fetch high-res poster if possible
          posterDataUri = await fetchImageAsDataUri(
            media.poster_path.replace("/w500/", "/w780/"),
          );
        }

        const result = buildMediaOgImage(media, posterDataUri, langParam);
        svgWidth = result.svgWidth;
        svgHeight = result.svgHeight;
        template = result.template;
      } else {
        // default: actor
        const idParam = url.searchParams.get("id");
        if (!idParam) return createErrorResponse("Missing id parameter", 400);
        const id = parseInt(idParam, 10);
        if (isNaN(id)) return createErrorResponse("Invalid id parameter", 400);

        const result = await mediaService.getVoiceActorWithWorkAndMedia(
          id,
          langParam,
        );

        if (!result?.voiceActor) {
          return createErrorResponse("Voice actor not found", 404);
        }

        const { voiceActor, medias, characterProfilePictures } = result;

        let mappedWorks = (voiceActor.work || []).reduce(
          (acc: any[], w: any) => {
            const contentId = w.dubbing_projects?.content_id;
            const media = medias.find((m: any) => m.id === contentId);

            if (!media || !media.credits?.cast) return acc;

            const castMember = media.credits.cast.find(
              (c: any) => c.id === w.actor_id,
            );
            if (!castMember) return acc;

            let characterName = castMember.character || w.performance || "";
            if (characterName.toLowerCase().includes("dialogue")) {
              characterName = "";
            }

            let characterImage = null;
            if (castMember.profile_path) {
              characterImage = castMember.profile_path.replace(
                "/w500/",
                "/w92/",
              );
            }

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
          },
          [],
        );

        mappedWorks.sort((a: any, b: any) => b.popularity - a.popularity);

        const totalWorks = mappedWorks.length;
        const DISPLAY_LIMIT = 50;
        const otherRolesCount = Math.max(0, totalWorks - DISPLAY_LIMIT);
        mappedWorks = mappedWorks.slice(0, DISPLAY_LIMIT);

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

        const res = buildCareerGridImage({
          name,
          avatarDataUri,
          otherRolesCount,
          works,
          lang: langParam,
        });

        svgWidth = res.svgWidth;
        svgHeight = res.svgHeight;
        template = res.template;
      }

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
      console.error("Error generating OG image:", error);
      return createErrorResponse("Failed to generate OG image");
    }
  }),
};
