let wasmInitialized = false;
let fontDataRegular: ArrayBuffer | null = null;
let fontDataBold: ArrayBuffer | null = null;

async function initialize() {
  if (!wasmInitialized) {
    const { initWasm } = await import("@resvg/resvg-wasm");
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

function buildVoiceActorOg(params: {
  name: string;
  imageDataUri: string | null;
  worksCount: number;
  nationality: string | null;
}) {
  const avatarNode = params.imageDataUri
    ? {
        type: "img",
        props: {
          src: params.imageDataUri,
          width: 360,
          height: 360,
          style: {
            borderRadius: "180px",
            objectFit: "cover",
            border: "8px solid rgba(148, 163, 184, 0.3)",
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
            width: "360px",
            height: "360px",
            borderRadius: "180px",
            background: "linear-gradient(135deg, #334155, #475569)",
            border: "8px solid rgba(148, 163, 184, 0.3)",
            color: "#64748b",
            fontSize: "150px",
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
        alignItems: "center",
        justifyContent: "center",
        width: "1200px",
        height: "630px",
        background:
          "linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)",
        color: "white",
        fontFamily: "Inter",
        padding: "64px 80px",
      },
      children: [
        {
          type: "div",
          props: {
            style: {
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "380px",
              flexShrink: 0,
            },
            children: avatarNode,
          },
        },
        {
          type: "div",
          props: {
            style: {
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              flex: 1,
              paddingLeft: "64px",
            },
            children: [
              {
                type: "p",
                props: {
                  style: {
                    fontSize: "28px",
                    color: "#94a3b8",
                    margin: "0 0 16px 0",
                    letterSpacing: "3px",
                    textTransform: "uppercase" as const,
                  },
                  children: params.nationality
                    ? `Voice Actor • ${params.nationality}`
                    : "Voice Actor",
                },
              },
              {
                type: "p",
                props: {
                  style: {
                    fontSize: "68px",
                    fontWeight: 700,
                    margin: "0",
                    color: "#f1f5f9",
                    lineHeight: 1.1,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  },
                  children: params.name,
                },
              },
              {
                type: "div",
                props: {
                  style: {
                    display: "flex",
                    alignItems: "center",
                    marginTop: "32px",
                  },
                  children: {
                    type: "div",
                    props: {
                      style: {
                        display: "flex",
                        alignItems: "center",
                        background: "rgba(99, 102, 241, 0.15)",
                        border: "2px solid rgba(99, 102, 241, 0.3)",
                        borderRadius: "16px",
                        padding: "16px 32px",
                      },
                      children: {
                        type: "p",
                        props: {
                          style: {
                            fontSize: "32px",
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
              {
                type: "p",
                props: {
                  style: {
                    fontSize: "24px",
                    color: "#475569",
                    margin: "64px 0 0 0",
                    fontWeight: 600,
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

export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event);
    const type = query.type as string;

    if (!type) {
      throw createError({
        statusCode: 400,
        message: "Missing type parameter",
      });
    }

    await initialize();

    const { default: satori } = await import("satori");
    const { Resvg } = await import("@resvg/resvg-wasm");

    let template;

    if (type === "voice-actor") {
      const id = query.id as string;
      if (!id) {
        throw createError({
          statusCode: 400,
          message: "Missing id parameter",
        });
      }

      const supabaseAdmin = useSupabaseAdmin();
      const { data: voiceActor, error } = await supabaseAdmin
        .from("voice_actors")
        .select(
          "id, firstname, lastname, profile_picture, nationality, work(id)",
        )
        .eq("id", Number(id))
        .single();

      if (error || !voiceActor) {
        throw createError({ statusCode: 404, message: "Actor not found" });
      }

      const name =
        `${voiceActor.firstname} ${voiceActor.lastname}`.trim() || "Unknown";
      const worksCount = voiceActor.work?.length ?? 0;
      const nationality = voiceActor.nationality;

      let imageDataUri: string | null = null;
      if (voiceActor.profile_picture) {
        const config = useRuntimeConfig();
        const supabaseUrl = config.supabaseUrl ?? "";
        const bucket = "voice_actor_profile_pictures";
        const storageUrl = `${supabaseUrl}/storage/v1/object/public/${bucket}/${voiceActor.profile_picture}`;
        imageDataUri = await fetchImageAsDataUri(storageUrl);
      }

      template = buildVoiceActorOg({
        name,
        imageDataUri,
        worksCount,
        nationality,
      });
    } else {
      throw createError({
        statusCode: 400,
        message: `Unsupported type: ${type}`,
      });
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

    setResponseHeaders(event, {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=86400, s-maxage=86400",
    });

    return new Response(pngBuffer as any, {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=86400, s-maxage=86400",
      },
    });
  } catch (error) {
    console.error("Error generating OG image:", error);
    if (error instanceof Error && "statusCode" in error) throw error;
    throw createError({
      statusCode: 500,
      message: "Failed to generate OG image",
    });
  }
});
