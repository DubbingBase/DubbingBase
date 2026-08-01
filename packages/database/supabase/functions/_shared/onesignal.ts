export async function sendOneSignalNotification(title: string, message: string) {
  const appId = Deno.env.get("ONESIGNAL_APP_ID");
  const apiKey = Deno.env.get("ONESIGNAL_REST_API_KEY");

  if (!appId || !apiKey) {
    console.warn("[OneSignal] Credentials missing, skipping notification");
    return;
  }

  try {
    const res = await fetch("https://onesignal.com/api/v1/notifications", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${apiKey}`,
      },
      body: JSON.stringify({
        app_id: appId,
        included_segments: ["Total Subscriptions"],
        headings: { en: title },
        contents: { en: message },
      }),
    });

    if (!res.ok) {
      console.error("[OneSignal] API error:", res.status, await res.text());
    } else {
      console.log("[OneSignal] Notification sent successfully");
    }
  } catch (err) {
    console.error("[OneSignal] Fetch exception:", err);
  }
}
