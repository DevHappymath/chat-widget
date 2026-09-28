<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useChatStore, type ConversationFilter } from "../core/store/useChatStore";
import { debounce } from "../utils/debounce";
import ConversationRow from "./ConversationRow.vue";
import GlobalSearchResults from "./GlobalSearchResults.vue";
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

/** Chỉ hiện khi đang gõ từ khoá: không có từ khoá thì "tìm tin nhắn" không có gì để tìm. */
type SearchScope = "conversations" | "messages";

const searchScope = ref<SearchScope>("conversations");

const isSearching = computed(() => Boolean(keyword.value.trim()));

watch(isSearching, (searching) => {
  if (!searching) searchScope.value = "conversations";
});

const searchScopes: { value: SearchScope; label: string }[] = [
  { value: "conversations", label: "Hội thoại" },
  { value: "messages", label: "Tin nhắn" },
];

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
          class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
        />
        <input
          v-model="keyword"
          type="search"
          placeholder="Tìm hội thoại hoặc đồng nghiệp"
          class="w-full rounded-xl border border-transparent bg-gray-100 py-2 pl-9 pr-3 text-sm text-gray-900 outline-none transition-colors placeholder:text-gray-500 focus:border-chat-accent/50 focus:bg-white"
        />
      </div>

      <nav v-if="isSearching" class="mt-2 flex gap-1">
        <button
          v-for="scope in searchScopes"
          :key="scope.value"
          type="button"
          class="rounded-full px-3 py-1.5 text-xs font-medium transition-colors"
          :class="
            searchScope === scope.value
              ? 'bg-chat-accent-strong text-white'
              : 'text-gray-600 hover:bg-chat-accent/10 hover:text-chat-accent-strong'
          "
          @click="searchScope = scope.value"
        >
          {{ scope.label }}
        </button>
      </nav>

      <nav v-else class="mt-2 flex gap-1">
        <button
          v-for="tab in tabs"
          :key="tab.value"
          type="button"
          class="rounded-full px-3 py-1.5 text-xs font-medium transition-colors"
          :class="
            filter === tab.value
              ? 'bg-chat-accent-strong text-white'
              : 'text-gray-600 hover:bg-chat-accent/10 hover:text-chat-accent-strong'
          "
          @click="filter = tab.value"
        >
          {{ tab.label }}
          <span v-if="tab.badge" class="ml-0.5 tabular-nums opacity-70">{{ tab.badge }}</span>
        </button>
      </nav>
    </div>

    <div class="gdtd-chat-scroll min-h-0 flex-1 overflow-y-auto border-t border-gray-100">
      <GlobalSearchResults v-if="isSearching && searchScope === 'messages'" />

      <div v-else-if="isLoadingConversations && !filteredConversations.length" class="p-2">
        <div
          v-for="index in 6"
          :key="index"
          class="flex animate-pulse items-center gap-3 px-2.5 py-2.5"
        >
          <span class="h-11 w-11 shrink-0 rounded-full bg-gray-100" />
          <span class="min-w-0 flex-1 space-y-2">
            <span class="block h-3 w-2/5 rounded-full bg-gray-100" />
            <span class="block h-3 w-4/5 rounded-full bg-gray-50" />
          </span>
        </div>
      </div>

      <div v-else class="space-y-0.5 p-2">
        <ConversationRow
          v-for="conversation in filteredConversations"
          :key="conversation.id"
          :conversation="conversation"
          @select="selectConversation"
        />

        <div
          v-if="!filteredConversations.length"
          class="px-4 py-12 text-center"
        >
          <p class="text-sm font-medium text-gray-800">Không có hội thoại nào</p>
          <p class="mx-auto mt-1 max-w-56 text-xs leading-relaxed text-gray-600">
            {{ emptyHint }}
          </p>
        </div>
      </div>
    </div>
  </div>
</template>
