export default defineNuxtRouteMiddleware(async (to) => {
  const user = useSupabaseUser();
  const localePath = useLocalePath();

  if (!user.value) {
    return navigateTo({
      path: localePath("/login"),
      query: { redirect: to.fullPath },
    });
  }

  const isAdmin = user.value?.app_metadata?.role === "admin";

  if (!isAdmin) {
    return navigateTo(localePath("/"));
  }

  const isDashboard = to.path.replace(/\/$/, "").endsWith("/admin");

  if (import.meta.client && isDashboard) {
    const {
      ArcElement,
      BarElement,
      CategoryScale,
      Chart: ChartJS,
      Filler,
      Legend,
      LinearScale,
      LineElement,
      PointElement,
      Title,
      Tooltip,
    } = await import("chart.js");

    ChartJS.register(
      Title,
      Tooltip,
      Legend,
      BarElement,
      CategoryScale,
      LinearScale,
      PointElement,
      LineElement,
      ArcElement,
      Filler,
    );
  }
});
