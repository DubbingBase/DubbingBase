import { defineStore } from 'pinia';
import { ref, computed, onUnmounted } from 'vue';
import { supabase } from '@/api/supabase';
import { useIonRouter } from '@ionic/vue';
import type { User } from '@supabase/supabase-js';
import type { Permission } from '@/types/permissions';

export const useAuthStore = defineStore('auth', () => {
  // State
  const user = ref<User | null>(null);
  const isLoading = ref(false);
  const error = ref<string | null>(null);

  // Getters
  const isAuthenticated = computed(() => !!user.value);
  const isAdmin = computed(() => user.value?.app_metadata?.role === 'admin' ||
                      user.value?.user_metadata?.role === 'admin' ||
                      user.value?.role === 'admin');
  const isAnonymous = computed(() => user.value?.is_anonymous)

  const currentUser = computed(() => user.value);

  const permissions = computed((): Permission[] => {
    if (!isAuthenticated.value) return [];
    const perms: Permission[] = ['add_voice_actors'];
    if (isAdmin.value) {
      perms.push('admin_fetch');
    }
    return perms;
  });

  // Actions
  const setUser = (userData: any) => {
    user.value = userData;
  };

  const clearUser = () => {
    user.value = null;
  };

  const signIn = async (email: string, password: string) => {
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
      const errorMessage = err.message || 'Failed to sign in';
      error.value = errorMessage;
      return { user: null, error: new Error(errorMessage) };
    } finally {
      isLoading.value = false;
    }
  };

  const signUp = async (email: string, password: string) => {
    try {
      isLoading.value = true;
      error.value = null;

      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
      });

      if (signUpError) throw signUpError;

      if (data.user) {
        user.value = data.user;

        // Auto-create user profile after successful signup
        try {
          await supabase.functions.invoke('create-user-profile', {
            body: {} // Create empty profile
          });
        } catch (profileError) {
          console.warn('Failed to auto-create user profile:', profileError);
          // Don't fail signup if profile creation fails
        }
      }

      return { user: data.user, error: null };
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to sign up';
      error.value = errorMessage;
      return { user: null, error: new Error(errorMessage) };
    } finally {
      isLoading.value = false;
    }
  };

  const signOut = async () => {
    try {
      isLoading.value = true;
      error.value = null;

      const { error: signOutError } = await supabase.auth.signOut();
      if (signOutError) throw signOutError;

      clearUser();
    } catch (err: any) {
      error.value = err.message || 'Failed to sign out';
      throw err;
    } finally {
      isLoading.value = false;
    }
  };

  const checkAuth = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        user.value = session.user;
      }
      return session?.user || null;
    } catch (err: any) {
      error.value = err.message || 'Failed to check authentication status';
      return null;
    }
  };

  // Initialize auth state
  let authListener: { subscription: any } = { subscription: null };

  const initialize = async () => {
    try {
      // First check current session
      const { data: { session } } = await supabase.auth.getSession();
      console.log('Current session:', session);

      if (session) {
        user.value = session?.user || null;
      }

      // Set up auth state listener
      const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
        console.log('Auth state changed:', event, session);
        user.value = session?.user || null;

        // Handle specific auth events if needed
        if (event === 'SIGNED_OUT') {
          // Clear any sensitive data on sign out
          clearUser();
        }
      });

      // Store the subscription for cleanup
      authListener.subscription = subscription;

      return true;
    } catch (err) {
      console.error('Error initializing auth:', err);
      error.value = 'Failed to initialize authentication';
      return false;
    }
  };

  // Cleanup auth listener when store is destroyed
  onUnmounted(() => {
    if (authListener.subscription) {
      authListener.subscription.unsubscribe();
    }
  });

  return {
    // State
    user,
    isLoading,
    error,

    // Getters
    isAuthenticated,
    isAnonymous,
    isAdmin,
    currentUser,
    permissions,

    // Actions
    setUser,
    clearUser,
    signIn,
    signUp,
    signOut,
    checkAuth,
    initialize,
  };
});

// Types - using Supabase User type
export type { User } from '@supabase/supabase-js';
