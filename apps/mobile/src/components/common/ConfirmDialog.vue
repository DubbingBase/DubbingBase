<template>
  <ion-alert
    :is-open="isOpen"
    :header="header"
    :message="message"
    :buttons="alertButtons"
    @will-dismiss="handleDismiss"
  ></ion-alert>
</template>

<script setup lang="ts">
import { IonAlert } from '@ionic/vue'
import { computed } from 'vue'

interface Props {
  isOpen: boolean
  header: string
  message: string
  confirmText?: string
  cancelText?: string
  confirmColor?: string
}

const props = withDefaults(defineProps<Props>(), {
  confirmText: 'Confirmer',
  cancelText: 'Annuler',
  confirmColor: 'danger'
})

const emit = defineEmits<{
  confirm: []
  cancel: []
  dismiss: []
}>()

const alertButtons = computed(() => [
  {
    text: props.cancelText,
    role: 'cancel',
    handler: () => emit('cancel')
  },
  {
    text: props.confirmText,
    role: 'destructive',
    cssClass: `confirm-button-${props.confirmColor}`,
    handler: () => emit('confirm')
  }
])

const handleDismiss = () => {
  emit('dismiss')
}
</script>

<style scoped>
.confirm-button-danger {
  --background: var(--ion-color-danger);
  --color: white;
}
</style>
