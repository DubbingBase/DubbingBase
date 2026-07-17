<template>
  <AppModal :is-open="isOpen" @didDismiss="cancel">
    <AppHeader>
      <AppToolbar>
        <template #start >
          <AppButton @click="cancel">{{ $t('common.cancel', 'Annuler') }}</AppButton>
        </template>
        <AppTitle>{{ $t('common.editImage', 'Modifier l\'image') }}</AppTitle>
        <template #end >
          <AppButton :strong="true" @click="save">{{ $t('common.save', 'Enregistrer') }}</AppButton>
        </template>
      </AppToolbar>
    </AppHeader>
    <AppContent class="cropper-content">
      <cropper
        ref="cropperRef"
        class="cropper"
        :src="imageUrl"
        :stencil-props="{
          aspectRatio: aspectRatio
        }"
      />
    </AppContent>
  </AppModal>
</template>

<script setup lang="ts">
import AppHeader from '@/components/common/layout/AppHeader.vue';
import AppToolbar from '@/components/common/layout/AppToolbar.vue';
import AppTitle from '@/components/common/layout/AppTitle.vue';
import AppContent from '@/components/common/layout/AppContent.vue';
import AppModal from '@/components/common/AppModal.vue';
import AppButton from '@/components/common/AppButton.vue';
import { ref, watch, onUnmounted } from 'vue';
import { Cropper } from 'vue-advanced-cropper';
import 'vue-advanced-cropper/dist/style.css';

const props = defineProps<{
  isOpen: boolean;
  imageFile: File | null;
  aspectRatio?: number;
}>();

const emit = defineEmits<{
  (e: 'cancel'): void;
  (e: 'save', blob: Blob, originalFile: File): void;
}>();

const imageUrl = ref<string | null>(null);
const cropperRef = ref<any>(null);

// Create object URL when a new file is provided
watch(() => props.imageFile, (newFile) => {
  if (imageUrl.value) {
    URL.revokeObjectURL(imageUrl.value);
    imageUrl.value = null;
  }
  if (newFile) {
    imageUrl.value = URL.createObjectURL(newFile);
  }
}, { immediate: true });

onUnmounted(() => {
  if (imageUrl.value) {
    URL.revokeObjectURL(imageUrl.value);
  }
});

const cancel = () => {
  emit('cancel');
};

const save = () => {
  if (!cropperRef.value || !props.imageFile) return;

  const { canvas } = cropperRef.value.getResult();
  if (canvas) {
    const mimeType = props.imageFile.type || 'image/jpeg';
    canvas.toBlob((blob: Blob | null) => {
      if (blob) {
        emit('save', blob, props.imageFile as File);
      }
    }, mimeType, 0.9);
  }
};
</script>

<style scoped>
.cropper-content {
  --background: #000000;
}
.cropper {
  height: 100%;
  width: 100%;
  background: #000;
}
</style>
