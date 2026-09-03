<script setup lang="ts">
import { computed, watch } from "vue";
import { useChatStore, type ConversationFilter } from "../core/store/useChatStore";
import { debounce } from "../utils/debounce";
import ConversationRow from "./ConversationRow.vue";
import WidgetIcon from "./WidgetIcon.vue";

const {
  filter,
  keyword,
  conversations,
  filteredConversations,
  isLoadingConversations,
  loadConversations,
  selectConversation,
} = useChatStore();

// Tìm kiếm chạy ở backend (lọc cả theo tên thành viên) nên phải chờ người dùng gõ xong.
const reload = debounce(() => loadConversations(), 350);
watch(keyword, () => reload());

const unreadCount = computed(
  () => conversations.value.filter((c) => c.unreadCount > 0).length,
);

const tabs = computed<{ value: ConversationFilter; label: string; badge?: number }[]>(
  () => [
    { value: "all", label: "Tất cả" },
    { value: "unread", label: "Chưa đọc", badge: unreadCount.value },
    { value: "group", label: "Nhóm" },
  ],
);

const emptyHint = computed(() => {
  if (keyword.value.trim()) return "Không có hội thoại nào khớp từ khoá đang tìm.";
  if (filter.value === "unread") return "Bạn đã đọc hết tin nhắn.";
  if (filter.value === "group") return "Bạn chưa tham gia nhóm nào.";
  return "Bấm nút soạn tin để bắt đầu hội thoại đầu tiên.";
});
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col">
    <div class="shrink-0 px-3 pb-2 pt-3">
      <div class="relative">
        <WidgetIcon
          name="Search"
          :size="16"
          class="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500"
        />
        <input
          v-model="keyword"
          type="search"
          placeholder="Tìm hội thoại hoặc đồng nghiệp"
          class="w-full rounded-full border border-gray-200 bg-gray-50 py-2 pl-10 pr-4 text-sm text-gray-900 outline-none transition-all placeholder:text-gray-500 focus:border-chat-accent focus:bg-white focus:ring-4 focus:ring-chat-accent/10"
        />
      </div>

      <nav class="mt-2 flex gap-1">
        <button
          v-for="tab in tabs"
          :key="tab.value"
          type="button"
          class="rounded-full px-3 py-1.5 text-xs font-semibold transition-colors"
          :class="
            filter === tab.value
              ? 'bg-chat-accent/10 text-chat-accent-strong'
              : 'text-gray-600 hover:bg-gray-100'
          "
          @click="filter = tab.value"
        >
          {{ tab.label }}
          <span v-if="tab.badge" class="ml-0.5 tabular-nums">({{ tab.badge }})</span>
        </button>
      </nav>
    </div>

    <div class="gdtd-chat-scroll min-h-0 flex-1 overflow-y-auto">
      <div v-if="isLoadingConversations && !filteredConversations.length">
        <div
          v-for="index in 6"
          :key="index"
          class="flex animate-pulse items-center gap-3 border-b border-gray-50 px-4 py-3"
        >
          <span class="h-11 w-11 shrink-0 rounded-full bg-gray-100" />
          <span class="min-w-0 flex-1 space-y-2">
            <span class="block h-3 w-2/5 rounded-full bg-gray-100" />
            <span class="block h-3 w-4/5 rounded-full bg-gray-50" />
          </span>
        </div>
      </div>

      <template v-else>
        <ConversationRow
          v-for="conversation in filteredConversations"
          :key="conversation.id"
          :conversation="conversation"
          @select="selectConversation"
        />

        <div
          v-if="!filteredConversations.length"
          class="flex flex-col items-center gap-2 px-6 py-14 text-center"
        >
          <span
            class="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-gray-500"
          >
            <WidgetIcon name="MessageSquareDashed" :size="22" />
          </span>
          <p class="text-sm font-semibold text-gray-800">Không có hội thoại nào</p>
          <p class="max-w-56 text-xs text-gray-600">{{ emptyHint }}</p>
        </div>
      </template>
    </div>
  </div>
</template>
