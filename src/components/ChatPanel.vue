<script setup lang="ts">
import { computed, ref } from "vue";
import { ownPresenceLabel } from "../constants/presence";
import { useChatStore, type WidgetView } from "../core/store/useChatStore";
import AddMembersScreen from "./AddMembersScreen.vue";
import ConfirmDialog from "./ConfirmDialog.vue";
import ContactPicker from "./ContactPicker.vue";
import ConversationInfoScreen from "./ConversationInfoScreen.vue";
import ConversationList from "./ConversationList.vue";
import ForwardScreen from "./ForwardScreen.vue";
import JoinGroupScreen from "./JoinGroupScreen.vue";
import MediaScreen from "./MediaScreen.vue";
import MessageSearchScreen from "./MessageSearchScreen.vue";
import MessageThread from "./MessageThread.vue";
import NewGroupScreen from "./NewGroupScreen.vue";
import PresenceDot from "./PresenceDot.vue";
import PresenceMenu from "./PresenceMenu.vue";
import WidgetIcon from "./WidgetIcon.vue";
import WidgetToaster from "./WidgetToaster.vue";

const {
  view,
  currentUserName,
  activeConversation,
  isGroup,
  isStudent,
  myPresence,
  goBack,
  minimizeConversation,
  closeConversation,
} = useChatStore();

const HEADINGS: Record<WidgetView, string> = {
  list: "Đoạn chat",
  contacts: "Tin nhắn mới",
  "new-group": "Tạo nhóm mới",
  thread: "Đoạn chat",
  info: "Thông tin",
  "add-members": "Thêm thành viên",
  search: "Tìm tin nhắn",
  forward: "Chuyển tiếp",
  media: "Ảnh và tệp",
  join: "Tham gia nhóm",
};

// Danh bạ của học sinh chỉ gồm giáo viên phụ trách, gọi đúng tên cho họ khỏi tìm người khác.
const heading = computed(() =>
  view.value === "contacts" && isStudent.value ? "Giáo viên của bạn" : HEADINGS[view.value],
);
const showBack = computed(() => view.value !== "list");

const isPresenceMenuOpen = ref(false);

// Ở danh sách hội thoại, dòng phụ thành nút đặt trạng thái; server chưa hỗ trợ thì giữ tên như cũ.
const showPresenceTrigger = computed(() => view.value === "list" && Boolean(myPresence.value));

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
    aria-label="Khung chat"
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
        <button
          v-if="showPresenceTrigger && myPresence"
          type="button"
          class="-mx-1 flex max-w-full items-center gap-1.5 rounded-full px-1 text-[11px] text-white/85 transition-colors hover:bg-white/15 hover:text-white"
          :aria-expanded="isPresenceMenuOpen"
          aria-haspopup="dialog"
          :title="currentUserName"
          @click="isPresenceMenuOpen = !isPresenceMenuOpen"
        >
          <PresenceDot :status="myPresence.status" class="h-2 w-2 shrink-0 ring-1 ring-white/80" />
          <span class="truncate">
            {{ ownPresenceLabel(myPresence) }}<template v-if="myPresence.message"> · {{ myPresence.message }}</template>
          </span>
          <WidgetIcon name="ChevronDown" :size="12" class="shrink-0" />
        </button>
        <p v-else-if="subheading" class="truncate text-[11px] text-white/75">{{ subheading }}</p>
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
        v-if="view === 'thread' && activeConversation"
        type="button"
        class="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white/90 transition-colors hover:bg-white/15 hover:text-white"
        aria-label="Thu nhỏ hội thoại"
        title="Thu nhỏ hội thoại"
        @click="minimizeConversation"
      >
        <WidgetIcon name="Minus" :size="18" />
      </button>

      <button
        type="button"
        class="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white/90 transition-colors hover:bg-white/15 hover:text-white"
        aria-label="Đóng khung chat"
        @click="closeConversation"
      >
        <WidgetIcon name="X" :size="18" />
      </button>
    </header>

    <template v-if="isPresenceMenuOpen && showPresenceTrigger">
      <div class="absolute inset-0 z-20" @click="isPresenceMenuOpen = false" />
      <PresenceMenu
        class="absolute left-3 top-14 z-30"
        @close="isPresenceMenuOpen = false"
        @keydown.esc="isPresenceMenuOpen = false"
      />
    </template>

    <ConversationList v-if="view === 'list'" />
    <ContactPicker v-else-if="view === 'contacts'" />
    <NewGroupScreen v-else-if="view === 'new-group'" />
    <ConversationInfoScreen v-else-if="view === 'info'" />
    <AddMembersScreen v-else-if="view === 'add-members'" />
    <MessageSearchScreen v-else-if="view === 'search'" />
    <ForwardScreen v-else-if="view === 'forward'" />
    <MediaScreen v-else-if="view === 'media'" />
    <JoinGroupScreen v-else-if="view === 'join'" />
    <MessageThread v-else />

    <WidgetToaster />
    <ConfirmDialog />
  </section>
</template>
