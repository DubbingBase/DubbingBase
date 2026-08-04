import { useRouter } from "vue-router";

type DeepLinkType = "movie" | "show" | "actor" | "voice-actor";

interface DeepLink {
  type: DeepLinkType;
  id: string;
}

export function parseDeepLink(url: string): DeepLink | null {
  try {
    // Handle both dubbingbase:// and dubbingbase:/ formats
    const match =
      url.match(
        /^dubbingbase:\/\/(movie|show|actor|voice-actor)\/([a-zA-Z0-9_-]+)/i,
      ) ||
      url.match(
        /^dubbingbase:\/(movie|show|actor|voice-actor)\/([a-zA-Z0-9_-]+)/i,
      );

    if (match) {
      return {
        type: match[1].toLowerCase() as DeepLinkType,
        id: match[2],
      };
    }
    return null;
  } catch (error) {
    console.error("Error parsing deep link:", error);
    return null;
  }
}

export function useDeepLinkHandler() {
  const router = useRouter();

  const handleDeepLink = (url: string): boolean => {
    const deepLink = parseDeepLink(url);
    if (!deepLink) return false;

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
  };

  return {
    handleDeepLink,
  };
}
