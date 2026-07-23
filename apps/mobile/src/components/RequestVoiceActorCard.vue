<template>
  <div class="request-profile-wrapper">
    <div v-if="!hideCard" class="request-profile-card">
      <div class="banner-content">
        <h3 v-if="voiceActor">
          {{
            t("profile.areYouAVoiceActor", {
              name: `${voiceActor.firstname} ${voiceActor.lastname}`,
            })
          }}
        </h3>
        <h3 v-else>
          {{ t("profile.areYouAVoiceActorGeneral") }}
        </h3>
        <p v-if="voiceActor">{{ t("profile.requestVoiceActorDesc") }}</p>
        <p v-else>{{ t("profile.requestVoiceActorCreationDesc") }}</p>
      </div>
      <button type="button" class="request-btn" @click="openRequestModal">
        {{ voiceActor ? t("profile.requestVoiceActorBtn") : t("profile.requestVoiceActorCreationBtn") }}
      </button>
    </div>

    <div v-if="isRequestModalOpen" class="modal-backdrop" @click="closeRequestModal">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h2>{{ voiceActor ? t("profile.requestVoiceActorTitle") : t("profile.requestVoiceActorCreationTitle") }}</h2>
          <button class="close-btn" @click="closeRequestModal">&times;</button>
        </div>
        <div class="modal-body">
          <form @submit.prevent="submitRequest">
            <!-- Show First Name / Last Name if no voiceActor provided -->
            <template v-if="!voiceActor">
              <div class="form-group">
                <label for="req-firstname">{{ t('profile.firstName') }} *</label>
                <input
                  id="req-firstname"
                  v-model="requestForm.firstname"
                  type="text"
                  required
                  :placeholder="t('profile.firstName')"
                />
              </div>
              <div class="form-group">
                <label for="req-lastname">{{ t('profile.lastName') }} *</label>
                <input
                  id="req-lastname"
                  v-model="requestForm.lastname"
                  type="text"
                  required
                  :placeholder="t('profile.lastName')"
                />
              </div>
            </template>

            <div class="form-group">
              <label for="req-details">{{ t("profile.details") }}</label>
              <textarea
                id="req-details"
                v-model="requestForm.details"
                rows="4"
                :placeholder="t('profile.requestDetailsPlaceholder')"
              ></textarea>
            </div>

            <div v-if="requestError" class="modal-error">
              {{ requestError }}
            </div>
            <div v-if="requestSuccess" class="modal-success">
              {{ t("profile.requestSuccessMessage") }}
            </div>

            <div class="modal-actions">
              <button
                type="button"
                class="btn-secondary"
                @click="closeRequestModal"
                :disabled="isSubmittingRequest"
              >
                {{ t("common.cancel") }}
              </button>
              <button
                type="submit"
                class="btn-primary"
                :disabled="isSubmittingRequest || requestSuccess"
              >
                <span v-if="isSubmittingRequest" class="spinner"></span>
                {{ t("profile.submitRequest") }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { useI18n } from "vue-i18n";
import { supabase } from "@/api/supabase";

const props = defineProps<{
  voiceActor?: any;
  hideCard?: boolean;
}>();

const { t } = useI18n();

const isRequestModalOpen = ref(false);
const isSubmittingRequest = ref(false);
const requestError = ref<string | null>(null);
const requestSuccess = ref(false);

const requestForm = ref({
  firstname: "",
  lastname: "",
  details: "",
});

const openRequestModal = () => {
  isRequestModalOpen.value = true;
  requestError.value = null;
  requestSuccess.value = false;
  requestForm.value = {
    firstname: "",
    lastname: "",
    details: "",
  };
};

const closeRequestModal = () => {
  if (isSubmittingRequest.value) return;
  isRequestModalOpen.value = false;
};

defineExpose({
  openRequestModal,
});

const submitRequest = async () => {
  if (!props.voiceActor && (!requestForm.value.firstname.trim() || !requestForm.value.lastname.trim())) {
    requestError.value = "First name and last name are required";
    return;
  }

  isSubmittingRequest.value = true;
  requestError.value = null;

  try {
    if (props.voiceActor) {
      const { error } = await supabase.functions.invoke("request-voice-actor-linkage", {
        body: {
          voice_actor_id: props.voiceActor.id,
          details: requestForm.value.details.trim(),
        },
      });
      if (error) throw error;
    } else {
      const { error } = await supabase.functions.invoke("request-voice-actor-page", {
        body: {
          firstname: requestForm.value.firstname.trim(),
          lastname: requestForm.value.lastname.trim(),
          details: requestForm.value.details.trim(),
        },
      });
      if (error) throw error;
    }

    requestSuccess.value = true;
    setTimeout(() => {
      isRequestModalOpen.value = false;
    }, 2000);
  } catch (err: any) {
    console.error("Error submitting request:", err);
    requestError.value = err.message || "Failed to submit request. Please try again.";
  } finally {
    isSubmittingRequest.value = false;
  }
};
</script>

<style scoped>
.request-profile-wrapper {
  width: 100%;
}

.request-profile-card {
  margin: 16px 0;
  padding: 24px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(59, 130, 246, 0.2);
  border-radius: 20px;
  position: relative;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
  box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.3), inset 0 0 0 1px rgba(255, 255, 255, 0.05);
  text-align: center;
}

.request-profile-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: linear-gradient(90deg, transparent, var(--app-color-primary, #3b82f6), transparent);
  opacity: 0.8;
}

.banner-content {
  flex: 1;
  width: 100%;
}

.request-profile-card h3 {
  margin: 0 0 8px 0;
  color: var(--app-color-text-primary, #ffffff);
  font-size: 1.15rem;
  font-weight: 700;
  letter-spacing: -0.02em;
}

.request-profile-card p {
  margin: 0;
  color: var(--app-color-text-muted, #94a3b8);
  font-size: 0.9rem;
  line-height: 1.5;
}

.request-btn {
  background: linear-gradient(135deg, var(--app-color-primary, #3b82f6) 0%, #2563eb 100%);
  color: white;
  border: none;
  width: 100%;
  padding: 12px 20px;
  border-radius: 12px;
  font-weight: 600;
  font-size: 0.95rem;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
}

.request-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(59, 130, 246, 0.4);
}

.request-btn:active {
  transform: translateY(0);
}

/* Modal Styles */
.modal-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
  backdrop-filter: blur(4px);
}

.modal-content {
  background: var(--app-background-color, #1e1e1e);
  border-radius: 16px;
  width: 90%;
  max-width: 500px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.3);
}

.modal-header {
  padding: 20px 24px;
  border-bottom: 1px solid var(--app-border-color, #333);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.modal-header h2 {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--app-text-color, #fff);
}

.close-btn {
  background: none;
  border: none;
  font-size: 1.5rem;
  color: var(--app-color-medium);
  cursor: pointer;
  padding: 0;
  line-height: 1;
}

.modal-body {
  padding: 24px;
}

.form-group {
  margin-bottom: 20px;
}

.form-group label {
  display: block;
  margin-bottom: 8px;
  font-size: 0.9rem;
  color: var(--app-text-color, #fff);
  font-weight: 500;
}

.form-group input,
.form-group textarea {
  width: 100%;
  padding: 12px;
  border-radius: 8px;
  border: 1px solid var(--app-border-color, #333);
  background: var(--app-color-step-50, #2a2a2a);
  color: var(--app-text-color, #fff);
  font-size: 1rem;
}

.form-group input:focus,
.form-group textarea:focus {
  outline: none;
  border-color: var(--app-color-primary);
}

.modal-error {
  background: rgba(var(--app-color-danger-rgb, 235, 68, 90), 0.1);
  color: var(--app-color-danger, #eb445a);
  padding: 12px;
  border-radius: 8px;
  margin-bottom: 20px;
  font-size: 0.9rem;
}

.modal-success {
  background: rgba(var(--app-color-success-rgb, 45, 211, 111), 0.1);
  color: var(--app-color-success, #2dd36f);
  padding: 12px;
  border-radius: 8px;
  margin-bottom: 20px;
  font-size: 0.9rem;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 24px;
}

.btn-primary,
.btn-secondary {
  padding: 10px 20px;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  border: none;
  display: flex;
  align-items: center;
  gap: 8px;
}

.btn-secondary {
  background: transparent;
  color: var(--app-color-medium);
}

.btn-primary {
  background: var(--app-color-primary);
  color: white;
}

.btn-primary:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.spinner {
  width: 16px;
  height: 16px;
  border: 2px solid var(--app-overlay-30);
  border-radius: 50%;
  border-top-color: white;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
