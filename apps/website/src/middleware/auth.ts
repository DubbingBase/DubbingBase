export default defineNuxtRouteMiddleware((to, from) => {
  const user = useSupabaseUser();
  const localePath = useLocalePath();

  if (!user.value) {
    return navigateTo({
      path: localePath("/login"),
      query: { redirect: to.fullPath },
    });
  }
});
