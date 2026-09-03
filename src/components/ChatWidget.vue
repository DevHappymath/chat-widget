<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted } from "vue";
import { configureChatWidget, type ChatWidgetConfig } from "../core/config";
import { useChatStore } from "../core/store/useChatStore";
import ChatPanel from "./ChatPanel.vue";
import MessageActionSheet from "./MessageActionSheet.vue";
import WidgetIcon from "./WidgetIcon.vue";

const props = defineProps<{ config: ChatWidgetConfig }>();

// Phải cấu hình ngay trong setup của component gốc: component con dựng axios và hub từ cấu
// hình này, mà setup của chúng chạy sau setup này.
configureChatWidget(props.config);

const {
  canUseChat,
  isPanelOpen,
  badgeCount,
  init,
  togglePanel,
  closePanel,
  refreshBadge,
} = useChatStore();

const isLeft = computed(() => props.config.position === "bottom-left");

/** Toạ độ đi qua biến CSS để lớp Tailwind chỉ đổi ở breakpoint mà không phải dựng class động. */
const anchorVars = computed(() => {
  const offset = props.config.offset ?? { x: 24, y: 24 };
  return {
    "--gdtd-chat-x": `${offset.x}px`,
    "--gdtd-chat-y": `${offset.y}px`,
    zIndex: props.config.zIndex ?? 2147483000,
  };
});

const bubbleClass = computed(() =>
  isLeft.value
    ? "bottom-[var(--gdtd-chat-y)] left-[var(--gdtd-chat-x)]"
    : "bottom-[var(--gdtd-chat-y)] right-[var(--gdtd-chat-x)]",
);

// Panel nằm trên bong bóng: cộng thêm chiều cao bong bóng (3.5rem) và một khoảng hở.
const panelClass = computed(() =>
  isLeft.value
    ? "sm:bottom-[calc(var(--gdtd-chat-y)+4.25rem)] sm:left-[var(--gdtd-chat-x)]"
    : "sm:bottom-[calc(var(--gdtd-chat-y)+4.25rem)] sm:right-[var(--gdtd-chat-x)]",
);

const badgeLabel = computed(() => (badgeCount.value > 99 ? "99+" : `${badgeCount.value}`));

const onKeydown = (event: KeyboardEvent) => {
  if (event.key === "Escape" && isPanelOpen.value) closePanel();
};

// Tab ngủ dậy có thể đã lỡ vài event, nắn lại số trên bong bóng thay vì tin vào bộ đếm cũ.
const onVisibilityChange = () => {
  if (document.visibilityState === "visible") refreshBadge();
};

onMounted(() => {
  init();
  window.addEventListener("keydown", onKeydown);
  document.addEventListener("visibilitychange", onVisibilityChange);
});

onBeforeUnmount(() => {
  window.removeEventListener("keydown", onKeydown);
  document.removeEventListener("visibilitychange", onVisibilityChange);
});
</script>

<template>
  <Teleport to="body">
    <!-- Người không phải nhân sự nhận canUseChat = false và không thấy gì cả. -->
    <div
      v-if="canUseChat"
      class="gdtd-chat-root pointer-events-none fixed inset-0"
      :style="anchorVars"
    >
      <Transition
        enter-active-class="transition duration-200 ease-out"
        enter-from-class="translate-y-3 opacity-0"
        leave-active-class="transition duration-150 ease-in"
        leave-to-class="translate-y-3 opacity-0"
      >
        <div
          v-if="isPanelOpen"
          class="pointer-events-auto absolute inset-0 sm:inset-auto sm:h-[620px] sm:max-h-[calc(100dvh-10rem)] sm:w-[380px]"
          :class="panelClass"
        >
          <ChatPanel />
        </div>
      </Transition>

      <button
        type="button"
        class="pointer-events-auto absolute inline-flex h-14 w-14 items-center justify-center rounded-full bg-chat-accent-strong text-white shadow-lg transition-transform hover:brightness-110 active:scale-95"
        :class="[bubbleClass, isPanelOpen && 'max-sm:hidden']"
        :aria-label="isPanelOpen ? 'Đóng khung chat' : 'Mở khung chat'"
        :aria-expanded="isPanelOpen"
        @click="togglePanel"
      >
        <WidgetIcon :name="isPanelOpen ? 'ChevronDown' : 'MessageCircle'" :size="24" />

        <span
          v-if="badgeCount > 0 && !isPanelOpen"
          class="absolute -right-0.5 -top-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1.5 text-[11px] font-bold tabular-nums text-white ring-2 ring-white"
          :aria-label="`${badgeCount} hội thoại chưa đọc`"
        >
          {{ badgeLabel }}
        </span>
      </button>
    </div>
  </Teleport>

  <MessageActionSheet v-if="canUseChat" />
</template>
