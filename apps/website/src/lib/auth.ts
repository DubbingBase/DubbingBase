import { ref, computed } from "vue";
import { supabase } from "./supabase";
import type { User } from "@supabase/supabase-js";

// Reactive state
export const user = ref<User | null>(null);
export const isLoading = ref(true);
export const error = ref<string | null>(null);

// Getters
export const isAuthenticated = computed(() => !!user.value);
export const isAdmin = computed(() => {
  return (
    user.value?.app_metadata?.role === "admin" ||
    user.value?.user_metadata?.role === "admin" ||
    user.value?.role === "admin"
  );
});

// Actions
export const signIn = async (email: string, password: string) => {
  try {
    isLoading.value = true;
    error.value = null;

    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) throw signInError;

    user.value = data.user;
    return { user: data.user, error: null };
  } catch (err: any) {
    const errorMessage = err.message || "Failed to sign in";
    error.value = errorMessage;
    return { user: null, error: new Error(errorMessage) };
  } finally {
    isLoading.value = false;
  }
};

export const signOut = async () => {
  try {
    isLoading.value = true;
    error.value = null;

    const { error: signOutError } = await supabase.auth.signOut();
    if (signOutError) throw signOutError;

    user.value = null;
  } catch (err: any) {
    error.value = err.message || "Failed to sign out";
    throw err;
  } finally {
    isLoading.value = false;
  }
};

export const initializeAuth = async () => {
  try {
    isLoading.value = true;
    const { data: { session } } = await supabase.auth.getSession();
    user.value = session?.user || null;

    supabase.auth.onAuthStateChange((event, session) => {
      console.log("Web Auth state changed:", event, session);
      user.value = session?.user || null;
    });

    return true;
  } catch (err) {
    console.error("Error initializing auth:", err);
    error.value = "Failed to initialize authentication";
    return false;
  } finally {
    isLoading.value = false;
  }
};
