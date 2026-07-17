<template>
  <!-- ConfirmDialog uses native Capacitor Dialog API -->
</template>

<script setup lang="ts">
import { Dialog } from '@capacitor/dialog';
import { watch } from 'vue';

interface Props {
  isOpen: boolean;
  header: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  confirmColor?: string;
}

const props = withDefaults(defineProps<Props>(), {
  confirmText: 'Confirmer',
  cancelText: 'Annuler',
  confirmColor: 'danger'
});

const emit = defineEmits<{
  confirm: [];
  cancel: [];
  dismiss: [];
}>();

const showDialog = async () => {
  const { value } = await Dialog.confirm({
    title: props.header,
    message: props.message,
    okButtonTitle: props.confirmText,
    cancelButtonTitle: props.cancelText
  });

  if (value) {
    emit('confirm');
  } else {
    emit('cancel');
  }
  emit('dismiss');
};

watch(() => props.isOpen, (newVal) => {
  if (newVal) {
    showDialog();
  }
});
</script>
