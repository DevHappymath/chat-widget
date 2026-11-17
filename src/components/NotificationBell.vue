<script setup lang="ts">
import { computed, ref } from "vue";
import { useChatStore } from "../core/store/useChatStore";
import { useNotifications } from "../core/store/useNotifications";
import { NotificationType, type ChatNotification } from "../types/notification";
import { formatRelativeTime } from "../utils/format";
import WidgetAvatar from "./WidgetAvatar.vue";
import WidgetIcon from "./WidgetIcon.vue";
import { vTooltip } from "../core/tooltip";

const { notifications, unreadCount, isLoading, markRead, markAllRead } = useNotifications();
const { revealMessage, selectConversation, avatarOf } = useChatStore();

const isOpen = ref(false);

const badgeLabel = computed(() => (unreadCount.value > 9 ? "9+" : String(unreadCount.value)));

const VERBS: Record<NotificationType, string> = {
  [NotificationType.Mention]: "đã nhắc tên bạn",
  [NotificationType.Reply]: "đã trả lời tin nhắn của bạn",
};

const titleOf = (notification: ChatNotification) =>
  `${notification.actorName || "Ai đó"} ${VERBS[notification.type] ?? VERBS[NotificationType.Mention]}`;

const onOpen = async (notification: ChatNotification) => {
  isOpen.value = false;
  void markRead(notification);

  // Tin được nhắc có thể cũ hơn phần lịch sử tải lúc mở hội thoại, nên phải nạp đúng đoạn quanh nó.
  if (notification.messageId) await revealMessage(notification.conversationId, notification.messageId);
  else await selectConversation(notification.conversationId);
};
</script>

<template>
  <button
    type="button"
    class="relative inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white/90 transition-colors hover:bg-white/15 hover:text-white"
    :class="isOpen && 'bg-white/15 text-white'"
    aria-label="Thông báo"
    :aria-expanded="isOpen"
    aria-haspopup="dialog"
    v-tooltip="'Thông báo'"
    @click="isOpen = !isOpen"
  >
    <WidgetIcon name="Bell" :size="17" />
    <span
      v-if="unreadCount"
      class="absolute -right-0.5 -top-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold tabular-nums text-white ring-2 ring-chat-accent-strong"
    >
      {{ badgeLabel }}
    </span>
  </button>

  <template v-if="isOpen">
    <div class="absolute inset-0 z-20" @click="isOpen = false" />

    <div
      class="absolute inset-x-2 top-14 z-30 overflow-hidden rounded-xl border border-gray-200 bg-white text-gray-900 shadow-2xl"
      role="dialog"
      aria-label="Thông báo"
      @keydown.esc="isOpen = false"
    >
      <div class="flex items-center justify-between border-b border-gray-100 px-3 py-2.5">
        <p class="text-sm font-semibold">Thông báo</p>
        <button
          v-if="unreadCount"
          type="button"
          class="text-xs font-medium text-chat-accent-strong transition-colors hover:underline"
          @click="markAllRead"
        >
          Đánh dấu đã đọc hết
        </button>
      </div>

      <div v-if="isLoading && !notifications.length" class="space-y-3 px-3 py-3">
        <div v-for="index in 3" :key="index" class="flex animate-pulse gap-2.5">
          <span class="h-9 w-9 shrink-0 rounded-full bg-gray-100" />
          <span class="flex-1 space-y-2 pt-0.5">
            <span class="block h-3 w-2/3 rounded-full bg-gray-100" />
            <span class="block h-3 w-full rounded-full bg-gray-50" />
          </span>
        </div>
      </div>

      <ul v-else-if="notifications.length" class="gdtd-chat-scroll max-h-80 overflow-y-auto">
        <li v-for="notification in notifications" :key="notification.id">
          <button
            type="button"
            class="flex w-full gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-gray-50"
            @click="onOpen(notification)"
          >
            <WidgetAvatar
              :name="notification.actorName || 'Ai đó'"
              :src="avatarOf(notification.actorUserId)"
              size="sm"
            />

            <span class="min-w-0 flex-1">
              <span
                class="block truncate text-[13px]"
                :class="notification.isRead ? 'font-medium text-gray-600' : 'font-semibold text-gray-900'"
              >
                {{ titleOf(notification) }}
              </span>
              <span class="mt-0.5 block truncate text-xs text-gray-600">
                {{ notification.messagePreview || "Tin nhắn" }}
              </span>
              <span class="mt-0.5 block truncate text-[11px] text-gray-500">
                {{ notification.conversationName || "Hội thoại" }} ·
                {{ formatRelativeTime(notification.createdAtUtc) }}
              </span>
            </span>

            <span
              v-if="!notification.isRead"
              class="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-chat-accent-strong"
              aria-label="Chưa đọc"
            />
          </button>
        </li>
      </ul>

      <div v-else class="flex flex-col items-center gap-1.5 px-5 py-8 text-center">
        <WidgetIcon name="BellOff" :size="20" class="text-gray-400" />
        <p class="text-sm font-medium text-gray-800">Chưa có thông báo</p>
        <p class="max-w-56 text-xs text-gray-500">
          Bạn sẽ nhận được thông báo khi có người nhắc tên hoặc trả lời tin nhắn của mình.
        </p>
      </div>
    </div>
  </template>
</template>
