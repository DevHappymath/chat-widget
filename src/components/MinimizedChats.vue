<script setup lang="ts">
import { computed } from "vue";
import { useChatStore } from "../core/store/useChatStore";
import WidgetAvatar from "./WidgetAvatar.vue";
import WidgetIcon from "./WidgetIcon.vue";

const props = defineProps<{ side: "left" | "right" }>();

const {
  minimizedConversations,
  restoreMinimized,
  dismissMinimized,
  isGroup,
  isOnline,
  partnerOf,
  titleOf,
} = useChatStore();

// Xếp ngay trên bong bóng (3.5rem) và canh giữa theo nó: avatar rộng 2.75rem nên lùi vào 0.375rem.
const anchorClass = computed(() =>
  props.side === "left"
    ? "bottom-[calc(var(--gdtd-chat-y)+4.25rem)] left-[calc(var(--gdtd-chat-x)+0.375rem)]"
    : "bottom-[calc(var(--gdtd-chat-y)+4.25rem)] right-[calc(var(--gdtd-chat-x)+0.375rem)]",
);

const labelClass = computed(() =>
  props.side === "left" ? "left-full ml-2" : "right-full mr-2",
);

const dismissClass = computed(() =>
  props.side === "left" ? "-right-1 -top-1" : "-left-1 -top-1",
);

const unreadLabel = (count: number) => (count > 9 ? "9+" : `${count}`);
</script>

<template>
  <ul
    class="absolute flex flex-col-reverse gap-2"
    :class="anchorClass"
    aria-label="Hội thoại đã thu nhỏ"
  >
    <TransitionGroup
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="translate-y-2 scale-90 opacity-0"
      leave-active-class="transition duration-150 ease-in"
      leave-to-class="scale-90 opacity-0"
      move-class="transition-transform duration-200"
    >
      <li
        v-for="conversation in minimizedConversations"
        :key="conversation.id"
        class="group pointer-events-auto relative"
      >
        <button
          type="button"
          class="block rounded-full transition-transform hover:scale-105 active:scale-95"
          :aria-label="`Mở lại hội thoại ${titleOf(conversation)}`"
          @click="restoreMinimized(conversation.id)"
        >
          <WidgetAvatar
            :name="titleOf(conversation)"
            :variant="isGroup(conversation) ? 'group' : 'user'"
            :src="conversation.avatarUrl"
            :is-online="isOnline(partnerOf(conversation)?.userId)"
            :show-presence="!isGroup(conversation)"
            size="md"
          />
        </button>

        <span
          v-if="conversation.unreadCount > 0"
          class="pointer-events-none absolute -right-1 -bottom-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[11px] font-bold tabular-nums text-white ring-2 ring-white"
          :aria-label="`${conversation.unreadCount} tin nhắn chưa đọc`"
        >
          {{ unreadLabel(conversation.unreadCount) }}
        </span>

        <span
          class="pointer-events-none absolute top-1/2 max-w-52 -translate-y-1/2 truncate whitespace-nowrap rounded-lg bg-gray-900 px-2.5 py-1.5 text-xs font-medium text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100"
          :class="labelClass"
        >
          {{ titleOf(conversation) }}
        </span>

        <button
          type="button"
          class="absolute inline-flex h-5 w-5 items-center justify-center rounded-full bg-white text-gray-600 opacity-0 shadow ring-1 ring-gray-900/10 transition-opacity hover:text-gray-900 focus-visible:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100"
          :class="dismissClass"
          :aria-label="`Bỏ hội thoại ${titleOf(conversation)} khỏi danh sách thu nhỏ`"
          @click="dismissMinimized(conversation.id)"
        >
          <WidgetIcon name="X" :size="12" />
        </button>
      </li>
    </TransitionGroup>
  </ul>
</template>
