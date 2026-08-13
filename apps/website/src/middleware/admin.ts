export default defineNuxtRouteMiddleware((to, from) => {
  const user = useSupabaseUser();
  const localePath = useLocalePath();

  if (!user.value) {
    return navigateTo({
      path: localePath("/login"),
      query: { redirect: to.fullPath },
    });
  }

  const isAdmin =
    user.value?.app_metadata?.role === "admin" ||
    user.value?.user_metadata?.role === "admin";

  if (!isAdmin) {
    return navigateTo(localePath("/"));
  }
});
