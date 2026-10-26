<template>
  <div
    class="relative min-h-screen flex items-center justify-center theme-surface-raised theme-bg px-4 py-12 overflow-hidden select-none"
  >
    <div class="w-full max-w-md z-10">
      <!-- Premium Register Card -->
      <div
        class="relative theme-surface border theme-border-subtle rounded-3xl shadow-2xl p-8 sm:p-10 space-y-8"
      >
        <div class="text-center space-y-2">
          <h3 class="text-2xl font-bold tracking-tight theme-text">
            {{ $t("auth.register.title") }}
          </h3>
          <p class="text-sm theme-text-muted">
            {{ $t("auth.register.subtitle") }}
          </p>
        </div>

        <form class="space-y-5" @submit.prevent="handleRegister">
          <!-- Username Field -->
          <div class="space-y-2">
            <label
              for="username"
              class="text-sm font-medium theme-text-secondary"
              >{{ $t("auth.username") }}</label
            >
            <input
              id="username"
              v-model="username"
              type="text"
              required
              placeholder="Your username"
              class="w-full px-4 py-3 theme-input border theme-border-subtle rounded-xl theme-text theme-placeholder theme-focus transition-all duration-200"
            />
          </div>

          <!-- Full Name Field -->
          <div class="space-y-2">
            <label
              for="full_name"
              class="text-sm font-medium theme-text-secondary"
              >{{ $t("auth.fullName")
              }}<span class="theme-text-muted font-normal">{{
                $t("auth.register.optional")
              }}</span></label
            >
            <input
              id="full_name"
              v-model="full_name"
              type="text"
              placeholder="John Doe"
              class="w-full px-4 py-3 theme-input border theme-border-subtle rounded-xl theme-text theme-placeholder theme-focus transition-all duration-200"
            />
          </div>

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

          <!-- Error/Success Alert -->
          <div
            v-if="authMessage"
            :class="[
              'p-4 border rounded-xl flex items-start space-x-3',
              isError ? 'theme-status-danger' : 'theme-status-success',
            ]"
          >
            <svg
              v-if="isError"
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
            <svg
              v-else
              class="h-5 w-5 theme-status-success-text mt-0.5 shrink-0"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fill-rule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clip-rule="evenodd"
              />
            </svg>
            <span
              :class="[
                'text-sm font-medium',
                isError
                  ? 'theme-status-danger-text'
                  : 'theme-status-success-text',
              ]"
              >{{ authMessage }}</span
            >
          </div>

          <!-- Terms Agreement -->
          <p class="text-xs theme-text-muted text-center px-4 leading-relaxed">
            {{ $t("auth.register.agreeToTerms")
            }}<NuxtLink
              :to="localePath('/terms')"
              class="theme-primary-text hover:underline"
              >{{ $t("footer.terms") }}</NuxtLink
            >.
          </p>

          <!-- Link to Login -->
          <div class="text-sm text-center theme-text-muted">
            {{ $t("auth.register.alreadyHaveAccount")
            }}<NuxtLink
              :to="localePath('/login')"
              class="theme-primary-text font-medium hover:underline transition"
              >{{ $t("auth.signIn") }}</NuxtLink
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
              loading ? $t("auth.register.creating") : $t("auth.signUp")
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
  title: "Register - DubbingBase",
  description: "Create a DubbingBase profile.",
  robots: "noindex, nofollow",
});

const { t } = useI18n();
const router = useRouter();
const route = useRoute();
const supabase = useSupabaseClient();
const user = useSupabaseUser();

const username = ref("");
const full_name = ref("");
const email = ref("");
const password = ref("");
const loading = ref(false);
const authMessage = ref<string | null>(null);
const isError = ref(true);

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

const handleRegister = async () => {
  authMessage.value = null;
  loading.value = true;
  isError.value = true;

  try {
    const { error, data } = await supabase.auth.signUp({
      email: email.value,
      password: password.value,
      options: {
        data: {
          username: username.value,
          full_name: full_name.value,
        },
      },
    });

    if (error) {
      authMessage.value = error.message;
      return;
    }

    if (data.user && data.session === null) {
      // Typically implies email confirmation is required
      isError.value = false;
      authMessage.value =
        "Registration successful! Please check your email to verify your account.";
    } else {
      isError.value = false;
      const redirect = route.query.redirect as string;
      router.push(redirect ? redirect : localePath("/profile"));
    }
  } catch (err: any) {
    authMessage.value = err.message || "An error occurred during registration";
  } finally {
    loading.value = false;
  }
};
</script>
