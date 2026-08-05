export default defineNuxtRouteMiddleware((to, from) => {
  const user = useSupabaseUser();
  const localePath = useLocalePath();

  if (!user.value) {
    return navigateTo(localePath("/login"));
  }
});
