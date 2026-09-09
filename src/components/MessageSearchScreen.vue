<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { MIN_SEARCH_KEYWORD_LENGTH } from "../constants/chat";
import { useChatStore } from "../core/store/useChatStore";
import type { ChatMessage } from "../types/chat";
import { splitKeywordMatches } from "../utils/chat";
import { debounce } from "../utils/debounce";
import { formatDateTime } from "../utils/format";
import WidgetIcon from "./WidgetIcon.vue";

const {
  activeConversationId,
  messageSearchKeyword,
  messageSearchResults,
  messageSearchHasMore,
  isSearchingMessages,
  searchMessages,
  loadMoreSearchResults,
  resetMessageSearch,
  revealMessage,
} = useChatStore();

const input = ref<HTMLInputElement | null>(null);

const run = debounce(() => searchMessages(), 350);
watch(messageSearchKeyword, () => run());

onMounted(() => input.value?.focus());

const keywordReady = computed(
  () => messageSearchKeyword.value.trim().length >= MIN_SEARCH_KEYWORD_LENGTH,
);

const onPick = async (message: ChatMessage) => {
  const conversationId = activeConversationId.value;
  if (!conversationId) return;

  await revealMessage(conversationId, message.id);
  resetMessageSearch();
};
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
          ref="input"
          v-model="messageSearchKeyword"
          type="search"
          placeholder="Tìm trong hội thoại này"
          class="w-full rounded-full bg-gray-50 py-2 pl-10 pr-4 text-sm text-gray-900 outline-none ring-1 ring-gray-200 transition-colors placeholder:text-gray-500 focus:bg-white focus:ring-2 focus:ring-chat-accent"
        />
      </div>
    </div>

    <div class="gdtd-chat-scroll min-h-0 flex-1 overflow-y-auto px-2 pb-3">
      <div v-if="isSearchingMessages && !messageSearchResults.length" class="space-y-2 p-2">
        <div v-for="index in 5" :key="index" class="animate-pulse space-y-2 px-1 py-1.5">
          <span class="block h-3 w-1/3 rounded-full bg-gray-100" />
          <span class="block h-3 w-4/5 rounded-full bg-gray-50" />
        </div>
      </div>

      <p v-else-if="!keywordReady" class="px-5 py-12 text-center text-xs text-gray-600">
        Gõ ít nhất {{ MIN_SEARCH_KEYWORD_LENGTH }} ký tự để tìm. Gõ không dấu vẫn ra kết quả
        có dấu.
      </p>

      <div
        v-else-if="!messageSearchResults.length"
        class="flex flex-col items-center gap-2 px-6 py-12 text-center"
      >
        <span
          class="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-gray-500"
        >
          <WidgetIcon name="SearchX" :size="22" />
        </span>
        <p class="text-sm font-semibold text-gray-800">Không có tin nhắn nào khớp</p>
        <p class="max-w-56 text-xs text-gray-600">
          Thử từ khoá ngắn hơn, hoặc bỏ bớt từ trong câu.
        </p>
      </div>

      <ul v-else class="space-y-0.5">
        <li v-for="message in messageSearchResults" :key="message.id">
          <button
            type="button"
            class="w-full rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-gray-100"
            @click="onPick(message)"
          >
            <span class="flex items-baseline justify-between gap-2">
              <span class="truncate text-xs font-semibold text-gray-800">
                {{ message.senderName || "Người dùng" }}
              </span>
              <span class="shrink-0 text-[10px] text-gray-500">
                {{ formatDateTime(message.createdAtUtc) }}
              </span>
            </span>
            <span class="mt-0.5 line-clamp-2 text-xs text-gray-600">
              <span
                v-for="(segment, index) in splitKeywordMatches(
                  message.content ?? '',
                  messageSearchKeyword,
                )"
                :key="index"
                :class="segment.isMatch && 'bg-amber-100 font-semibold text-gray-900'"
                >{{ segment.text }}</span
              >
            </span>
          </button>
        </li>

        <li v-if="messageSearchHasMore" class="px-2.5 py-2">
          <button
            type="button"
            class="w-full rounded-full border border-gray-200 py-2 text-xs font-semibold text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-60"
            :disabled="isSearchingMessages"
            @click="loadMoreSearchResults"
          >
            {{ isSearchingMessages ? "Đang tải..." : "Tải thêm kết quả" }}
          </button>
        </li>
      </ul>
    </div>
  </div>
</template>
