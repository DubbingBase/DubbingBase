import { router } from "@/router/router";

type DeepLinkType = "movie" | "show" | "actor" | "voice-actor";

interface DeepLink {
  type: DeepLinkType;
  id: string;
}

export function parseDeepLink(url: string): DeepLink | null {
  try {
    // 1. Handle custom schemes dubbingbase:// and dubbingbase:/
    // Allows an optional host or language prefix (e.g., */ or fr/)
    const schemeMatch =
      url.match(
        /^dubbingbase:\/\/(?:[^\/]+\/)?(movie|show|serie|actor|voice-actor)\/([a-zA-Z0-9_-]+)/i,
      ) ||
      url.match(
        /^dubbingbase:\/(?:[^\/]+\/)?(movie|show|serie|actor|voice-actor)\/([a-zA-Z0-9_-]+)/i,
      );

    if (schemeMatch) {
      let type = schemeMatch[1].toLowerCase();
      if (type === "serie") type = "show";
      return {
        type: type as DeepLinkType,
        id: schemeMatch[2],
      };
    }

    // 2. Handle HTTP/HTTPS URLs (Universal Links / App Links) and relative paths
    let pathname = url;
    if (url.startsWith("http://") || url.startsWith("https://")) {
      const parsed = new URL(url);
      pathname = parsed.pathname;
    }

    // Allows an optional language prefix (e.g., /fr/ or fr/)
    const pathMatch = pathname.match(
      /^\/?(?:[^\/]+\/)?(movie|show|serie|actor|voice-actor)\/([a-zA-Z0-9_-]+)/i,
    );
    if (pathMatch) {
      let type = pathMatch[1].toLowerCase();
      if (type === "serie") type = "show";
      return {
        type: type as DeepLinkType,
        id: pathMatch[2],
      };
    }

    return null;
  } catch (error) {
    console.error("Error parsing deep link:", error);
    return null;
  }
}

export function handleDeepLink(url: string): boolean {
  if (!url) return false;

  const deepLink = parseDeepLink(url);
  if (deepLink) {
    const { type, id } = deepLink;

    switch (type) {
      case "movie":
        router.push({ name: "MovieDetails", params: { id } });
        return true;
      case "show":
        router.push({ name: "SerieDetails", params: { id } });
        return true;
      case "actor":
        router.push({ name: "ActorDetails", params: { id } });
        return true;
      case "voice-actor":
        router.push({ name: "voice-actor-details", params: { id } });
        return true;
      default:
        return false;
    }
  }

  // Fallback: If it's a relative path starting with '/', push directly to router
  if (url.startsWith("/")) {
    router.push(url);
    return true;
  }

  // Fallback: If it's a full URL with a valid pathname
  try {
    if (url.startsWith("http://") || url.startsWith("https://")) {
      const parsed = new URL(url);
      if (parsed.pathname && parsed.pathname !== "/") {
        router.push(parsed.pathname);
        return true;
      }
    }
  } catch (e) {
    console.warn("Could not handle link fallback:", e);
  }

  return false;
}

export function useDeepLinkHandler() {
  return {
    handleDeepLink,
  };
}
