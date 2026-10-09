<script setup lang="ts">
import type { PresenceDuration } from "../constants/presence";

/** Hàng nút chọn thời hạn, thay cho ô chọn của trình duyệt vốn không chỉnh được giao diện. */
defineProps<{
  label: string;
  options: readonly { key: PresenceDuration; label: string }[];
}>();

const model = defineModel<PresenceDuration>({ required: true });
</script>

<template>
  <div role="radiogroup" :aria-label="label">
    <p class="mb-1.5 text-xs font-medium text-gray-700">{{ label }}</p>
    <div class="flex flex-wrap gap-1.5">
      <button
        v-for="option in options"
        :key="option.key"
        type="button"
        role="radio"
        :aria-checked="model === option.key"
        class="rounded-full border px-2.5 py-1.5 text-xs leading-none transition-colors"
        :class="
          model === option.key
            ? 'border-chat-accent/40 bg-chat-accent/10 font-semibold text-chat-accent-strong'
            : 'border-gray-300 text-gray-700 hover:bg-gray-50 hover:text-gray-900'
        "
        @click="model = option.key"
      >
        {{ option.label }}
      </button>
    </div>
  </div>
</template>
