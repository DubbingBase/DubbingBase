<template>
  <div class="space-y-6">
    <div class="theme-surface-overlay p-6 rounded-2xl border theme-border space-y-1">
      <h3 class="text-lg font-bold theme-text">API tokens</h3>
      <p class="text-sm theme-text-muted">
        Personal tokens for the public API. Send one as
        <code>Authorization: Bearer dbk_live_…</code>.
        <a href="/api/v1/docs" target="_blank" rel="noopener" class="underline">API reference</a>
      </p>
    </div>

    <div
      v-if="createdToken"
      class="p-4 theme-status-warning border rounded-xl space-y-2"
      role="status"
    >
      <p class="text-sm font-semibold theme-status-warning-text">
        Copy this token now. It is shown once and cannot be retrieved later.
      </p>
      <div class="flex flex-col sm:flex-row gap-2">
        <input
          readonly
          :value="createdToken"
          class="flex-1 px-3 py-2 rounded-lg border theme-border theme-text font-mono text-sm"
          ref="tokenInput"
          aria-label="New API token"
          @focus="tokenInput?.select()"
        />
        <button
          class="py-2 px-4 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-lg"
          @click="copyToken"
        >
          {{ copied ? "Copied" : "Copy" }}
        </button>
        <button class="py-2 px-4 border theme-border theme-text rounded-lg" @click="dismissToken">
          Done
        </button>
      </div>
    </div>

    <form
      class="theme-surface-overlay p-6 rounded-2xl border theme-border space-y-4"
      @submit.prevent="create"
    >
      <h4 class="font-semibold theme-text">New token</h4>
      <label class="block space-y-1">
        <span class="text-sm theme-text-muted">Name</span>
        <input
          v-model="name"
          required
          maxlength="80"
          placeholder="e.g. editorial scripts"
          class="w-full px-3 py-2 rounded-lg border theme-border theme-text"
        />
      </label>
      <fieldset class="space-y-1">
        <legend class="text-sm theme-text-muted">Permissions</legend>
        <label v-for="scope in scopes" :key="scope" class="flex items-center gap-2 theme-text">
          <input v-model="selectedScopes" type="checkbox" :value="scope" />
          <code>{{ scope }}</code>
        </label>
      </fieldset>
      <label class="block space-y-1">
        <span class="text-sm theme-text-muted">Expires</span>
        <select v-model="expiresInDays" class="px-3 py-2 rounded-lg border theme-border theme-text">
          <option :value="30">in 30 days</option>
          <option :value="90">in 90 days</option>
          <option :value="365">in 1 year</option>
          <option :value="undefined">never</option>
        </select>
      </label>
      <p v-if="error" class="text-sm theme-status-danger-text" role="alert">{{ error }}</p>
      <button
        type="submit"
        :disabled="creating || selectedScopes.length === 0"
        class="py-2.5 px-5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold rounded-xl"
      >
        {{ creating ? "Creating…" : "Create token" }}
      </button>
    </form>

    <div class="theme-surface-overlay rounded-2xl border theme-border overflow-x-auto">
      <table class="w-full text-sm">
        <thead class="text-left theme-text-muted">
          <tr>
            <th class="p-3">Name</th>
            <th class="p-3">Token</th>
            <th class="p-3">Permissions</th>
            <th class="p-3">Last used</th>
            <th class="p-3">Expires</th>
            <th class="p-3"></th>
          </tr>
        </thead>
        <tbody class="theme-text">
          <tr v-for="token in tokens" :key="token.id" class="border-t theme-border">
            <td class="p-3">{{ token.name }}</td>
            <td class="p-3 font-mono">{{ token.prefix }}…</td>
            <td class="p-3">{{ token.scopes.join(", ") }}</td>
            <td class="p-3">{{ formatDate(token.last_used_at, "never") }}</td>
            <td class="p-3">{{ status(token) }}</td>
            <td class="p-3 text-right">
              <button
                v-if="!token.revoked_at"
                class="theme-status-danger-text underline"
                @click="revoke(token)"
              >
                Revoke
              </button>
            </td>
          </tr>
          <tr v-if="tokens.length === 0">
            <td colspan="6" class="p-6 text-center theme-text-muted">No tokens yet.</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ApiScope } from "../../../shared/api-scopes";
import type { ApiTokenRecord } from "../../composables/useApiTokens";

definePageMeta({
  layout: "admin",
  middleware: "admin",
});

const { scopes, listTokens, createToken, revokeToken } = useApiTokens();

const tokens = ref<ApiTokenRecord[]>([]);
const name = ref("");
const selectedScopes = ref<ApiScope[]>([]);
const expiresInDays = ref<number | undefined>(90);
const createdToken = ref<string | null>(null);
const copied = ref(false);
const tokenInput = useTemplateRef<HTMLInputElement>("tokenInput");
const creating = ref(false);
const error = ref("");

async function refresh() {
  tokens.value = (await listTokens()).tokens;
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
    await refresh();
  } catch {
    error.value = "Could not create the token.";
  } finally {
    creating.value = false;
  }
}

async function revoke(token: ApiTokenRecord) {
  if (!window.confirm(`Revoke "${token.name}"? Anything using it stops working immediately.`)) {
    return;
  }
  await revokeToken(token.id);
  await refresh();
}

async function copyToken() {
  if (!createdToken.value) return;
  await navigator.clipboard.writeText(createdToken.value);
  copied.value = true;
}

function dismissToken() {
  createdToken.value = null;
}

function formatDate(value: string | null, fallback: string) {
  return value ? new Date(value).toLocaleString() : fallback;
}

function status(token: ApiTokenRecord) {
  if (token.revoked_at) return "revoked";
  if (!token.expires_at) return "never";
  const expired = Date.parse(token.expires_at) <= Date.now();
  return `${expired ? "expired " : ""}${formatDate(token.expires_at, "never")}`;
}

onMounted(refresh);
</script>
