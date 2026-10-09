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
    <p class="mb-1.5 text-[11px] text-gray-500">{{ label }}</p>
    <div class="flex flex-wrap gap-1.5">
      <button
        v-for="option in options"
        :key="option.key"
        type="button"
        role="radio"
        :aria-checked="model === option.key"
        class="rounded-full border px-2.5 py-1 text-[11px] leading-none transition-colors"
        :class="
          model === option.key
            ? 'border-chat-accent/40 bg-chat-accent/10 font-semibold text-chat-accent-strong'
            : 'border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50 hover:text-gray-800'
        "
        @click="model = option.key"
      >
        {{ option.label }}
      </button>
    </div>
  </div>
</template>
