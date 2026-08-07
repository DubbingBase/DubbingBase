<template>
  <select
    :value="modelValue"
    @change="$emit('update:modelValue', ($event.target as HTMLSelectElement).value)"
    :required="required"
    class="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
  >
    <option value="fr-FR">Français (France)</option>
    <option value="fr-CA">Français (Canada)</option>
    <option value="fr-BE">Français (Belgique)</option>
    <option value="en-US">English (US)</option>
    <option value="en-GB">English (UK)</option>
    <option value="ja-JP">Japanese</option>
    <option value="es-ES">Español (España)</option>
    <option value="es-MX">Español (Latinoamérica)</option>
    <option value="de-DE">Deutsch</option>
    <option value="it-IT">Italiano</option>
    <option value="pt-BR">Português (Brasil)</option>
    <option value="pt-PT">Português (Portugal)</option>
  </select>
</template>

<script setup lang="ts">
defineProps<{
  modelValue: string;
  required?: boolean;
}>();

defineEmits<{
  (e: 'update:modelValue', value: string): void;
}>();
</script>
