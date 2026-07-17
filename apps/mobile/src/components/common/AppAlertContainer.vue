<template>
  <div class="app-alert-container" v-if="alerts.length > 0">
    <div class="alert-backdrop" @click="handleBackdropClick"></div>
    <div 
      class="app-alert" 
      v-for="(alert, index) in alerts" 
      :key="alert.id"
      v-show="index === alerts.length - 1"
    >
      <div class="alert-header" v-if="alert.header">{{ alert.header }}</div>
      <div class="alert-message" v-if="alert.message" v-html="alert.message"></div>
      
      <div class="alert-inputs" v-if="alert.inputs && alert.inputs.length > 0">
        <div class="input-wrapper" v-for="(input, i) in alert.inputs" :key="i">
          <input 
            class="alert-input" 
            :type="input.type || 'text'" 
            :placeholder="input.placeholder" 
            v-model="inputValues[alert.id][input.name]" 
          />
        </div>
      </div>

      <div class="alert-buttons">
        <button 
          class="alert-button" 
          v-for="(btn, btnIndex) in normalizedButtons(alert.buttons)" 
          :key="btnIndex"
          :class="`role-${btn.role || 'default'}`"
          @click="handleButtonClick(alert, btn)"
        >
          {{ btn.text }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, reactive } from 'vue';

export interface AlertInput {
  name: string;
  type?: string;
  placeholder?: string;
  value?: string;
}

export interface AlertButton {
  text: string;
  role?: string;
  handler?: (data?: any) => boolean | void | Promise<boolean | void>;
}

export interface AlertOptions {
  header?: string;
  message?: string;
  inputs?: AlertInput[];
  buttons?: (string | AlertButton)[];
  backdropDismiss?: boolean;
}

export interface AlertInstance extends AlertOptions {
  id: number;
  onDidDismissResolve: ((data: { role?: string, data?: any }) => void) | null;
}

const alerts = ref<AlertInstance[]>([]);
let nextId = 0;

// State for inputs: map of alertId -> map of inputName -> value
const inputValues = reactive<Record<number, Record<string, any>>>({});

const normalizedButtons = (buttons?: (string | AlertButton)[]): AlertButton[] => {
  if (!buttons || buttons.length === 0) return [{ text: 'OK' }];
  return buttons.map(b => typeof b === 'string' ? { text: b } : b);
};

const addAlert = (options: AlertOptions, resolveCallback: (data: any) => void) => {
  const id = nextId++;
  
  inputValues[id] = {};
  if (options.inputs) {
    options.inputs.forEach(input => {
      inputValues[id][input.name] = input.value || '';
    });
  }

  const alert = { ...options, id, onDidDismissResolve: resolveCallback };
  alerts.value.push(alert);
  
  return id;
};

const removeAlert = (id: number) => {
  const index = alerts.value.findIndex(a => a.id === id);
  if (index !== -1) {
    alerts.value.splice(index, 1);
    delete inputValues[id];
  }
};

const handleButtonClick = async (alert: AlertInstance, btn: AlertButton) => {
  const data = inputValues[alert.id];
  
  if (btn.handler) {
    const result = await btn.handler(data);
    if (result === false) {
      return;
    }
  }
  
  if (alert.onDidDismissResolve) {
    alert.onDidDismissResolve({ role: btn.role, data });
  }
  removeAlert(alert.id);
};

const handleBackdropClick = () => {
  const alert = alerts.value[alerts.value.length - 1];
  if (alert && alert.backdropDismiss !== false) {
    if (alert.onDidDismissResolve) {
      alert.onDidDismissResolve({ role: 'backdrop' });
    }
    removeAlert(alert.id);
  }
};

onMounted(() => {
  if (typeof window !== 'undefined') {
    (window as any).__addAlert = addAlert;
  }
});

onUnmounted(() => {
  if (typeof window !== 'undefined') {
    delete (window as any).__addAlert;
  }
});
</script>

<style scoped lang="scss">
.app-alert-container {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10001;
}

.alert-backdrop {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(2px);
}

.app-alert {
  position: relative;
  background: var(--app-color-step-50, #1e1e1e);
  width: 85%;
  max-width: 320px;
  border-radius: 12px;
  box-shadow: 0 10px 24px rgba(0,0,0,0.5);
  overflow: hidden;
  color: white;
  animation: scaleIn 0.2s cubic-bezier(0.25, 0.8, 0.25, 1);
}

.alert-header {
  padding: 24px 24px 8px;
  font-size: 20px;
  font-weight: 600;
  text-align: center;
}

.alert-message {
  padding: 16px 24px 24px;
  font-size: 14px;
  color: var(--app-color-step-300, #b3b3b3);
  text-align: center;
  line-height: 1.5;
}

.alert-inputs {
  padding: 0 24px 24px;
}

.alert-input {
  width: 100%;
  background: var(--app-color-step-100, #2a2a2a);
  border: 1px solid var(--app-color-step-200, #3a3a3a);
  color: white;
  padding: 12px;
  border-radius: 8px;
  margin-bottom: 8px;
  box-sizing: border-box;
  font-family: inherit;
  font-size: 14px;
  
  &:focus {
    outline: none;
    border-color: var(--app-color-primary, #3880ff);
  }
}

.alert-buttons {
  display: flex;
  border-top: 1px solid var(--app-color-step-150, #2a2a2a);
}

.alert-button {
  flex: 1;
  background: transparent;
  color: var(--app-color-primary, #3880ff);
  border: none;
  border-right: 1px solid var(--app-color-step-150, #2a2a2a);
  padding: 16px;
  font-size: 16px;
  font-weight: 500;
  cursor: pointer;
  
  &:last-child {
    border-right: none;
  }
  
  &:hover {
    background: rgba(255, 255, 255, 0.05);
  }
  
  &:active {
    background: rgba(255, 255, 255, 0.1);
  }
  
  &.role-cancel {
    font-weight: 400;
    color: var(--app-color-step-400, #999);
  }
  
  &.role-destructive {
    color: var(--app-color-danger, #ff4961);
  }
}

@keyframes scaleIn {
  from { opacity: 0; transform: scale(1.1); }
  to { opacity: 1; transform: scale(1); }
}
</style>
