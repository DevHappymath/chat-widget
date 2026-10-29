<script setup lang="ts">
import { computed, ref } from "vue";
import { MAX_PINNED_PER_CONVERSATION } from "../constants/chat";
import { useChatStore } from "../core/store/useChatStore";
import { useWidgetConfirm } from "../core/store/useWidgetConfirm";
import type { ChatConversation, ChatMessage } from "../types/chat";
import { messagePreview } from "../utils/chat";
import WidgetIcon from "./WidgetIcon.vue";

const props = defineProps<{ conversation: ChatConversation }>();

const { pinnedOf, membersOf, revealMessage, togglePinMessage } = useChatStore();

const { ask } = useWidgetConfirm();

const isPinnedBarExpanded = ref(false);

const pinnedMessages = computed(() => pinnedOf(props.conversation.id));

/** Thanh thu gọn chỉ khoe tin ghim mới nhất, đúng chỗ người ta nhìn đầu tiên. */
const latest = computed(() => pinnedMessages.value[0] ?? null);

const senderNameOf = (message: ChatMessage) => {
  if (message.senderName) return message.senderName;

  const participant = membersOf(props.conversation).find(
    (p) => p.userId.toLowerCase() === message.senderId.toLowerCase(),
  );

  return participant?.fullName || participant?.email || "Người dùng";
};

const onOpen = (message: ChatMessage) => revealMessage(props.conversation.id, message.id);

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
  <div v-if="latest" class="shrink-0 border-b border-gray-100 bg-chat-accent/5">
    <div class="flex items-center gap-2 px-3 py-1.5">
      <WidgetIcon name="Pin" :size="14" class="shrink-0 text-chat-accent" />

      <button type="button" class="min-w-0 flex-1 text-left" @click="onOpen(latest)">
        <span class="block truncate text-[11px] font-semibold tabular-nums text-chat-accent-strong">
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
        class="inline-flex h-6 shrink-0 items-center gap-0.5 rounded-full px-1.5 text-[10px] font-semibold text-chat-accent-strong transition-colors hover:bg-chat-accent/10"
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
        class="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-chat-accent/10 hover:text-chat-accent-strong"
        aria-label="Bỏ ghim tin nhắn này"
        title="Bỏ ghim tin nhắn này"
        @click="onUnpin(latest)"
      >
        <WidgetIcon name="PinOff" :size="13" />
      </button>
    </div>

    <ul
      v-if="isPinnedBarExpanded && pinnedMessages.length > 1"
      class="gdtd-chat-scroll max-h-40 overflow-y-auto border-t border-chat-accent/10 px-1.5 pb-1.5"
    >
      <li v-for="message in pinnedMessages" :key="message.id" class="flex items-center gap-1">
        <button
          type="button"
          class="min-w-0 flex-1 rounded-lg px-2 py-1 text-left transition-colors hover:bg-chat-accent/10"
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
          class="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-chat-accent/10 hover:text-chat-accent-strong"
          :aria-label="`Bỏ ghim tin của ${senderNameOf(message)}`"
          @click="onUnpin(message)"
        >
          <WidgetIcon name="PinOff" :size="12" />
        </button>
      </li>
    </ul>
  </div>
</template>
