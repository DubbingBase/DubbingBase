<template>
  <div class="editable-field">
    <div v-if="!isEditing" class="display-mode" @click="startEditing">
      <span class="field-value">{{ displayValue || placeholder }}</span>
      <AppButton fill="clear" size="small">
        <Pencil class="app-icon"  color="medium" />
      </AppButton>
    </div>

    <div v-else class="edit-mode">
      <AppInput
        ref="inputRef"
        v-model="editValue"
        :type="type"
        :placeholder="placeholder"
        @keyup.enter="save"
        @keyup.escape="cancel"
      ></AppInput>
      <div class="edit-actions">
        <AppButton fill="clear" size="small" @click="save">
          <Check class="app-icon"  color="success" />
        </AppButton>
        <AppButton fill="clear" size="small" @click="cancel">
          <X class="app-icon"  color="danger" />
        </AppButton>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import AppButton from '@/components/common/AppButton.vue';
import AppInput from '@/components/common/AppInput.vue';
import { ref, computed, nextTick } from 'vue'


interface Props {
  modelValue: string
  placeholder?: string
  type?: 'text' | 'email' | 'password' | 'number' | 'tel' | 'url' | 'search'
}

const props = withDefaults(defineProps<Props>(), {
  placeholder: 'Cliquez pour modifier',
  type: 'text'
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const isEditing = ref(false)
const editValue = ref('')
const inputRef = ref()

const displayValue = computed(() => props.modelValue)

const startEditing = () => {
  isEditing.value = true
  editValue.value = props.modelValue
  nextTick(() => {
    inputRef.value?.$el?.querySelector('input')?.focus()
  })
}

const save = () => {
  emit('update:modelValue', editValue.value)
  isEditing.value = false
}

const cancel = () => {
  editValue.value = props.modelValue
  isEditing.value = false
}
</script>

<style scoped>
.editable-field {
  width: 100%;
}

.display-mode {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.5rem;
  border: 1px solid transparent;
  border-radius: 4px;
  cursor: pointer;
  min-height: 44px;
}

.display-mode:hover {
  border-color: var(--app-color-light-shade);
  background-color: var(--app-color-light);
}

.field-value {
  flex: 1;
  color: var(--app-text-color);
}

.edit-mode {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.edit-actions {
  display: flex;
  gap: 0.25rem;
}
</style>
