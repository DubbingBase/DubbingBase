export interface DiscordWebhookOptions {
  url?: string;
  imageUrl?: string;
}

export async function sendDiscordAdminNotification(
  title: string,
  message: string,
  options?: DiscordWebhookOptions,
) {
  const webhookUrl = Deno.env.get("DISCORD_ADMIN_WEBHOOK_LOG_URL");

  if (!webhookUrl) {
    console.warn("[Discord] Webhook URL missing, skipping notification");
    return;
  }

  try {
    const embed: any = {
      title,
      description: message,
      color: 0x5865f2, // Discord Blurple
      timestamp: new Date().toISOString(),
    };

    if (options?.url) {
      let targetUrl = options.url;
      if (targetUrl.startsWith("/")) {
        const baseUrl =
          Deno.env.get("APP_BASE_URL") || "https://dubbingbase.com";
        targetUrl = `${baseUrl.replace(/\/+$/, "")}/fr${targetUrl}`;
      }
      embed.url = targetUrl;
    }

    if (options?.imageUrl) {
      embed.image = { url: options.imageUrl };
    }

    const payload = {
      embeds: [embed],
    };

    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      console.error(
        "[Discord] Webhook API error:",
        res.status,
        await res.text(),
      );
    } else {
      console.log("[Discord] Webhook notification sent successfully");
    }
  } catch (err) {
    console.error("[Discord] Fetch exception:", err);
  }
}
