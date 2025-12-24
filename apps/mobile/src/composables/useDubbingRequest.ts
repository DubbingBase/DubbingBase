import { ref } from 'vue';
import { supabase } from '@/api/supabase';
import { useAuthStore } from '@/stores/auth';
import { toastController } from '@ionic/vue';

export function useDubbingRequest() {
  const isRequesting = ref(false);

  const requestDubbing = async (mediaType: 'movie' | 'tv' | 'serie', mediaId: number | string, mediaTitle: string) => {
    const authStore = useAuthStore();

    // Check if user is logged in
    if (!authStore.isAuthenticated || !authStore.user?.email) {
      const toast = await toastController.create({
        message: 'You must be logged in to request dubbing.',
        duration: 3000,
        color: 'warning',
        position: 'top',
      });
      await toast.present();
      return;
    }

    try {
      isRequesting.value = true;

      const { data, error } = await supabase.functions.invoke('request-dubbing', {
        body: {
          media_type: mediaType,
          media_id: mediaId,
          media_title: mediaTitle,
          user_email: authStore.user.email,
        },
      });

      if (error) throw error;

      const toast = await toastController.create({
        message: 'Request sent!',
        duration: 3000,
        color: 'success',
        position: 'top',
      });
      await toast.present();

    } catch (err: any) {
      console.error('Error requesting dubbing:', err);
      const toast = await toastController.create({
        message: 'Failed to send request. Please try again.',
        duration: 3000,
        color: 'danger',
        position: 'top',
      });
      await toast.present();
    } finally {
      isRequesting.value = false;
    }
  };

  return {
    isRequesting,
    requestDubbing,
  };
}
