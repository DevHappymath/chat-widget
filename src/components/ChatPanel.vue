<script setup lang="ts">
import { computed } from "vue";
import { useChatStore } from "../core/store/useChatStore";
import ConfirmDialog from "./ConfirmDialog.vue";
import ContactPicker from "./ContactPicker.vue";
import ConversationList from "./ConversationList.vue";
import MessageThread from "./MessageThread.vue";
import WidgetIcon from "./WidgetIcon.vue";
import WidgetToaster from "./WidgetToaster.vue";

const { view, currentUserName, closePanel, backToList } = useChatStore();

const HEADINGS: Record<string, string> = {
  list: "Đoạn chat",
  contacts: "Tin nhắn mới",
  thread: "Đoạn chat",
};

const heading = computed(() => HEADINGS[view.value] ?? "Đoạn chat");
const showBack = computed(() => view.value !== "list");
</script>

<template>
  <section
    class="relative flex h-full w-full flex-col overflow-hidden bg-white sm:rounded-2xl sm:border sm:border-gray-200 sm:shadow-2xl"
    role="dialog"
    aria-label="Khung chat nội bộ"
  >
    <header
      class="flex shrink-0 items-center gap-2 border-b border-gray-100 bg-chat-accent-strong px-3 py-3 text-white"
    >
      <button
        v-if="showBack"
        type="button"
        class="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white/90 transition-colors hover:bg-white/15 hover:text-white"
        aria-label="Quay lại danh sách"
        @click="backToList"
      >
        <WidgetIcon name="ArrowLeft" :size="18" />
      </button>

      <div class="min-w-0 flex-1">
        <p class="truncate text-sm font-bold">{{ heading }}</p>
        <p class="truncate text-[11px] text-white/75">{{ currentUserName }}</p>
      </div>

      <button
        v-if="view === 'list'"
        type="button"
        class="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white/90 transition-colors hover:bg-white/15 hover:text-white"
        aria-label="Tin nhắn mới"
        title="Tin nhắn mới"
        @click="view = 'contacts'"
      >
        <WidgetIcon name="SquarePen" :size="17" />
      </button>

      <button
        type="button"
        class="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white/90 transition-colors hover:bg-white/15 hover:text-white"
        aria-label="Đóng khung chat"
        @click="closePanel"
      >
        <WidgetIcon name="X" :size="18" />
      </button>
    </header>

    <ConversationList v-if="view === 'list'" />
    <ContactPicker v-else-if="view === 'contacts'" />
    <MessageThread v-else />

    <WidgetToaster />
    <ConfirmDialog />
  </section>
</template>
