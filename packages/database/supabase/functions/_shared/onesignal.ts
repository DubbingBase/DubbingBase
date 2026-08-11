export interface OneSignalOptions {
  targetExternalIds?: string[];
  url?: string;
  data?: Record<string, unknown>;
  imageUrl?: string;
}

export async function sendOneSignalNotification(
  title: string,
  message: string,
  options?: OneSignalOptions,
) {
  const appId = Deno.env.get("ONESIGNAL_APP_ID");
  const apiKey = Deno.env.get("ONESIGNAL_REST_API_KEY");
  const adminId = Deno.env.get("ADMIN_USER_ID");

  if (!appId || !apiKey) {
    console.warn("[OneSignal] Credentials missing, skipping notification");
    return;
  }

  // Determine target users
  let targetExternalIds: string[] = [];

  if (options?.targetExternalIds && options.targetExternalIds.length > 0) {
    targetExternalIds = options.targetExternalIds;
  }

  if (targetExternalIds.length === 0) {
    console.log(
      "[OneSignal] No target external IDs provided, skipping notification.",
    );
    return;
  }

  try {
    const payload: Record<string, unknown> = {
      app_id: appId,
      target_channel: "push",
      include_aliases: {
        external_id: targetExternalIds,
      },
      headings: { en: title },
      contents: { en: message },
    };

    if (options?.imageUrl) {
      payload.big_picture = options.imageUrl;
      payload.ios_attachments = { id1: options.imageUrl };
      payload.chrome_web_image = options.imageUrl;
    }

    if (options?.url) {
      let targetUrl = options.url;
      if (targetUrl.startsWith("/")) {
        const baseUrl =
          Deno.env.get("APP_BASE_URL") || "https://dubbingbase.com";
        // Web URL gets the localized https route
        payload.web_url = `${baseUrl.replace(/\/+$/, "")}/fr${targetUrl}`;
        // App URL gets the custom scheme with asterisk host
        payload.app_url = `dubbingbase://*${targetUrl}`;
      } else {
        payload.web_url = targetUrl;
        payload.app_url = targetUrl;
      }
      payload.data = {
        path: options.url,
        ...(options.data || {}),
      };
    } else if (options?.data) {
      payload.data = options.data;
    }

    const res = await fetch("https://onesignal.com/api/v1/notifications", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      console.error("[OneSignal] API error:", res.status, await res.text());
    } else {
      console.log(
        `[OneSignal] Notification sent successfully to ${targetExternalIds.length} users`,
      );
    }
  } catch (err) {
    console.error("[OneSignal] Fetch exception:", err);
  }
}
