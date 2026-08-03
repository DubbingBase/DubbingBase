import { isPlatform } from '@ionic/vue';
import OneSignal from '@onesignal/capacitor-plugin';

let initPromise: Promise<void> | null = null;

export function useOneSignal() {
  const initOneSignal = () => {
    // Only initialize on native platforms (iOS/Android)
    if (!isPlatform('capacitor')) {
      console.log('OneSignal skipped: Not running in a native environment');
      return Promise.resolve();
    }

    const appId = import.meta.env.VITE_ONESIGNAL_APP_ID;

    if (!appId) {
      console.warn('OneSignal skipped: VITE_ONESIGNAL_APP_ID is not defined');
      return Promise.resolve();
    }

    if (!initPromise) {
      // Set OneSignal App ID
      initPromise = OneSignal.initialize(appId).then(() => {
        console.log('OneSignal initialized successfully');
      }).catch((error) => {
        console.error("OneSignal initialization failed:", error);
      });
    }
    
    return initPromise;
  };

  const login = async (userId: string) => {
    if (!isPlatform('capacitor')) return;
    if (initPromise) await initPromise;
    try {
      await OneSignal.login(userId);
    } catch (error) {
      console.error("OneSignal login failed:", error);
    }
  };

  const logout = async () => {
    if (!isPlatform('capacitor')) return;
    if (initPromise) await initPromise;
    try {
      await OneSignal.logout();
    } catch (error) {
      console.error("OneSignal logout failed:", error);
    }
  };

  const requestPushPermission = async (fallbackToSettings = true) => {
    if (!isPlatform('capacitor')) return false;

    try {
      if (initPromise) await initPromise;
      const success = await OneSignal.Notifications.requestPermission(fallbackToSettings);
      console.log("OneSignal push permission granted: " + success);
      return success;
    } catch (error) {
      console.error("OneSignal permission request failed:", error);
      return false;
    }
  };

  const hasPermission = async () => {
    if (!isPlatform('capacitor')) return false;
    if (initPromise) await initPromise;
    // Returns boolean indicating if user has granted push permissions
    return await OneSignal.Notifications.hasPermission();
  };

  return {
    initOneSignal,
    login,
    logout,
    requestPushPermission,
    hasPermission
  };
}

