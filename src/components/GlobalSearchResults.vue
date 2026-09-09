<script setup lang="ts">
import { computed, watch } from "vue";
import { MIN_SEARCH_KEYWORD_LENGTH } from "../constants/chat";
import { useChatStore } from "../core/store/useChatStore";
import { ConversationType, type MessageSearchItem } from "../types/chat";
import { chatListTimestamp, splitKeywordMatches } from "../utils/chat";
import { debounce } from "../utils/debounce";
import WidgetIcon from "./WidgetIcon.vue";

const {
  keyword,
  globalSearchResults,
  globalSearchTotal,
  globalSearchPage,
  isSearchingGlobal,
  searchAllMessages,
  revealMessage,
} = useChatStore();

const PAGE_SIZE = 20;

const run = debounce(() => searchAllMessages(1), 350);
watch(keyword, () => run(), { immediate: true });

const keywordReady = computed(
  () => keyword.value.trim().length >= MIN_SEARCH_KEYWORD_LENGTH,
);

const hasMore = computed(() => globalSearchPage.value * PAGE_SIZE < globalSearchTotal.value);

const titleOfItem = (item: MessageSearchItem) =>
  item.conversationName?.trim() ||
  (item.conversationType === ConversationType.Group ? "Nhóm" : "Hội thoại");
</script>

<template>
  <div class="py-1">
    <div v-if="isSearchingGlobal && !globalSearchResults.length" class="space-y-2 p-3">
      <div v-for="index in 5" :key="index" class="animate-pulse space-y-2 px-1 py-1.5">
        <span class="block h-3 w-1/3 rounded-full bg-gray-100" />
        <span class="block h-3 w-4/5 rounded-full bg-gray-50" />
      </div>
    </div>

    <p v-else-if="!keywordReady" class="px-6 py-12 text-center text-xs text-gray-600">
      Gõ ít nhất {{ MIN_SEARCH_KEYWORD_LENGTH }} ký tự để tìm tin nhắn trong mọi hội thoại
      bạn đang tham gia.
    </p>

    <div
      v-else-if="!globalSearchResults.length"
      class="flex flex-col items-center gap-2 px-6 py-12 text-center"
    >
      <span
        class="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-gray-500"
      >
        <WidgetIcon name="SearchX" :size="22" />
      </span>
      <p class="text-sm font-semibold text-gray-800">Không có tin nhắn nào khớp</p>
      <p class="max-w-56 text-xs text-gray-600">
        Gõ không dấu vẫn ra kết quả có dấu. Tin đã thu hồi không nằm trong kết quả.
      </p>
    </div>

    <template v-else>
      <ul class="px-2">
        <li v-for="item in globalSearchResults" :key="item.message.id">
          <button
            type="button"
            class="w-full rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-gray-100"
            @click="revealMessage(item.conversationId, item.message.id)"
          >
            <span class="flex items-baseline justify-between gap-2">
              <span class="truncate text-xs font-bold text-gray-900">
                {{ titleOfItem(item) }}
              </span>
              <span class="shrink-0 text-[10px] text-gray-500">
                {{ chatListTimestamp(item.message.createdAtUtc) }}
              </span>
            </span>
            <span class="mt-0.5 line-clamp-2 text-xs text-gray-600">
              <span class="font-semibold text-gray-700">
                {{ item.message.senderName || "Người dùng" }}:
              </span>
              <span
                v-for="(segment, index) in splitKeywordMatches(
                  item.message.content ?? '',
                  keyword,
                )"
                :key="index"
                :class="segment.isMatch && 'bg-amber-100 font-semibold text-gray-900'"
                >{{ segment.text }}</span
              >
            </span>
          </button>
        </li>
      </ul>

      <div class="flex items-center justify-between gap-2 px-3 py-2">
        <span class="text-[11px] text-gray-600">{{ globalSearchTotal }} kết quả</span>
        <div class="flex gap-1.5">
          <button
            type="button"
            class="rounded-full border border-gray-200 px-3 py-1 text-[11px] font-semibold text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
            :disabled="globalSearchPage <= 1 || isSearchingGlobal"
            @click="searchAllMessages(globalSearchPage - 1)"
          >
            Trước
          </button>
          <button
            type="button"
            class="rounded-full border border-gray-200 px-3 py-1 text-[11px] font-semibold text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
            :disabled="!hasMore || isSearchingGlobal"
            @click="searchAllMessages(globalSearchPage + 1)"
          >
            Sau
          </button>
        </div>
      </div>
    </template>
  </div>
</template>
