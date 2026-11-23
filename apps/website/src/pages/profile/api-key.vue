<template>
  <div>
    <h2 class="text-xl font-semibold theme-text mb-2">
      {{ $t("settings.apiKeys") }}
    </h2>
    <p class="text-sm theme-text-muted mb-6">
      {{ $t("settings.apiKeysDescription") }} ·
      <a href="/api/v1/docs" target="_blank" rel="noopener" class="underline">{{
        $t("settings.apiReference")
      }}</a>
    </p>

    <p v-if="!isAdmin" class="text-sm theme-text-muted">{{ $t("settings.adminOnly") }}</p>

    <div v-else class="space-y-6">
      <div
        v-if="createdToken"
        class="p-4 theme-status-warning border rounded-xl space-y-2"
        role="status"
      >
        <p class="text-sm font-semibold theme-status-warning-text">
          {{ $t("settings.tokenShownOnce") }}
        </p>
        <div class="flex flex-col sm:flex-row gap-2">
          <input
            ref="tokenInput"
            readonly
            :value="createdToken"
            class="flex-1 px-3 py-2 rounded-lg border theme-border theme-text font-mono text-sm"
            :aria-label="$t('settings.newTokenLabel')"
            @focus="tokenInput?.select()"
          />
          <button
            type="button"
            class="py-2 px-4 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-lg"
            @click="copyToken"
          >
            {{ copied ? $t("settings.copied") : $t("settings.copy") }}
          </button>
          <button
            type="button"
            class="py-2 px-4 border theme-border theme-text rounded-lg"
            @click="createdToken = null"
          >
            {{ $t("settings.done") }}
          </button>
        </div>
      </div>

      <form
        class="theme-surface-raised p-6 rounded-xl border theme-border-subtle space-y-4"
        @submit.prevent="create"
      >
        <h3 class="font-semibold theme-text">{{ $t("settings.newToken") }}</h3>
        <label class="block space-y-1">
          <span class="text-sm theme-text-muted">{{ $t("settings.tokenName") }}</span>
          <input
            v-model="name"
            required
            maxlength="80"
            :placeholder="$t('settings.tokenNamePlaceholder')"
            class="w-full px-3 py-2 rounded-lg border theme-border theme-text"
          />
        </label>
        <fieldset class="space-y-1">
          <legend class="text-sm theme-text-muted">{{ $t("settings.tokenPermissions") }}</legend>
          <label v-for="scope in scopes" :key="scope" class="flex items-center gap-2 theme-text">
            <input v-model="selectedScopes" type="checkbox" :value="scope" />
            <code>{{ scope }}</code>
          </label>
        </fieldset>
        <label class="block space-y-1">
          <span class="text-sm theme-text-muted">{{ $t("settings.tokenExpires") }}</span>
          <select
            v-model="expiresInDays"
            class="px-3 py-2 rounded-lg border theme-border theme-text"
          >
            <option :value="30">{{ $t("settings.expire30") }}</option>
            <option :value="90">{{ $t("settings.expire90") }}</option>
            <option :value="365">{{ $t("settings.expire365") }}</option>
            <option :value="undefined">{{ $t("settings.expireNever") }}</option>
          </select>
        </label>
        <p v-if="error" class="text-sm theme-status-danger-text" role="alert">{{ error }}</p>
        <button
          type="submit"
          :disabled="creating || selectedScopes.length === 0"
          class="py-2.5 px-5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold rounded-xl"
        >
          {{ creating ? $t("settings.creatingToken") : $t("settings.createToken") }}
        </button>
      </form>

      <div
        v-if="listError || actionError"
        class="flex items-center gap-3 text-sm theme-status-danger-text"
        role="alert"
      >
        <span>{{ actionError || listError }}</span>
        <button v-if="listError" type="button" class="underline" @click="refresh">
          {{ $t("settings.retry") }}
        </button>
      </div>

      <div class="theme-surface-raised rounded-xl border theme-border-subtle overflow-x-auto">
        <table class="w-full text-sm">
          <thead class="text-left theme-text-muted">
            <tr>
              <th class="p-3">{{ $t("settings.colName") }}</th>
              <th class="p-3">{{ $t("settings.colToken") }}</th>
              <th class="p-3">{{ $t("settings.colPermissions") }}</th>
              <th class="p-3">{{ $t("settings.colLastUsed") }}</th>
              <th class="p-3">{{ $t("settings.colExpires") }}</th>
              <th class="p-3"></th>
            </tr>
          </thead>
          <tbody class="theme-text">
            <tr v-for="token in tokens" :key="token.id" class="border-t theme-border-subtle">
              <td class="p-3">{{ token.name }}</td>
              <td class="p-3 font-mono">{{ token.prefix }}…</td>
              <td class="p-3">{{ token.scopes.join(", ") }}</td>
              <td class="p-3">{{ formatDate(token.last_used_at, $t("settings.neverUsed")) }}</td>
              <td class="p-3">{{ expiry(token) }}</td>
              <td class="p-3 text-right">
                <button
                  v-if="!token.revoked_at"
                  type="button"
                  class="theme-status-danger-text underline"
                  @click="revoke(token)"
                >
                  {{ $t("settings.revoke") }}
                </button>
              </td>
            </tr>
            <tr v-if="loaded && tokens.length === 0">
              <td colspan="6" class="p-6 text-center theme-text-muted">
                {{ $t("settings.noApiKeys") }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ApiScope } from "#shared/api-scopes";
import type { ApiTokenRecord } from "../../composables/useApiTokens";

const { t } = useI18n();
const { isAdmin } = useClientUser();
const { scopes, listTokens, createToken, revokeToken } = useApiTokens();

const tokens = ref<ApiTokenRecord[]>([]);
const name = ref("");
const selectedScopes = ref<ApiScope[]>([]);
const expiresInDays = ref<number | undefined>(90);
const createdToken = ref<string | null>(null);
const copied = ref(false);
const creating = ref(false);
const error = ref("");
const listError = ref("");
const actionError = ref("");
const loaded = ref(false);
const tokenInput = useTemplateRef<HTMLInputElement>("tokenInput");

async function refresh() {
  listError.value = "";
  try {
    tokens.value = (await listTokens()).tokens;
    loaded.value = true;
  } catch {
    listError.value = t("settings.loadFailed");
  }
}

async function create() {
  creating.value = true;
  error.value = "";
  try {
    const created = await createToken({
      name: name.value,
      scopes: selectedScopes.value,
      expires_in_days: expiresInDays.value,
    });
    createdToken.value = created.token;
    copied.value = false;
    name.value = "";
    selectedScopes.value = [];
  } catch {
    error.value = t("settings.createFailed");
    return;
  } finally {
    creating.value = false;
  }
  // The token exists now; a failed refresh is reported as a list error, not a failed creation.
  await refresh();
}

async function revoke(token: ApiTokenRecord) {
  if (!window.confirm(t("settings.revokeConfirm", { name: token.name }))) return;
  actionError.value = "";
  try {
    await revokeToken(token.id);
  } catch {
    actionError.value = t("settings.revokeFailed");
    return;
  }
  await refresh();
}

async function copyToken() {
  if (!createdToken.value) return;
  await navigator.clipboard.writeText(createdToken.value);
  copied.value = true;
}

function formatDate(value: string | null, fallback: string) {
  return value ? new Date(value).toLocaleString() : fallback;
}

function expiry(token: ApiTokenRecord) {
  if (token.revoked_at) return t("settings.revoked");
  if (!token.expires_at) return t("settings.expireNever");
  const expired = Date.parse(token.expires_at) <= Date.now();
  return `${expired ? `${t("settings.expired")} ` : ""}${formatDate(token.expires_at, "")}`;
}

// The signed-in user is only known after hydration (see useClientUser), so load then.
watch(
  isAdmin,
  (admin) => {
    if (admin) void refresh();
  },
  { immediate: true },
);
</script>
