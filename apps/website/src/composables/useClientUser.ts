import { computed, onMounted, ref } from "vue";

/**
 * Supabase user state that is empty during SSR and hydration and only
 * populated after the component mounts on the client.
 *
 * Server-rendered HTML must be identical for every visitor so public pages can
 * be cached at the edge. Anything that depends on the signed-in user (admin
 * links, completeness score, ...) must therefore be rendered from this
 * composable instead of reading `useSupabaseUser()` directly in templates.
 */
export function useClientUser() {
  const supabaseUser = useSupabaseUser();
  const mounted = ref(false);

  onMounted(() => {
    mounted.value = true;
  });

  const user = computed(() => (mounted.value ? supabaseUser.value : null));
  const isAdmin = computed(() => user.value?.app_metadata?.role === "admin");

  return { user, isAdmin };
}
