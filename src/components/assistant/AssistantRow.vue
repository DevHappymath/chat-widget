<script setup lang="ts">
import { computed } from "vue";
import { useAssistant } from "../../core/store/useAssistant";
import { useChatStore } from "../../core/store/useChatStore";
import AssistantAvatar from "./AssistantAvatar.vue";

const { access, threads, open } = useAssistant();
const { assistantUnread } = useChatStore();
const isUnread = computed(() => assistantUnread.value > 0);

const subtitle = computed(() => {
  if (!access.value.isEnabled) return "Đang tắt, chỉ quản trị viên thấy";
  return threads.value[0]?.title ?? "Hỏi nhanh về lead, lớp học, quy trình";
});
</script>

<template>
  <div class="rounded-xl transition-colors hover:bg-gray-50">
    <button
      type="button"
      class="flex w-full min-w-0 items-center gap-3 py-2.5 pl-2.5 pr-3 text-left"
      @click="open"
    >
      <AssistantAvatar size="md" />

      <span class="min-w-0 flex-1">
        <span class="flex items-center gap-1.5">
          <span class="truncate text-sm font-semibold text-gray-900">Trợ lý GDTD</span>
          <span
            v-if="!access.isEnabled"
            class="shrink-0 rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-500"
          >
            Đang tắt
          </span>
        </span>
        <span
          class="mt-0.5 block truncate text-xs"
          :class="isUnread ? 'font-medium text-gray-900' : 'text-gray-500'"
        >
          {{ isUnread ? "Đã trả lời, bấm để xem" : subtitle }}
        </span>
      </span>

      <span
        v-if="isUnread"
        class="inline-flex h-4.5 min-w-4.5 shrink-0 items-center justify-center rounded-full bg-chat-accent-strong px-1 text-[11px] font-semibold tabular-nums text-white"
        :aria-label="`${assistantUnread} câu trả lời chưa xem`"
      >
        {{ assistantUnread }}
      </span>
    </button>
  </div>
</template>
