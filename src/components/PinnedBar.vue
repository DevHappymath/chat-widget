<script setup lang="ts">
import { computed } from "vue";
import { MAX_PINNED_PER_CONVERSATION } from "../constants/chat";
import { useChatStore } from "../core/store/useChatStore";
import { useWidgetConfirm } from "../core/store/useWidgetConfirm";
import type { ChatMessage } from "../types/chat";
import { messagePreview } from "../utils/chat";
import WidgetIcon from "./WidgetIcon.vue";

const {
  activeConversation,
  activeConversationId,
  pinnedMessages,
  isPinnedBarExpanded,
  membersOf,
  revealMessage,
  togglePinMessage,
} = useChatStore();

const { ask } = useWidgetConfirm();

/** Thanh thu gọn chỉ khoe tin ghim mới nhất, đúng chỗ người ta nhìn đầu tiên. */
const latest = computed(() => pinnedMessages.value[0] ?? null);

const senderNameOf = (message: ChatMessage) => {
  if (message.senderName) return message.senderName;

  const participant = activeConversation.value
    ? membersOf(activeConversation.value).find(
        (p) => p.userId.toLowerCase() === message.senderId.toLowerCase(),
      )
    : undefined;

  return participant?.fullName || participant?.email || "Người dùng";
};

const onOpen = (message: ChatMessage) => {
  if (activeConversationId.value) {
    revealMessage(activeConversationId.value, message.id);
  }
};

const onUnpin = async (message: ChatMessage) => {
  const agreed = await ask({
    title: "Bỏ ghim tin nhắn",
    message: "Bỏ ghim tin này? Thanh ghim của mọi người trong hội thoại sẽ cập nhật theo.",
    confirmText: "Bỏ ghim",
  });

  if (agreed) await togglePinMessage(message);
};
</script>

<template>
  <div v-if="latest" class="shrink-0 border-b border-gray-100 bg-amber-50">
    <div class="flex items-center gap-2 px-3 py-1.5">
      <WidgetIcon name="Pin" :size="14" class="shrink-0 text-amber-600" />

      <button type="button" class="min-w-0 flex-1 text-left" @click="onOpen(latest)">
        <span class="block truncate text-[11px] font-semibold text-amber-700">
          Tin đã ghim
          <template v-if="pinnedMessages.length > 1">
            ({{ pinnedMessages.length }}/{{ MAX_PINNED_PER_CONVERSATION }})
          </template>
        </span>
        <span class="block truncate text-[11px] text-gray-700">
          {{ senderNameOf(latest) }}: {{ messagePreview(latest) }}
        </span>
      </button>

      <button
        v-if="pinnedMessages.length > 1"
        type="button"
        class="inline-flex h-6 shrink-0 items-center gap-0.5 rounded-full px-1.5 text-[10px] font-semibold text-amber-700 transition-colors hover:bg-amber-100"
        @click="isPinnedBarExpanded = !isPinnedBarExpanded"
      >
        {{ isPinnedBarExpanded ? "Thu gọn" : "Tất cả" }}
        <WidgetIcon
          name="ChevronDown"
          :size="12"
          class="transition-transform"
          :class="isPinnedBarExpanded && 'rotate-180'"
        />
      </button>

      <button
        type="button"
        class="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-amber-600 transition-colors hover:bg-amber-100"
        aria-label="Bỏ ghim tin nhắn này"
        title="Bỏ ghim tin nhắn này"
        @click="onUnpin(latest)"
      >
        <WidgetIcon name="PinOff" :size="13" />
      </button>
    </div>

    <ul
      v-if="isPinnedBarExpanded && pinnedMessages.length > 1"
      class="gdtd-chat-scroll max-h-40 overflow-y-auto border-t border-amber-100 px-1.5 pb-1.5"
    >
      <li v-for="message in pinnedMessages" :key="message.id" class="flex items-center gap-1">
        <button
          type="button"
          class="min-w-0 flex-1 rounded-lg px-2 py-1 text-left transition-colors hover:bg-amber-100"
          @click="onOpen(message)"
        >
          <span class="block truncate text-[11px] font-semibold text-gray-800">
            {{ senderNameOf(message) }}
          </span>
          <span class="block truncate text-[11px] text-gray-600">
            {{ messagePreview(message) }}
          </span>
        </button>

        <button
          type="button"
          class="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-amber-600 transition-colors hover:bg-amber-100"
          :aria-label="`Bỏ ghim tin của ${senderNameOf(message)}`"
          @click="onUnpin(message)"
        >
          <WidgetIcon name="PinOff" :size="12" />
        </button>
      </li>
    </ul>
  </div>
</template>
