import { createRouter, createWebHistory } from "vue-router";
import { user, isAdmin, isLoading } from "@/lib/auth";

// Views
import Login from "../views/Login.vue";
import AdminLayout from "../components/AdminLayout.vue";
import Dashboard from "../views/Dashboard.vue";
import VoiceActorSpreadsheet from "../views/VoiceActorSpreadsheet.vue";

const routes = [
  {
    path: "/login",
    name: "Login",
    component: Login,
    meta: { guestOnly: true },
  },
  {
    path: "/",
    component: AdminLayout,
    meta: { requiresAdmin: true },
    children: [
      {
        path: "",
        name: "Dashboard",
        component: Dashboard,
      },
      {
        path: "voice-actor-spreadsheet",
        name: "VoiceActorSpreadsheet",
        component: VoiceActorSpreadsheet,
      },
      {
        path: "queue",
        name: "QueueManagement",
        component: () => import("../views/QueueManagement.vue"),
      },
      {
        path: "users",
        name: "UserManagement",
        component: () => import("../views/UserManagement.vue"),
      },
      {
        path: "duplicates-va",
        name: "DuplicateVATool",
        component: () => import("../views/DuplicateVATool.vue"),
      },
      {
        path: "duplicates-work",
        name: "DuplicateWork",
        component: () => import("../views/DuplicateWork.vue"),
      },
      {
        path: "user-va-profiles",
        name: "LinkUserVoiceActor",
        component: () => import("../views/LinkUserVoiceActor.vue"),
      },
      {
        path: "voice-actors/new",
        name: "CreateVoiceActor",
        component: () => import("../views/EditVoiceActor.vue"),
        beforeEnter: (to, from, next) => {
          if (
            from.name === "VoiceActorSpreadsheet" ||
            from.path === "/voice-actor-spreadsheet"
          ) {
            next();
          } else {
            next("/voice-actor-spreadsheet");
          }
        },
      },
      {
        path: "voice-actors/edit/:id",
        name: "EditVoiceActor",
        component: () => import("../views/EditVoiceActor.vue"),
      },
      {
        path: "add-voice-cast/:id",
        name: "AddVoiceCast",
        component: () => import("../views/AddVoiceCast.vue"),
      },
    ],
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

// Guard helper to wait for auth load
const waitForAuthInit = () => {
  return new Promise<void>((resolve) => {
    if (!isLoading.value) {
      resolve();
      return;
    }

    const interval = setInterval(() => {
      if (!isLoading.value) {
        clearInterval(interval);
        resolve();
      }
    }, 50);
  });
};

router.beforeEach(async (to, _from, next) => {
  // Wait for auth session to load initially
  await waitForAuthInit();

  const authenticated = !!user.value;
  const isUserAdmin = isAdmin.value;

  if (to.meta.requiresAdmin) {
    if (!authenticated) {
      return next("/login");
    }
    if (!isUserAdmin) {
      // Logged in but not an admin, sign out or redirect to login
      return next("/login");
    }
  }

  if (to.meta.guestOnly && authenticated && isUserAdmin) {
    return next("/");
  }

  next();
});

export default router;
