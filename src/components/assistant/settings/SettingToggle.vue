<script setup lang="ts">
const model = defineModel<boolean>({ required: true });
</script>

<template>
  <button
    type="button"
    role="switch"
    :aria-checked="model"
    class="relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors"
    :class="model ? 'bg-chat-accent-strong' : 'bg-gray-200'"
    @click="model = !model"
  >
    <span
      class="inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform"
      :class="model ? 'translate-x-5.5' : 'translate-x-0.5'"
    />
  </button>
</template>
