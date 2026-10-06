<script setup lang="ts">
import { computed } from "vue";
import { useChatStore } from "../core/store/useChatStore";
import { useMessageAlerts } from "../core/store/useMessageAlerts";
import WidgetAvatar from "./WidgetAvatar.vue";
import WidgetIcon from "./WidgetIcon.vue";

const props = defineProps<{ side: "left" | "right" }>();

const { openPanel, selectConversation } = useChatStore();
const { alerts, dismiss, pause, resume } = useMessageAlerts();

// Xếp ngay trên bong bóng (cao 3.5rem) và bám cùng mép với nó.
const anchorClass = computed(() =>
  props.side === "left"
    ? "bottom-[calc(var(--gdtd-chat-y)+4.25rem)] left-[var(--gdtd-chat-x)]"
    : "bottom-[calc(var(--gdtd-chat-y)+4.25rem)] right-[var(--gdtd-chat-x)]",
);

const open = async (conversationId: string) => {
  window.focus();
  await openPanel();
  await selectConversation(conversationId);
};
</script>

<template>
  <div
    class="absolute flex w-[min(22rem,calc(100vw-2*var(--gdtd-chat-x)))] flex-col-reverse gap-2"
    :class="anchorClass"
    role="region"
    aria-label="Tin nhắn mới"
    aria-live="polite"
  >
    <TransitionGroup
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="translate-y-2 opacity-0"
      leave-active-class="transition duration-150 ease-in"
      leave-to-class="opacity-0"
      move-class="transition-transform duration-200"
    >
      <div
        v-for="alert in alerts"
        :key="alert.conversationId"
        class="pointer-events-auto flex items-start gap-1 rounded-2xl bg-white p-3 pr-2 text-left shadow-xl ring-1 ring-gray-900/5"
        @mouseenter="pause(alert.conversationId)"
        @mouseleave="resume(alert.conversationId)"
      >
        <button
          type="button"
          class="flex min-w-0 flex-1 items-start gap-3 text-left"
          @click="open(alert.conversationId)"
        >
          <WidgetAvatar
            :name="alert.title"
            :variant="alert.isGroup ? 'group' : 'user'"
            :src="alert.avatarUrl"
            size="md"
          />

          <span class="min-w-0 flex-1 pt-0.5">
            <span class="block truncate text-sm font-semibold text-gray-900">
              {{ alert.title }}
            </span>
            <span class="mt-0.5 line-clamp-2 text-sm wrap-break-word text-gray-600">
              {{ alert.preview }}
            </span>
            <span
              v-if="alert.count > 1"
              class="mt-1 block text-xs font-medium text-chat-accent-strong"
            >
              {{ alert.count }} tin nhắn mới
            </span>
          </span>
        </button>

        <button
          type="button"
          class="shrink-0 rounded-full p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
          aria-label="Đóng thông báo"
          @click="dismiss(alert.conversationId)"
        >
          <WidgetIcon name="X" :size="16" />
        </button>
      </div>
    </TransitionGroup>
  </div>
</template>
