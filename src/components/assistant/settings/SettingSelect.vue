<script setup lang="ts">
import WidgetIcon from "../../WidgetIcon.vue";

/** Ô chọn gọn cho widget; site chủ có UiSelection riêng nhưng widget không mượn được component của site. */
defineProps<{
  label?: string;
  placeholder?: string;
  options: { label: string; value: string | number }[];
}>();

const model = defineModel<string | number>({ required: true });
</script>

<template>
  <label class="block">
    <span v-if="label" class="mb-1 block text-xs font-medium text-gray-600">{{ label }}</span>
    <span class="relative block">
      <select
        v-model="model"
        class="w-full appearance-none rounded-xl border border-gray-200 bg-white py-2 pl-3 pr-9 text-sm text-gray-900 outline-none transition-colors focus:border-chat-accent/50 focus:ring-2 focus:ring-chat-accent/15"
      >
        <option v-if="!options.length" value="" disabled>{{ placeholder ?? "Chưa có lựa chọn" }}</option>
        <option v-for="option in options" :key="option.value" :value="option.value">{{ option.label }}</option>
      </select>
      <WidgetIcon
        name="ChevronDown"
        :size="16"
        class="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
      />
    </span>
  </label>
</template>
