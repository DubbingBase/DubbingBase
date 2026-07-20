<template>
  <div class="empty-state">
    <div class="empty-icon">
      <slot name="icon">
        <Inbox class="icon-svg" />
      </slot>
    </div>
    <span class="empty-text">
      <slot>{{ text || t('common.noInfo', 'Non renseigné') }}</slot>
    </span>
    <div v-if="$slots.action" class="empty-action">
      <slot name="action"></slot>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import Inbox from '~icons/lucide/inbox';

const { t } = useI18n();

defineProps<{
  text?: string;
}>();
</script>

<style scoped lang="scss">
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 24px;
  margin: 8px 0;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.02);
  transition: all 0.2s ease-in-out;
  text-align: center;
}

.empty-icon {
  margin-bottom: 12px;
  opacity: 0.6;
  color: #9ca3af;
  
  .icon-svg {
    width: 32px;
    height: 32px;
  }
}

.empty-text {
  font-size: 14px;
  font-weight: 500;
  color: #9ca3af;
}

.empty-action {
  margin-top: 16px;
}
</style>
