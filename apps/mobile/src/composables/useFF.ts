import { computed } from 'vue';
import type { FeatureFlag }  from '@/types/permissions';
import { usePostHog } from './usePostHog';

export function useFeatureFlags() {
  const { posthog } = usePostHog();

  const hasFeatureFlag = (permission: FeatureFlag) => {
    return posthog.isFeatureEnabled(permission);
  };

  const hasAiScanner = computed(() => hasFeatureFlag('ai-scanner'));

  return {
    hasFeatureFlag,
    hasAiScanner,
  };
}
