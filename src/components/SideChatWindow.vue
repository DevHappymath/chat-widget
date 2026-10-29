<script setup lang="ts">
import { computed } from "vue";
import { useChatStore } from "../core/store/useChatStore";
import type { ChatConversation } from "../types/chat";
import MessageThread from "./MessageThread.vue";
import WidgetIcon from "./WidgetIcon.vue";

const props = defineProps<{ conversation: ChatConversation }>();

const { isGroup, titleOf, minimizeSide, closeSide } = useChatStore();

const subheading = computed(() => (isGroup(props.conversation) ? "Nhóm" : "Hội thoại riêng"));
</script>

<template>
  <section
    class="relative flex h-full w-full flex-col overflow-hidden rounded-t-2xl border border-b-0 border-gray-200 bg-white shadow-2xl"
    role="dialog"
    :aria-label="`Khung chat ${titleOf(conversation)}`"
  >
    <header
      class="flex shrink-0 items-center gap-2 border-b border-gray-100 bg-chat-accent-strong px-3 py-3 text-white"
    >
      <div class="min-w-0 flex-1">
        <p class="truncate text-sm font-medium">Đoạn chat</p>
        <p class="truncate text-[11px] text-white/75">{{ subheading }}</p>
      </div>

      <button
        type="button"
        class="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white/90 transition-colors hover:bg-white/15 hover:text-white"
        aria-label="Thu nhỏ hội thoại"
        title="Thu nhỏ hội thoại"
        @click="minimizeSide()"
      >
        <WidgetIcon name="Minus" :size="18" />
      </button>

      <button
        type="button"
        class="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white/90 transition-colors hover:bg-white/15 hover:text-white"
        aria-label="Đóng hội thoại"
        title="Đóng hội thoại"
        @click="closeSide()"
      >
        <WidgetIcon name="X" :size="18" />
      </button>
    </header>

    <MessageThread :conversation-id="conversation.id" secondary />
  </section>
</template>
