export type QueueName =
  "wiki_discovery" | "wiki_check" | "wiki_extract" | string;

export interface DiscordWebhookOptions {
  queue?: QueueName;
  url?: string;
  imageUrl?: string;
  color?: number;
  event?: any;
}

function getDiscordWebhookUrls(queue?: string, event?: any): string[] {
  let config: any;
  try {
    config = event ? useRuntimeConfig(event) : useRuntimeConfig();
  } catch {
    config = useRuntimeConfig();
  }
  const cfEnv = event?.context?.cloudflare?.env;
  const targetUrls = new Set<string>();

  const addUrls = (raw: string | undefined | null) => {
    if (!raw || typeof raw !== "string") return;
    const split = raw
      .split(/[,;\n]+/)
      .map((u) => u.trim())
      .filter(Boolean);
    for (const u of split) {
      if (u.startsWith("http://") || u.startsWith("https://")) {
        targetUrls.add(u);
      }
    }
  };

  // 1. Check queue-specific webhook variables
  if (queue === "wiki_discovery" || queue === "discovery") {
    addUrls(config.discordWebhookDiscoveryUrl as string);
    addUrls(cfEnv?.NUXT_DISCORD_WEBHOOK_DISCOVERY_URL);
    addUrls(cfEnv?.DISCORD_WEBHOOK_DISCOVERY_URL);
    addUrls(cfEnv?.DISCORD_DISCOVERY_WEBHOOK_URL);
    addUrls(process.env.NUXT_DISCORD_WEBHOOK_DISCOVERY_URL);
    addUrls(process.env.DISCORD_WEBHOOK_DISCOVERY_URL);
    addUrls(process.env.DISCORD_DISCOVERY_WEBHOOK_URL);
  } else if (queue === "wiki_check" || queue === "check") {
    addUrls(config.discordWebhookCheckUrl as string);
    addUrls(cfEnv?.NUXT_DISCORD_WEBHOOK_CHECK_URL);
    addUrls(cfEnv?.DISCORD_WEBHOOK_CHECK_URL);
    addUrls(cfEnv?.DISCORD_CHECK_WEBHOOK_URL);
    addUrls(process.env.NUXT_DISCORD_WEBHOOK_CHECK_URL);
    addUrls(process.env.DISCORD_WEBHOOK_CHECK_URL);
    addUrls(process.env.DISCORD_CHECK_WEBHOOK_URL);
  } else if (queue === "wiki_extract" || queue === "extract") {
    addUrls(config.discordWebhookExtractUrl as string);
    addUrls(cfEnv?.NUXT_DISCORD_WEBHOOK_EXTRACT_URL);
    addUrls(cfEnv?.DISCORD_WEBHOOK_EXTRACT_URL);
    addUrls(cfEnv?.DISCORD_EXTRACT_WEBHOOK_URL);
    addUrls(process.env.NUXT_DISCORD_WEBHOOK_EXTRACT_URL);
    addUrls(process.env.DISCORD_WEBHOOK_EXTRACT_URL);
    addUrls(process.env.DISCORD_EXTRACT_WEBHOOK_URL);
  }

  // 2. Fallback to general admin webhooks if no queue-specific URL was configured
  if (targetUrls.size === 0) {
    addUrls(config.discordWebhookUrl as string);
    addUrls(config.discordWebhookUrl2 as string);
    addUrls(config.discordWebhookUrl3 as string);
    addUrls(cfEnv?.NUXT_DISCORD_WEBHOOK_URL);
    addUrls(cfEnv?.DISCORD_WEBHOOK_URL);
    addUrls(cfEnv?.DISCORD_ADMIN_WEBHOOK_LOG_URL);
    addUrls(process.env.NUXT_DISCORD_WEBHOOK_URL);
    addUrls(process.env.DISCORD_WEBHOOK_URL);
    addUrls(process.env.DISCORD_ADMIN_WEBHOOK_LOG_URL);
    addUrls(process.env.NUXT_DISCORD_WEBHOOK_URL_1);
    addUrls(process.env.DISCORD_WEBHOOK_URL_1);
    addUrls(process.env.NUXT_DISCORD_WEBHOOK_URL_2);
    addUrls(process.env.DISCORD_WEBHOOK_URL_2);
    addUrls(process.env.NUXT_DISCORD_WEBHOOK_URL_3);
    addUrls(process.env.DISCORD_WEBHOOK_URL_3);
  }

  return Array.from(targetUrls);
}

export async function sendDiscordAdminNotification(
  title: string,
  message: string,
  options?: DiscordWebhookOptions,
) {
  const webhookUrls = getDiscordWebhookUrls(options?.queue, options?.event);

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
