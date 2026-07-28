import { createRouter, createWebHistory } from "vue-router";
import Home from "../views/Home.vue";
import VoiceActorDetails from "../views/VoiceActorDetails.vue";

const routes = [
  {
    path: "/",
    name: "Home",
    component: Home,
  },
  {
    path: "/voice-actor/:id",
    name: "VoiceActorDetails",
    component: VoiceActorDetails,
  },
];

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
});

export default router;
