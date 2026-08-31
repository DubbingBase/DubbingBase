export interface DiscordWebhookOptions {
  url?: string;
  imageUrl?: string;
  color?: number;
}

function getDiscordWebhookUrls(): string[] {
  const config = useRuntimeConfig();
  const rawUrls: (string | undefined | null)[] = [
    config.discordWebhookUrl as string,
    config.discordWebhookUrl2 as string,
    config.discordWebhookUrl3 as string,
    process.env.NUXT_DISCORD_WEBHOOK_URL,
    process.env.DISCORD_WEBHOOK_URL,
    process.env.DISCORD_ADMIN_WEBHOOK_LOG_URL,
    process.env.NUXT_DISCORD_WEBHOOK_URL_1,
    process.env.DISCORD_WEBHOOK_URL_1,
    process.env.NUXT_DISCORD_WEBHOOK_URL_2,
    process.env.DISCORD_WEBHOOK_URL_2,
    process.env.NUXT_DISCORD_WEBHOOK_URL_3,
    process.env.DISCORD_WEBHOOK_URL_3,
  ];

  const urls = new Set<string>();

  for (const raw of rawUrls) {
    if (!raw || typeof raw !== "string") continue;
    const split = raw
      .split(/[,;\n]+/)
      .map((u) => u.trim())
      .filter(Boolean);
    for (const u of split) {
      if (u.startsWith("http://") || u.startsWith("https://")) {
        urls.add(u);
      }
    }
  }

  return Array.from(urls);
}

export async function sendDiscordAdminNotification(
  title: string,
  message: string,
  options?: DiscordWebhookOptions,
) {
  const webhookUrls = getDiscordWebhookUrls();

  if (webhookUrls.length === 0) {
    console.warn("[Discord] Webhook URL missing, skipping notification");
    return;
  }

  try {
    const truncatedMessage =
      message.length > 2000
        ? message.slice(0, 1980) + "\n... (truncated)"
        : message;

    const embed: any = {
      title: title.slice(0, 250),
      description: truncatedMessage,
      color: options?.color ?? 0x5865f2,
      timestamp: new Date().toISOString(),
    };

    if (options?.url) {
      let targetUrl = options.url;
      if (targetUrl.startsWith("/")) {
        const baseUrl = "https://dubbingbase.com";
        targetUrl = `${baseUrl.replace(/\/+$/, "")}/fr${targetUrl}`;
      }
      embed.url = targetUrl;
    }

    if (options?.imageUrl) {
      embed.image = { url: options.imageUrl };
    }

    const payload = JSON.stringify({ embeds: [embed] });

    await Promise.allSettled(
      webhookUrls.map(async (webhookUrl) => {
        try {
          const res = await fetch(webhookUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: payload,
          });

          if (!res.ok) {
            const errText = await res.text();
            console.error(
              `[Discord] Webhook API error (${webhookUrl.slice(0, 35)}... status ${res.status}):`,
              errText,
            );
          }
        } catch (err) {
          console.error(
            `[Discord] Webhook fetch error (${webhookUrl.slice(0, 35)}...):`,
            err,
          );
        }
      }),
    );
  } catch (err) {
    console.error("[Discord] Notification exception:", err);
  }
}
