import { useIonRouter } from '@ionic/vue';

type DeepLinkType = 'movie' | 'show';

interface DeepLink {
  type: DeepLinkType;
  id: string;
}

export function parseDeepLink(url: string): DeepLink | null {
  try {
    // Handle both dubbingbase:// and dubbingbase:/ formats
    const match = url.match(/^dubbingbase:\/\/(movie|show)\/(\d+)/i) || 
                 url.match(/^dubbingbase:\/(movie|show)\/(\d+)/i);
    
    if (match) {
      return {
        type: match[1].toLowerCase() as DeepLinkType,
        id: match[2]
      };
    }
    return null;
  } catch (error) {
    console.error('Error parsing deep link:', error);
    return null;
  }
}

export function useDeepLinkHandler() {
  const router = useIonRouter();

  const handleDeepLink = (url: string): boolean => {
    const deepLink = parseDeepLink(url);
    if (!deepLink) return false;

    const { type, id } = deepLink;
    
    switch (type) {
      case 'movie':
        router.push({ name: 'MovieDetails', params: { id } });
        return true;
      case 'show':
        router.push({ name: 'SerieDetails', params: { id } });
        return true;
      default:
        return false;
    }
  };

  return {
    handleDeepLink
  };
}
