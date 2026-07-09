<template>
  <div class="relative min-h-screen flex items-center justify-center bg-slate-950 px-4 py-12 overflow-hidden select-none">
    <!-- Glowing background elements -->
    <div class="absolute -top-40 -left-40 w-96 h-96 bg-blue-600 rounded-full blur-[128px] opacity-20 pointer-events-none"></div>
    <div class="absolute -bottom-40 -right-40 w-96 h-96 bg-indigo-600 rounded-full blur-[128px] opacity-20 pointer-events-none"></div>

    <div class="w-full max-w-md z-10">
      <!-- Logo or App Title -->
      <div class="text-center mb-8">
        <h2 class="text-4xl font-extrabold tracking-tight text-white bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-indigo-200 to-purple-400">
          DubbingBase
        </h2>
        <p class="mt-2 text-sm text-slate-400">Portal Administration</p>
      </div>

      <!-- Glassmorphic Login Card -->
      <div class="bg-slate-900/60 backdrop-blur-xl border border-slate-800 rounded-2xl shadow-2xl p-8 space-y-6">
        <h3 class="text-xl font-bold text-white text-center">Connexion</h3>

        <form class="space-y-4" @submit.prevent="handleLogin">
          <!-- Email Field -->
          <div class="space-y-1">
            <label for="email" class="text-xs font-semibold text-slate-400 uppercase tracking-wider">Email Address</label>
            <input
              id="email"
              v-model="email"
              type="email"
              required
              placeholder="admin@dubbingbase.com"
              class="w-full px-4 py-3 bg-slate-950/80 border border-slate-800 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
            />
          </div>

          <!-- Password Field -->
          <div class="space-y-1">
            <label for="password" class="text-xs font-semibold text-slate-400 uppercase tracking-wider">Password</label>
            <input
              id="password"
              v-model="password"
              type="password"
              required
              placeholder="••••••••"
              class="w-full px-4 py-3 bg-slate-950/80 border border-slate-800 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
            />
          </div>

          <!-- Error Alert -->
          <div v-if="loginError" class="p-3.5 bg-red-950/40 border border-red-900/60 rounded-xl flex items-center space-x-2.5">
            <svg class="h-5 w-5 text-red-400 shrink-0" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
            </svg>
            <span class="text-sm font-medium text-red-200">{{ loginError }}</span>
          </div>

          <!-- Submit Button -->
          <button
            type="submit"
            :disabled="loading"
            class="relative w-full py-3.5 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold rounded-xl shadow-lg transition-all duration-200 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex justify-center items-center"
          >
            <span v-if="loading" class="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></span>
            <span>{{ loading ? 'Connexion en cours...' : 'Se connecter' }}</span>
          </button>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { useRouter } from "vue-router";
import { signIn, isAdmin } from "@/lib/auth";

const router = useRouter();
const email = ref("");
const password = ref("");
const loading = ref(false);
const loginError = ref<string | null>(null);

const handleLogin = async () => {
  loginError.value = null;
  loading.value = true;

  try {
    const { user, error } = await signIn(email.value, password.value);

    if (error) {
      if (error.message.includes("Invalid login credentials")) {
        loginError.value = "Email ou mot de passe incorrect";
      } else {
        loginError.value = error.message;
      }
      return;
    }

    if (user) {
      if (!isAdmin.value) {
        loginError.value = "Accès refusé. Rôle administrateur requis.";
        return;
      }
      // Redirect to admin panel
      router.push("/");
    }
  } catch (err: any) {
    loginError.value = err.message || "Une erreur est survenue lors de la connexion";
  } finally {
    loading.value = false;
  }
};
</script>
