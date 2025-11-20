import { computed } from "vue";
import { useAuthStore } from "@/stores/auth";
import type { Permission } from "@/types/permissions";

export function usePermissions() {
  const authStore = useAuthStore();

  const hasPermission = (permission: Permission): boolean => {
    // console.log('[usePermissions] Checking permission:', permission, 'isAuthenticated:', authStore.isAuthenticated);

    // Check specific permissions for authenticated users
    if (permission === "add_voice_actors") {
      // console.log('[usePermissions] Granting add_voice_actors permission');
      return authStore.isAuthenticated;
    }

    if (permission === "delete_voice_actor_link") {
      // console.log('[usePermissions] Granting add_voice_actors permission');
      return authStore.isAuthenticated;
    }

    if (permission === "edit_voice_actor_link") {
      // console.log('[usePermissions] Granting add_voice_actors permission');
      return authStore.isAuthenticated;
    }

    if (permission === "admin_fetch") {
      // console.log('[usePermissions] Checking admin_fetch permission');
      return authStore.isAdmin;
    }

    // console.log('[usePermissions] Permission not recognized or denied');
    return false;
  };

  const canAddVoiceActors = computed(() => hasPermission("add_voice_actors"));
  const canAdminFetch = computed(() => hasPermission("admin_fetch"));

  return {
    hasPermission,
    canAddVoiceActors,
    canAdminFetch,
    isLoading: computed(() => authStore.isLoading),
    error: computed(() => authStore.error),
  };
}
