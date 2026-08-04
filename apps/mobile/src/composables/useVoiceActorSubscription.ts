import { ref, computed, toValue, type MaybeRefOrGetter } from 'vue';
import { supabase } from '@/api/supabase';
import { useAuthStore } from '@/stores/auth';
import { useOneSignal } from './useOneSignal';
import { alertController } from '@/composables/useAlert';
import { useI18n } from 'vue-i18n';

export function useVoiceActorSubscription(voiceActorId: MaybeRefOrGetter<string>) {
  const isSubscribed = ref(false);
  const isLoading = ref(true);
  const authStore = useAuthStore();
  const { requestPushPermission } = useOneSignal();
  const { t } = useI18n();

  const fetchSubscription = async () => {
    if (!authStore.user) {
      isLoading.value = false;
      return;
    }

    try {
      const { data, error } = await supabase
        .from('voice_actor_subscriptions')
        .select('*')
        .eq('voice_actor_id', Number(toValue(voiceActorId)))
        .eq('user_id', authStore.user.id)
        .maybeSingle();

      if (error) {
        console.error('Error fetching voice actor subscription:', error);
      } else {
        isSubscribed.value = !!data;
      }
    } catch (err) {
      console.error('Failed to fetch subscription:', err);
    } finally {
      isLoading.value = false;
    }
  };

  const toggleSubscription = async () => {
    if (!authStore.user) {
      // Need to be logged in to subscribe
      const alert = await alertController.create({
        header: t('common.error'),
        message: t('auth.loginRequiredForSubscription'), // Note: this key might need to be added to translations
        buttons: ['OK']
      });
      await alert.present();
      return;
    }

    // Optimistic UI update
    const previousState = isSubscribed.value;
    const newState = !previousState;
    isSubscribed.value = newState;
    isLoading.value = true;

    try {
      if (newState) {
        // Request push permission when subscribing for the first time
        const pushGranted = await requestPushPermission(true);
        if (!pushGranted) {
            console.warn("Push permission not granted, but still subscribing in database.");
        }

        const { error } = await supabase.functions.invoke('manage-subscription', {
          body: { action: 'subscribe', voice_actor_id: Number(toValue(voiceActorId)) }
        });

        if (error) throw error;
      } else {
        // Unsubscribe
        const { error } = await supabase.functions.invoke('manage-subscription', {
          body: { action: 'unsubscribe', voice_actor_id: Number(toValue(voiceActorId)) }
        });

        if (error) throw error;
      }
    } catch (err) {
      console.error('Error toggling subscription:', err);
      // Revert optimistic update
      isSubscribed.value = previousState;
      const alert = await alertController.create({
        header: t('common.error'),
        message: t('errors.failedToUpdateSubscription'), // Note: might need adding to translations
        buttons: ['OK']
      });
      await alert.present();
    } finally {
      isLoading.value = false;
    }
  };

  return {
    isSubscribed: computed(() => isSubscribed.value),
    isLoading: computed(() => isLoading.value),
    fetchSubscription,
    toggleSubscription
  };
}

export async function fetchAllSubscriptions() {
  const { data, error } = await supabase.functions.invoke('manage-subscription', {
    body: { action: 'list' }
  });
  
  if (error) {
    console.error('Failed to fetch all subscriptions:', error);
    return [];
  }
  
  return data?.subscriptions || [];
}
