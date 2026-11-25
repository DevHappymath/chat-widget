<script setup lang="ts">
import { computed, onMounted } from "vue";
import { useAssistant } from "../../core/store/useAssistant";
import { useWidgetConfirm } from "../../core/store/useWidgetConfirm";
import type { AssistantThread } from "../../types/assistant";
import { chatListTimestamp } from "../../utils/chat";
import WidgetIcon from "../WidgetIcon.vue";

const { threads, activeThreadId, isLoadingThreads, loadThreads, selectThread, deleteThread, newThread } =
  useAssistant();
const { ask } = useWidgetConfirm();

const isToday = (iso: string) => new Date(iso).toDateString() === new Date().toDateString();

const groups = computed(() =>
  [
    { label: "Hôm nay", items: threads.value.filter((t) => isToday(t.lastMessageAtUtc)) },
    { label: "Trước đó", items: threads.value.filter((t) => !isToday(t.lastMessageAtUtc)) },
  ].filter((g) => g.items.length),
);

const onDelete = async (thread: AssistantThread) => {
  const agreed = await ask({
    title: "Xoá cuộc hỏi",
    message: `Xoá "${thread.title}"? Câu hỏi và câu trả lời trong cuộc này sẽ mất hẳn.`,
    confirmText: "Xoá",
    danger: true,
  });
  if (agreed) await deleteThread(thread.id);
};

onMounted(() => {
  if (!threads.value.length) void loadThreads();
});
</script>

<template>
  <div class="gdtd-chat-scroll min-h-0 flex-1 overflow-y-auto p-2">
    <button
      type="button"
      class="mb-1 flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium text-chat-accent-strong transition-colors hover:bg-chat-accent/10"
      @click="newThread"
    >
      <WidgetIcon name="SquarePen" :size="16" />
      Cuộc hỏi mới
    </button>

    <div v-if="isLoadingThreads && !threads.length" class="space-y-2 p-3">
      <span v-for="i in 5" :key="i" class="block h-4 animate-pulse rounded-full bg-gray-100" />
    </div>

    <p v-else-if="!threads.length" class="px-3 py-10 text-center text-xs text-gray-500">Chưa có cuộc hỏi nào.</p>

    <section v-for="group in groups" :key="group.label" class="mt-2">
      <p class="px-3 pb-1 text-[11px] font-medium tracking-wide text-gray-400 uppercase">{{ group.label }}</p>
      <div
        v-for="thread in group.items"
        :key="thread.id"
        class="group flex items-center rounded-xl transition-colors"
        :class="thread.id === activeThreadId ? 'bg-chat-accent/10' : 'hover:bg-gray-50'"
      >
        <button type="button" class="min-w-0 flex-1 px-3 py-2 text-left" @click="selectThread(thread.id)">
          <span class="block truncate text-sm text-gray-900">{{ thread.title }}</span>
          <span class="mt-0.5 block text-[11px] text-gray-500">{{ chatListTimestamp(thread.lastMessageAtUtc) }}</span>
        </button>
        <button
          type="button"
          class="mr-1.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-gray-400 opacity-0 transition-all group-hover:opacity-100 hover:bg-red-50 hover:text-red-600 focus-visible:opacity-100 chat-touch:opacity-100"
          :aria-label="`Xoá cuộc hỏi ${thread.title}`"
          @click="onDelete(thread)"
        >
          <WidgetIcon name="Trash2" :size="14" />
        </button>
      </div>
    </section>
  </div>
</template>
