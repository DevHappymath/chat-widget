<script setup lang="ts">
import { computed } from "vue";
import WidgetIcon from "../../WidgetIcon.vue";

const props = defineProps<{
  options: string[];
  /** Chữ hiện khi chưa chọn vai trò nào, vì rỗng nghĩa là mọi nhân sự. */
  emptyLabel?: string;
}>();

const model = defineModel<string[]>({ required: true });

/** Học sinh không bao giờ dùng trợ lý, nên không cho chọn vai trò của học sinh. */
const choices = computed(() => props.options.filter((role) => role !== "Student"));

const toggle = (role: string) => {
  model.value = model.value.includes(role)
    ? model.value.filter((r) => r !== role)
    : [...model.value, role];
};
</script>

<template>
  <div>
    <div class="flex flex-wrap gap-1.5">
      <button
        v-for="role in choices"
        :key="role"
        type="button"
        class="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors"
        :class="
          model.includes(role)
            ? 'border-chat-accent-strong bg-chat-accent-strong text-white'
            : 'border-gray-200 bg-white text-gray-600 hover:border-chat-accent/40 hover:text-chat-accent-strong'
        "
        :aria-pressed="model.includes(role)"
        @click="toggle(role)"
      >
        <WidgetIcon v-if="model.includes(role)" name="Check" :size="12" />
        {{ role }}
      </button>
    </div>
    <p v-if="!model.length && emptyLabel" class="mt-1.5 text-xs text-gray-500">{{ emptyLabel }}</p>
  </div>
</template>
