export default defineNuxtRouteMiddleware((to, from) => {
  const user = useSupabaseUser();

  if (!user.value) {
    return navigateTo("/login");
  }

  const isAdmin =
    user.value?.app_metadata?.role === "admin" ||
    user.value?.user_metadata?.role === "admin";

  if (!isAdmin) {
    return navigateTo("/");
  }
});
