<template>
  <div>
    <h2 class="text-xl font-semibold theme-text mb-6">
      {{ $t("profile.details") }}
    </h2>

    <div class="space-y-6">
      <div
        v-if="user"
        class="theme-surface-raised p-4 rounded-xl border theme-border-subtle"
      >
        <form @submit.prevent="updateProfile" class="mb-6 space-y-4">
          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label
                for="username"
                class="block text-sm font-medium theme-text-secondary mb-1"
                >{{ $t("profile.username") }}</label
              >
              <input
                id="username"
                v-model="username"
                type="text"
                class="w-full px-4 py-2 theme-input border theme-border-subtle rounded-lg theme-text theme-focus"
              />
            </div>
            <div>
              <label
                for="full_name"
                class="block text-sm font-medium theme-text-secondary mb-1"
                >{{ $t("auth.fullName") }}</label
              >
              <input
                id="full_name"
                v-model="full_name"
                type="text"
                class="w-full px-4 py-2 theme-input border theme-border-subtle rounded-lg theme-text theme-focus"
              />
            </div>
          </div>
          <div class="flex justify-end gap-3">
            <p
              v-if="updateMessage"
              :class="[
                'mt-2 text-sm flex-1',
                isError
                  ? 'theme-status-danger-text'
                  : 'theme-status-success-text',
              ]"
            >
              {{ updateMessage }}
            </p>
            <button
              type="submit"
              :disabled="
                isUpdating ||
                (username === (user.user_metadata?.username || '') &&
                  full_name === (user.user_metadata?.full_name || ''))
              "
              class="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 theme-text font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {{
                isUpdating ? $t("profile.saving") : $t("profile.saveChanges")
              }}
            </button>
          </div>
        </form>

        <dl
          class="divide-y theme-divide border-t theme-border-subtle theme-border pt-4"
        >
          <div class="py-3 flex justify-between">
            <dt class="text-sm font-medium theme-text-muted">
              {{ $t("auth.email") }}
            </dt>
            <dd class="text-sm theme-text">{{ user.email }}</dd>
          </div>
          <div class="py-3 flex justify-between">
            <dt class="text-sm font-medium theme-text-muted">
              {{ $t("common.userId") }}
            </dt>
            <dd class="text-sm theme-text font-mono text-xs">
              {{ user.id }}
            </dd>
          </div>
          <div class="py-3 flex justify-between">
            <dt class="text-sm font-medium theme-text-muted">
              {{ $t("profile.lastSignIn") }}
            </dt>
            <dd class="text-sm theme-text">
              {{ formatDate(user.last_sign_in_at) }}
            </dd>
          </div>
        </dl>
      </div>
    </div>

    <!-- Gamified Contributions Section -->
    <div class="mt-12">
      <h2 class="text-xl font-semibold theme-text mb-6">
        {{ $t("profile.recentContributions") }}
      </h2>
      <div v-if="isLoadingLogs" class="text-sm theme-text-muted">
        {{ $t("profile.loadingContributions") }}
      </div>
      <div v-else-if="auditLogs.length === 0" class="text-sm theme-text-muted">
        {{ $t("profile.noGamifiedContributionsYet")
        }}<NuxtLink
          :to="localePath('/contribute')"
          class="text-cyan-500 hover:underline"
          >{{ $t("profile.contributionHub") }}</NuxtLink
        >{{ $t("profile.toStartEarningPoints") }}
      </div>
      <div
        v-else
        class="theme-surface-raised rounded-xl border theme-border-subtle overflow-hidden"
      >
        <ul class="divide-y theme-divide">
          <li
            v-for="log in auditLogs"
            :key="log.id"
            class="p-4 flex items-center justify-between theme-hover-surface-muted transition-colors"
          >
            <div>
              <p class="text-sm font-medium theme-text capitalize">
                {{ log.action.replace(/_/g, " ") }}
                <span class="text-xs theme-text-muted">{{
                  $t("profile.onEntity", {
                    type: log.entity_type,
                    id: log.entity_id,
                  })
                }}</span>
              </p>
              <p class="text-xs theme-text-muted mt-1">
                {{ new Date(log.created_at).toLocaleString() }}
              </p>
            </div>
            <div class="flex items-center gap-3">
              <span
                v-if="log.reverted_at"
                class="text-xs theme-status-danger-text px-2 py-1 bg-red-500/10 rounded"
                >{{ $t("admin.auditLogs.reverted") }}</span
              >
              <span
                v-else
                class="text-sm font-mono theme-status-success-text font-bold"
                >{{
                  $t("profile.pointsAwarded", { pts: log.points_awarded })
                }}</span
              >
            </div>
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";

const supabase = useSupabaseClient();
const user = useSupabaseUser();
const localePath = useLocalePath();

const username = ref(user.value?.user_metadata?.username || "");
const full_name = ref(user.value?.user_metadata?.full_name || "");
const isUpdating = ref(false);
const updateMessage = ref("");
const isError = ref(false);

const auditLogs = ref<any[]>([]);

const updateProfile = async () => {
  if (!username.value.trim()) {
    isError.value = true;
    updateMessage.value = "Username cannot be empty";
    return;
  }

  isUpdating.value = true;
  updateMessage.value = "";

  const { error } = await supabase.auth.updateUser({
    data: {
      username: username.value.trim(),
      full_name: full_name.value.trim(),
    },
  });

  isUpdating.value = false;

  if (error) {
    isError.value = true;
    updateMessage.value = error.message;
  } else {
    isError.value = false;
    updateMessage.value = "Profile updated successfully!";
  }
};

const formatDate = (dateString?: string) => {
  if (!dateString) return "Never";
  return new Date(dateString).toLocaleString();
};

const { data: auditLogsData, pending: isLoadingLogs } = await useAsyncData(
  "profile-audit-logs",
  async () => {
    if (!user.value) return [];
    const { data, error } = await supabase
      .from("audit_logs")
      .select("*")
      .eq("user_id", user.value.id)
      .order("created_at", { ascending: false })
      .limit(10);
    if (error) return [];
    return data || [];
  },
);

if (auditLogsData.value) {
  auditLogs.value = auditLogsData.value;
}
</script>
