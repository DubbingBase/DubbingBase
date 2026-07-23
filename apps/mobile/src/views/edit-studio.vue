<template>
  <ion-page>
    <AppPage>
      <AppHeader>
        <AppToolbar>
          <template #start>
            <AppBackButton />
          </template>
          <AppTitle>{{ isEditMode ? 'Edit Studio Profile' : 'Create Dubbing Studio' }}</AppTitle>
        </AppToolbar>
      </AppHeader>

      <AppContent class="edit-studio-page">
        <div v-if="isLoading" class="loading-state">
          <LoadingSpinner name="crescent" />
          <p class="loading-text">Loading studio details...</p>
        </div>

        <form v-else @submit.prevent="saveStudio" class="form-container">
          <div class="form-card">
            <h3 class="card-title">Studio Profile</h3>

            <div class="space-y-4">
              <div class="form-group">
                <label class="form-label">Studio Name *</label>
                <input
                  v-model="name"
                  type="text"
                  placeholder="e.g. Dubbing Brothers"
                  class="form-input"
                  required
                />
              </div>

              <div class="grid-2">
                <div class="form-group">
                  <label class="form-label">Country</label>
                  <input
                    v-model="country"
                    type="text"
                    placeholder="France"
                    class="form-input"
                  />
                </div>

                <div class="form-group">
                  <label class="form-label">City</label>
                  <input
                    v-model="city"
                    type="text"
                    placeholder="Paris / La Plaine Saint-Denis"
                    class="form-input"
                  />
                </div>
              </div>

              <div class="form-group">
                <label class="form-label">Website URL</label>
                <input
                  v-model="websiteUrl"
                  type="url"
                  placeholder="https://www.dubbingbrothers.com"
                  class="form-input"
                />
              </div>

              <div class="form-group">
                <label class="form-label">Logo Image URL</label>
                <input
                  v-model="logoUrl"
                  type="url"
                  placeholder="https://..."
                  class="form-input"
                />
              </div>

              <div class="form-group">
                <label class="form-label">Description</label>
                <textarea
                  v-model="description"
                  rows="4"
                  placeholder="Studio description and historical details..."
                  class="form-input textarea-input"
                ></textarea>
              </div>
            </div>
          </div>

          <div class="submit-bar">
            <AppButton
              expand="block"
              type="submit"
              :disabled="isSaving || !name"
            >
              <LoadingSpinner v-if="isSaving" name="crescent" inline />
              {{ isSaving ? 'Saving Studio...' : (isEditMode ? 'Update Studio' : 'Create Studio') }}
            </AppButton>
          </div>
        </form>
      </AppContent>
    </AppPage>
  </ion-page>
</template>

<script setup lang="ts">
import { IonPage, useIonRouter } from "@ionic/vue";
import AppPage from "@/components/common/layout/AppPage.vue";
import AppHeader from "@/components/common/layout/AppHeader.vue";
import AppToolbar from "@/components/common/layout/AppToolbar.vue";
import AppTitle from "@/components/common/layout/AppTitle.vue";
import AppContent from "@/components/common/layout/AppContent.vue";
import AppBackButton from "@/components/common/AppBackButton.vue";
import AppButton from "@/components/common/AppButton.vue";
import LoadingSpinner from "@/components/common/LoadingSpinner.vue";

import { ref, onMounted, computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import { supabase } from "@/api/supabase";

const route = useRoute();
const router = useRouter();
const ionRouter = useIonRouter();
const id = route.params.id as string | undefined;
const isEditMode = computed(() => !!id && id !== "new");

const name = ref("");
const description = ref("");
const country = ref("France");
const city = ref("");
const websiteUrl = ref("");
const logoUrl = ref("");

const isLoading = ref(false);
const isSaving = ref(false);

const fetchStudioDetails = async () => {
  if (!isEditMode.value || !id) return;
  isLoading.value = true;
  try {
    const { data: funcData, error } = await supabase.functions.invoke("get-studio-details", {
      body: { studioId: id },
    });

    if (error) throw error;
    
    const data = funcData?.studio;

    if (data) {
      name.value = data.name || "";
      description.value = data.description || "";
      country.value = data.country || "France";
      city.value = data.city || "";
      websiteUrl.value = data.website_url || "";
      logoUrl.value = data.logo_url || "";
    }
  } catch (err) {
    console.error("Error fetching studio details:", err);
  } finally {
    isLoading.value = false;
  }
};

const saveStudio = async () => {
  if (!name.value.trim()) return;
  isSaving.value = true;

  try {
    const studioPayload = {
      name: name.value.trim(),
      description: description.value.trim() || null,
      country: country.value.trim() || null,
      city: city.value.trim() || null,
      website_url: websiteUrl.value.trim() || null,
      logo_url: logoUrl.value.trim() || null,
    };

    const { error: saveErr } = await supabase.functions.invoke("save-studio", {
      body: {
        id: isEditMode.value ? id : null,
        updates: studioPayload,
        isEditMode: isEditMode.value,
      },
    });

    if (saveErr) throw saveErr;

    if (ionRouter.canGoBack()) {
      ionRouter.back();
    } else {
      ionRouter.navigate('/home', 'back', 'replace');
    }
  } catch (err) {
    console.error("Error saving studio:", err);
  } finally {
    isSaving.value = false;
  }
};

onMounted(() => {
  fetchStudioDetails();
});
</script>

<style scoped lang="scss">
.edit-studio-page {
  padding: 16px;
  background-color: var(--app-color-step-50);
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 0;
}

.loading-text {
  font-size: 12px;
  color: var(--app-color-text-secondary);
  margin-top: 12px;
}

.form-container {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.form-card {
  background: var(--app-color-step-100);
  border: 1px solid var(--app-color-border);
  border-radius: 16px;
  padding: 20px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
}

.card-title {
  font-size: 13px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #3b82f6;
  border-bottom: 1px solid #2a2a2a;
  padding-bottom: 10px;
  margin-bottom: 16px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-label {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--app-color-text-secondary);
}

.form-input {
  width: 100%;
  padding: 10px 14px;
  background-color: var(--app-color-step-50);
  border: 1px solid var(--app-color-border);
  border-radius: 12px;
  color: #ffffff;
  font-size: 14px;
  outline: none;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;

  &:focus {
    border-color: #3b82f6;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15);
  }

  &::placeholder {
    color: #555555;
  }
}

.textarea-input {
  resize: vertical;
  min-height: 90px;
}

.grid-2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;

  @media (max-width: 480px) {
    grid-template-columns: 1fr;
  }
}

.submit-bar {
  margin-top: 8px;
}
</style>
