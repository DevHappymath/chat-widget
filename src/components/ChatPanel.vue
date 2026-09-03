<script setup lang="ts">
import { computed } from "vue";
import { useChatStore, type WidgetView } from "../core/store/useChatStore";
import AddMembersScreen from "./AddMembersScreen.vue";
import ConfirmDialog from "./ConfirmDialog.vue";
import ContactPicker from "./ContactPicker.vue";
import ConversationInfoScreen from "./ConversationInfoScreen.vue";
import ConversationList from "./ConversationList.vue";
import MessageThread from "./MessageThread.vue";
import NewGroupScreen from "./NewGroupScreen.vue";
import WidgetIcon from "./WidgetIcon.vue";
import WidgetToaster from "./WidgetToaster.vue";

const { view, currentUserName, activeConversation, isGroup, closePanel, goBack } =
  useChatStore();

const HEADINGS: Record<WidgetView, string> = {
  list: "Đoạn chat",
  contacts: "Tin nhắn mới",
  "new-group": "Tạo nhóm mới",
  thread: "Đoạn chat",
  info: "Thông tin",
  "add-members": "Thêm thành viên",
};

const heading = computed(() => HEADINGS[view.value]);
const showBack = computed(() => view.value !== "list");

const subheading = computed(() => {
  if (view.value === "list") return currentUserName.value;
  if (!activeConversation.value) return "";

  return isGroup(activeConversation.value) ? "Nhóm" : "Hội thoại riêng";
});
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
        aria-label="Quay lại"
        @click="goBack"
      >
        <WidgetIcon name="ArrowLeft" :size="18" />
      </button>

      <div class="min-w-0 flex-1">
        <p class="truncate text-sm font-bold">{{ heading }}</p>
        <p v-if="subheading" class="truncate text-[11px] text-white/75">{{ subheading }}</p>
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
    <NewGroupScreen v-else-if="view === 'new-group'" />
    <ConversationInfoScreen v-else-if="view === 'info'" />
    <AddMembersScreen v-else-if="view === 'add-members'" />
    <MessageThread v-else />

    <WidgetToaster />
    <ConfirmDialog />
  </section>
</template>
