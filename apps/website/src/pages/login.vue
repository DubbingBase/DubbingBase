<template>
  <div
    class="relative min-h-screen flex items-center justify-center theme-surface-raised theme-bg px-4 py-12 overflow-hidden select-none"
  >
    <div class="w-full max-w-md z-10">
      <!-- Premium Login Card -->
      <div
        class="relative theme-surface border theme-border-subtle rounded-3xl shadow-2xl p-8 sm:p-10 space-y-8"
      >
        <div class="text-center space-y-2">
          <h3 class="text-2xl font-bold tracking-tight theme-text">
            {{ t("nav.login") }}
          </h3>
          <p class="text-sm theme-text-muted">
            {{ $t("auth.login.subtitle") }}
          </p>
        </div>

        <form class="space-y-5" @submit.prevent="handleLogin">
          <!-- Email Field -->
          <div class="space-y-2">
            <label
              for="email"
              class="text-sm font-medium theme-text-secondary"
              >{{ $t("auth.email") }}</label
            >
            <input
              id="email"
              v-model="email"
              type="email"
              required
              placeholder="user@example.com"
              class="w-full px-4 py-3 theme-input border theme-border-subtle rounded-xl theme-text theme-placeholder theme-focus transition-all duration-200"
            />
          </div>

          <!-- Password Field -->
          <div class="space-y-2">
            <label
              for="password"
              class="text-sm font-medium theme-text-secondary"
              >{{ $t("auth.password") }}</label
            >
            <input
              id="password"
              v-model="password"
              type="password"
              required
              placeholder="••••••••"
              class="w-full px-4 py-3 theme-input border theme-border-subtle rounded-xl theme-text theme-placeholder theme-focus transition-all duration-200"
            />
          </div>

          <!-- Error Alert -->
          <div
            v-if="loginError"
            class="p-4 theme-status-danger border rounded-xl flex items-start space-x-3"
          >
            <svg
              class="h-5 w-5 theme-status-danger-text mt-0.5 shrink-0"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fill-rule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                clip-rule="evenodd"
              />
            </svg>
            <span class="text-sm font-medium theme-status-danger-text">{{
              loginError
            }}</span>
          </div>

          <!-- Link to Register -->
          <div class="text-sm text-center theme-text-muted">
            {{ $t("auth.login.noAccount")
            }}<NuxtLink
              :to="localePath('/register')"
              class="theme-primary-text font-medium hover:underline transition"
              >{{ $t("auth.signUp") }}</NuxtLink
            >
          </div>

          <!-- Submit Button -->
          <button
            type="submit"
            :disabled="loading"
            class="w-full py-3.5 px-4 theme-primary-bg hover:bg-[var(--app-color-primary-hover)] font-semibold rounded-xl shadow-lg shadow-cyan-500/20 transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 flex justify-center items-center"
          >
            <span
              v-if="loading"
              class="animate-spin rounded-full h-5 w-5 border-b-2 theme-border mr-2"
            ></span>
            <span>{{
              loading ? $t("auth.login.signingIn") : $t("auth.signIn")
            }}</span>
          </button>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { useRouter, useRoute } from "vue-router";

// SEO configuration
useSeoMeta({
  title: "Login - DubbingBase",
  description: "Login to access your DubbingBase profile.",
  robots: "noindex, nofollow",
});

const { t } = useI18n();
const router = useRouter();
const route = useRoute();
const supabase = useSupabaseClient();
const user = useSupabaseUser();

const email = ref("");
const password = ref("");
const loading = ref(false);
const loginError = ref<string | null>(null);

const localePath = useLocalePath();

// Redirect if already logged in
onMounted(() => {
  if (user.value) {
    const redirect = route.query.redirect as string;
    router.push(redirect ? redirect : localePath("/profile"));
  }
});

watch(user, (newUser) => {
  if (newUser) {
    const redirect = route.query.redirect as string;
    router.push(redirect ? redirect : localePath("/profile"));
  }
});

const handleLogin = async () => {
  loginError.value = null;
  loading.value = true;

  try {
    const { error } = await supabase.auth.signInWithPassword({
      email: email.value,
      password: password.value,
    });

    if (error) {
      if (error.message.includes("Invalid login credentials")) {
        loginError.value = "Invalid email or password";
      } else {
        loginError.value = error.message;
      }
      return;
    }

    // Redirect to profile page handled by watchEffect
  } catch (err: any) {
    loginError.value = err.message || "An error occurred during login";
  } finally {
    loading.value = false;
  }
};
</script>
