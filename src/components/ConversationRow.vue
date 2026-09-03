<script setup lang="ts">
import { computed } from "vue";
import { useChatStore } from "../core/store/useChatStore";
import type { ChatConversation } from "../types/chat";
import { chatListTimestamp, messagePreview } from "../utils/chat";
import WidgetAvatar from "./WidgetAvatar.vue";
import WidgetIcon from "./WidgetIcon.vue";

const props = defineProps<{ conversation: ChatConversation }>();
defineEmits<{ select: [id: string] }>();

const { currentUserId, isGroup, partnerOf, titleOf, isOnline, typingUserIdsOf, togglePin } =
  useChatStore();

const partner = computed(() => partnerOf(props.conversation));
const group = computed(() => isGroup(props.conversation));
const isUnread = computed(() => props.conversation.unreadCount > 0);
const isTyping = computed(() => typingUserIdsOf(props.conversation.id).length > 0);

// Trong nhóm phải nói rõ ai vừa nhắn, hội thoại 1-1 thì thừa vì chỉ có hai người.
const preview = computed(() => {
  const last = props.conversation.lastMessage;
  const body = messagePreview(last);
  if (!last) return body;

  if (last.senderId.toLowerCase() === currentUserId.value) return `Bạn: ${body}`;
  if (!group.value) return body;

  const shortName = last.senderName?.split(" ").at(-1) ?? "Ai đó";
  return `${shortName}: ${body}`;
});

const timestamp = computed(
  () => props.conversation.lastMessageAtUtc ?? props.conversation.createdAtUtc,
);
</script>

<template>
  <div class="group flex items-center border-b border-gray-50 transition-colors hover:bg-gray-50">
    <button
      type="button"
      class="flex min-w-0 flex-1 items-center gap-3 py-3 pl-4 pr-2 text-left"
      @click="$emit('select', conversation.id)"
    >
      <WidgetAvatar
        :name="titleOf(conversation)"
        :variant="group ? 'group' : 'user'"
        :src="conversation.avatarUrl"
        :is-online="isOnline(partner?.userId)"
        :show-presence="!group"
        size="md"
      />

      <span class="min-w-0 flex-1">
        <span class="flex items-center gap-1.5">
          <span
            class="truncate text-sm"
            :class="isUnread ? 'font-bold text-gray-900' : 'font-semibold text-gray-800'"
          >
            {{ titleOf(conversation) }}
          </span>
          <WidgetIcon
            v-if="conversation.isMuted"
            name="BellOff"
            :size="12"
            class="shrink-0 text-gray-400"
          />
        </span>

        <span
          v-if="isTyping"
          class="mt-0.5 block truncate text-xs font-medium text-chat-accent-strong"
        >
          Đang soạn tin...
        </span>
        <span
          v-else
          class="mt-0.5 block truncate text-xs"
          :class="isUnread ? 'font-semibold text-gray-700' : 'text-gray-500'"
        >
          {{ preview }}
        </span>
      </span>
    </button>

    <div class="flex shrink-0 flex-col items-end gap-1.5 py-3 pr-3">
      <span class="whitespace-nowrap text-[11px] text-gray-500">
        {{ chatListTimestamp(timestamp) }}
      </span>

      <span
        v-if="isUnread"
        class="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-chat-accent-strong px-1.5 text-[11px] font-bold tabular-nums text-white"
      >
        {{ conversation.unreadCount }}
      </span>
      <button
        v-else
        type="button"
        class="inline-flex h-5 w-5 items-center justify-center rounded-md transition-colors"
        :class="
          conversation.isPinned
            ? 'text-amber-500 hover:text-amber-600'
            : 'text-gray-300 opacity-0 hover:text-gray-500 focus-visible:opacity-100 group-hover:opacity-100 chat-touch:opacity-100'
        "
        :aria-label="conversation.isPinned ? 'Bỏ ghim hội thoại' : 'Ghim hội thoại'"
        :title="conversation.isPinned ? 'Bỏ ghim hội thoại' : 'Ghim hội thoại'"
        @click="togglePin(conversation.id)"
      >
        <WidgetIcon
          name="Star"
          :size="15"
          :class="conversation.isPinned && 'fill-current'"
        />
      </button>
    </div>
  </div>
</template>
