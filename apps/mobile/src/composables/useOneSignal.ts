import { isPlatform } from '@ionic/vue';
import OneSignal from '@onesignal/capacitor-plugin';

export function useOneSignal() {
  const initOneSignal = () => {
    // Only initialize on native platforms (iOS/Android)
    if (!isPlatform('capacitor')) {
      console.log('OneSignal skipped: Not running in a native environment');
      return;
    }

    const appId = import.meta.env.VITE_ONESIGNAL_APP_ID;

    if (!appId) {
      console.warn('OneSignal skipped: VITE_ONESIGNAL_APP_ID is not defined');
      return;
    }

    try {
      // Set OneSignal App ID
      OneSignal.initialize(appId);
      console.log('OneSignal initialized successfully');
    } catch (error) {
      console.error("OneSignal initialization failed:", error);
    }
  };

  const requestPushPermission = async (fallbackToSettings = true) => {
    if (!isPlatform('capacitor')) return false;

    try {
      const success = await OneSignal.Notifications.requestPermission(fallbackToSettings);
      console.log("OneSignal push permission granted: " + success);
      return success;
    } catch (error) {
      console.error("OneSignal permission request failed:", error);
      return false;
    }
  };

  const hasPermission = () => {
    if (!isPlatform('capacitor')) return false;
    // Returns boolean indicating if user has granted push permissions
    return OneSignal.Notifications.hasPermission;
  };

  return {
    initOneSignal,
    requestPushPermission,
    hasPermission
  };
}
