<template>
  <div class="relative min-h-screen flex items-center justify-center bg-gray-50 dark:bg-[#121212] px-4 py-12 overflow-hidden select-none">
    <div class="w-full max-w-md z-10">

      <!-- Premium Register Card -->
      <div class="relative bg-white dark:bg-[#18181b] border border-gray-200 dark:border-white/5 rounded-3xl shadow-2xl p-8 sm:p-10 space-y-8">
        
        <div class="text-center space-y-2">
          <h3 class="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">Create an account</h3>
          <p class="text-sm text-gray-500 dark:text-gray-400">Join DubbingBase today</p>
        </div>

        <form class="space-y-5" @submit.prevent="handleRegister">
          <!-- Username Field -->
          <div class="space-y-2">
            <label for="username" class="text-sm font-medium text-gray-700 dark:text-gray-300">Username</label>
            <input
              id="username"
              v-model="username"
              type="text"
              required
              placeholder="Your username"
              class="w-full px-4 py-3 bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 transition-all duration-200"
            />
          </div>

          <!-- Full Name Field -->
          <div class="space-y-2">
            <label for="full_name" class="text-sm font-medium text-gray-700 dark:text-gray-300">Full Name <span class="text-gray-500 font-normal">(Optional)</span></label>
            <input
              id="full_name"
              v-model="full_name"
              type="text"
              placeholder="John Doe"
              class="w-full px-4 py-3 bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 transition-all duration-200"
            />
          </div>

          <!-- Email Field -->
          <div class="space-y-2">
            <label for="email" class="text-sm font-medium text-gray-700 dark:text-gray-300">Email address</label>
            <input
              id="email"
              v-model="email"
              type="email"
              required
              placeholder="user@example.com"
              class="w-full px-4 py-3 bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 transition-all duration-200"
            />
          </div>

          <!-- Password Field -->
          <div class="space-y-2">
            <label for="password" class="text-sm font-medium text-gray-700 dark:text-gray-300">Password</label>
            <input
              id="password"
              v-model="password"
              type="password"
              required
              placeholder="••••••••"
              class="w-full px-4 py-3 bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 transition-all duration-200"
            />
          </div>

          <!-- Error/Success Alert -->
          <div v-if="authMessage" :class="[
            'p-4 border rounded-xl flex items-start space-x-3',
            isError ? 'bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/20' : 'bg-green-50 dark:bg-green-500/10 border-green-200 dark:border-green-500/20'
          ]">
            <svg v-if="isError" class="h-5 w-5 text-red-500 mt-0.5 shrink-0" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
            </svg>
            <svg v-else class="h-5 w-5 text-green-500 mt-0.5 shrink-0" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
            </svg>
            <span :class="['text-sm font-medium', isError ? 'text-red-800 dark:text-red-200' : 'text-green-800 dark:text-green-200']">{{ authMessage }}</span>
          </div>

          <!-- Terms Agreement -->
          <p class="text-xs text-gray-500 dark:text-gray-400 text-center px-4 leading-relaxed">
            By creating an account, you agree to our 
            <NuxtLink :to="$localePath('/terms')" class="text-cyan-600 dark:text-cyan-400 hover:underline">Terms of Service</NuxtLink>.
          </p>

          <!-- Link to Login -->
          <div class="text-sm text-center text-gray-500 dark:text-gray-400">
            Already have an account?
            <NuxtLink :to="$localePath('/login')" class="text-cyan-600 dark:text-cyan-400 font-medium hover:underline transition">Sign in</NuxtLink>
          </div>

          <!-- Submit Button -->
          <button
            type="submit"
            :disabled="loading"
            class="w-full py-3.5 px-4 bg-cyan-500 hover:bg-cyan-400 text-gray-900 font-semibold rounded-xl shadow-lg shadow-cyan-500/20 transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 flex justify-center items-center"
          >
            <span v-if="loading" class="animate-spin rounded-full h-5 w-5 border-b-2 border-gray-900 mr-2"></span>
            <span>{{ loading ? 'Creating account...' : 'Sign up' }}</span>
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
  title: 'Register - DubbingBase',
  description: 'Create a DubbingBase profile.',
  robots: 'noindex, nofollow'
})

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
    router.push(redirect ? redirect : localePath('/profile'));
  }
});

watch(user, (newUser) => {
  if (newUser) {
    const redirect = route.query.redirect as string;
    router.push(redirect ? redirect : localePath('/profile'));
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
          full_name: full_name.value
        }
      }
    });

    if (error) {
      authMessage.value = error.message;
      return;
    }

    if (data.user && data.session === null) {
      // Typically implies email confirmation is required
      isError.value = false;
      authMessage.value = "Registration successful! Please check your email to verify your account.";
    } else {
      isError.value = false;
      const redirect = route.query.redirect as string;
      router.push(redirect ? redirect : localePath('/profile'));
    }

  } catch (err: any) {
    authMessage.value = err.message || "An error occurred during registration";
  } finally {
    loading.value = false;
  }
};
</script>
