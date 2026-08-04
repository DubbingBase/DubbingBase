import { createRouter, createWebHistory } from "@ionic/vue-router";
import type {
  NavigationGuardNext,
  RouteLocationNormalized,
  RouteRecordRaw,
} from "vue-router";
import { useAuthStore } from "@/stores/auth";
import { usePostHog } from "@/composables/usePostHog";

// Import your custom route meta types
import Home from "../views/home.vue";
import Login from "../views/login.vue";

const routes: readonly RouteRecordRaw[] = [
  {
    path: "/",
    redirect: { name: "Home" },
  },
  {
    path: "/login",
    name: "Login",
    component: Login,
  },
  { path: "/home", name: "Home", component: Home },
  {
    name: "Search",
    path: "/search",
    component: () => import("../views/search.vue"),
  },
  {
    name: "Settings",
    path: "/settings",
    component: () => import("../views/settings.vue"),
  },
  {
    name: "Profile",
    path: "/profile",
    component: () => import("../views/profile.vue"),
  },
  {
    name: "About",
    path: "/about",
    component: () => import("../views/about.vue"),
  },
  {
    name: "VoiceActorProfile",
    path: "/voice-actor-profile/:id",
    component: () => import("../views/voice-actor-profile.vue"),
  },
  {
    name: "VoiceActorCreate",
    path: "/voice-actor-profile/new",
    component: () => import("../views/voice-actor-profile.vue"),
  },
  {
    name: "MediaEdit",
    path: "/edit-dubbing-project/:id",
    component: () => import("../views/edit-dubbing-project.vue"),
  },
  {
    name: "MediaCreate",
    path: "/edit-dubbing-project/new",
    component: () => import("../views/edit-dubbing-project.vue"),
  },
  {
    name: "MovieDetails",
    path: "/movie/:id",
    component: () => import("../views/movie-details.vue"),
  },
  {
    name: "ActorDetails",
    path: "/actor/:id",
    component: () => import("../views/actor-details.vue"),
  },
  {
    name: "SerieDetails",
    path: "/serie/:id",
    component: () => import("../views/serie-details.vue"),
  },
  {
    name: "voice-actor-details",
    path: "/voice-actor/:id",
    component: () => import("../views/voice-actor-details.vue"),
  },
  {
    name: "StudioDetails",
    path: "/studio/:id",
    component: () => import("../views/studio-details.vue"),
  },
  {
    name: "StudioEdit",
    path: "/studio-edit/:id",
    component: () => import("../views/edit-studio.vue"),
  },
  {
    name: "StudioCreate",
    path: "/studio-edit/new",
    component: () => import("../views/edit-studio.vue"),
  },
  {
    name: "SeasonDetails",
    path: "/serie/:id/season/:season",
    component: () => import("@/views/season-details.vue"),
  },
  {
    name: "SeasonByEpisodes",
    path: "/serie/:id/season/:season/details/:episode",
    component: () => import("@/views/season-by-episodes.vue"),
  },
];

export const router = createRouter({
  history: createWebHistory(),
  routes,
});

router.beforeEach(
  async (to: RouteLocationNormalized, from: RouteLocationNormalized) => {
    const authStore = useAuthStore();

    await authStore.initialize();

    // Check for admin routes
    if (to.meta.requiresAdmin) {
      if (!authStore.isAdmin) {
        // User is not an admin, redirect to home
        return { name: "Home" };
      }
    }

    // Allow access to the route
    return true;
  },
);

// Optional: Handle redirect after successful login
router.afterEach((to) => {
  // Track page views or perform other post-navigation tasks
  console.log("Navigated to:", to.path);
});

const { posthog } = usePostHog();
