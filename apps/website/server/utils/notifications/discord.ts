export interface DiscordWebhookOptions {
  url?: string;
  imageUrl?: string;
}

export async function sendDiscordAdminNotification(
  title: string,
  message: string,
  options?: DiscordWebhookOptions,
) {
  const config = useRuntimeConfig();
  const webhookUrl = config.discordWebhookUrl as string;

  if (!webhookUrl || typeof webhookUrl !== "string") {
    console.warn("[Discord] Webhook URL missing, skipping notification");
    return;
  }

  try {
    const embed: any = {
      title,
      description: message,
      color: 0x5865f2,
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

    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ embeds: [embed] }),
    });

    if (!res.ok) {
      console.error(
        "[Discord] Webhook API error:",
        res.status,
        await res.text(),
      );
    }
  } catch (err) {
    console.error("[Discord] Fetch exception:", err);
  }
}
