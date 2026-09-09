<script setup lang="ts">
import { onMounted } from "vue";
import { useChatStore } from "../core/store/useChatStore";
import { AttachmentKind } from "../types/chat";
import { formatBytes } from "../utils/format";
import WidgetIcon from "./WidgetIcon.vue";

const {
  activeConversationId,
  mediaItems,
  mediaKind,
  mediaHasMore,
  isLoadingMedia,
  loadMedia,
  loadMoreMedia,
  setMediaKind,
  revealMessage,
} = useChatStore();

const filters: { value: AttachmentKind | null; label: string }[] = [
  { value: null, label: "Tất cả" },
  { value: AttachmentKind.Image, label: "Ảnh" },
  { value: AttachmentKind.File, label: "Tệp" },
];

// Kho media đọc thẳng từ server chứ không suy từ tin đã tải, nếu không tìm lại tệp cũ vẫn
// phải cuộn hết lịch sử mới thấy.
onMounted(() => {
  if (!mediaItems.value.length) loadMedia();
});

const isImage = (contentType: string) => contentType.startsWith("image/");
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col">
    <div class="shrink-0 px-3 pb-2 pt-3">
      <nav class="flex gap-1 rounded-full bg-gray-100 p-0.5">
        <button
          v-for="option in filters"
          :key="option.label"
          type="button"
          class="flex-1 rounded-full py-1.5 text-xs font-semibold transition-colors"
          :class="
            mediaKind === option.value
              ? 'bg-white text-chat-accent-strong shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          "
          @click="setMediaKind(option.value)"
        >
          {{ option.label }}
        </button>
      </nav>
    </div>

    <div class="gdtd-chat-scroll min-h-0 flex-1 overflow-y-auto px-2 pb-3">
      <div v-if="isLoadingMedia && !mediaItems.length" class="space-y-1 px-1 py-1">
        <div v-for="index in 6" :key="index" class="flex animate-pulse items-center gap-3 py-2">
          <span class="h-9 w-9 shrink-0 rounded-xl bg-gray-100" />
          <span class="h-3 w-1/2 rounded-full bg-gray-100" />
        </div>
      </div>

      <div
        v-else-if="!mediaItems.length"
        class="flex flex-col items-center gap-2 px-6 py-12 text-center"
      >
        <span
          class="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-gray-500"
        >
          <WidgetIcon name="Images" :size="22" />
        </span>
        <p class="text-sm font-semibold text-gray-800">Chưa có tệp nào</p>
        <p class="max-w-56 text-xs text-gray-600">
          Ảnh và tài liệu gửi trong hội thoại sẽ được gom về đây.
        </p>
      </div>

      <template v-else>
        <ul class="space-y-0.5">
          <li
            v-for="item in mediaItems"
            :key="item.attachment.id"
            class="flex items-center gap-2 rounded-xl px-1.5 py-1.5 transition-colors hover:bg-gray-50"
          >
            <a
              :href="item.attachment.fileUrl"
              target="_blank"
              rel="noopener"
              class="flex min-w-0 flex-1 items-center gap-2.5"
            >
              <img
                v-if="isImage(item.attachment.contentType)"
                :src="item.attachment.thumbnailUrl || item.attachment.fileUrl"
                :alt="item.attachment.fileName"
                loading="lazy"
                class="h-9 w-9 shrink-0 rounded-xl object-cover ring-1 ring-gray-200"
              />
              <span
                v-else
                class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-chat-accent/10 text-chat-accent-strong"
              >
                <WidgetIcon name="FileText" :size="16" />
              </span>

              <span class="min-w-0 flex-1">
                <span class="block truncate text-xs font-semibold text-gray-800">
                  {{ item.attachment.fileName }}
                </span>
                <span class="block truncate text-[11px] text-gray-600">
                  {{ item.senderName || "Người dùng" }} ·
                  {{ formatBytes(item.attachment.sizeBytes, 0) }}
                </span>
              </span>
            </a>

            <button
              type="button"
              class="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-gray-100 hover:text-chat-accent-strong"
              aria-label="Mở tin nhắn đã gửi tệp này"
              title="Mở tin nhắn đã gửi tệp này"
              @click="activeConversationId && revealMessage(activeConversationId, item.messageId)"
            >
              <WidgetIcon name="CornerUpRight" :size="14" />
            </button>
          </li>
        </ul>

        <button
          v-if="mediaHasMore"
          type="button"
          class="mt-2 w-full rounded-full border border-gray-200 py-2 text-xs font-semibold text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-60"
          :disabled="isLoadingMedia"
          @click="loadMoreMedia"
        >
          {{ isLoadingMedia ? "Đang tải..." : "Tải thêm" }}
        </button>
      </template>
    </div>
  </div>
</template>
