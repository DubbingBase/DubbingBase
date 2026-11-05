export default defineNuxtRouteMiddleware((to) => {
  const user = useSupabaseUser();
  const localePath = useLocalePath();

  if (!user.value) {
    return navigateTo({
      path: localePath("/login"),
      query: { redirect: to.fullPath },
    });
  }
});
