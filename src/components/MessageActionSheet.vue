<script setup lang="ts">
import { computed } from "vue";
import { REACTION_EMOJIS } from "../constants/reaction";
import { useChatStore } from "../core/store/useChatStore";
import { useWidgetConfirm } from "../core/store/useWidgetConfirm";
import { useWidgetToast } from "../core/store/useWidgetToast";
import { useIsWideViewport } from "../core/viewport";
import WidgetIcon from "./WidgetIcon.vue";

const {
  actionSheetMessage,
  actionSheetAnchor,
  closeMessageActions,
  canEditMessage,
  canDeleteMessage,
  isOwnMessage,
  startReply,
  startEditMessage,
  toggleReaction,
  myReactionOf,
  deleteMessage,
} = useChatStore();

const { ask } = useWidgetConfirm();
const toast = useWidgetToast();

/**
 * Bảng thao tác có hai hình dạng: popover neo vào tin nhắn ở màn hình lớn, bottom sheet ở
 * cảm ứng. Trải bottom sheet ngang cả trang desktop trong khi widget chỉ rộng 380px là sai.
 */
const isWide = useIsWideViewport();

const EDGE_PADDING = 8;
const POPOVER_WIDTH = 224;
/** Hàng biểu tượng cộng đường kẻ; phần còn lại tính theo số hành động. */
const POPOVER_HEADER_HEIGHT = 45;
const ACTION_ROW_HEIGHT = 34;
/** Bề rộng ước lượng của thanh biểu tượng nổi ở cảm ứng. */
const REACTION_BAR_WIDTH = 264;

interface SheetAction {
  key: string;
  label: string;
  icon: string;
  danger?: boolean;
  run: () => void | Promise<void>;
}

const actions = computed<SheetAction[]>(() => {
  const message = actionSheetMessage.value;
  if (!message) return [];

  const items: SheetAction[] = [
    {
      key: "reply",
      label: "Trả lời",
      icon: "CornerUpLeft",
      run: () => startReply(message),
    },
  ];

  if (message.content?.trim()) {
    items.push({
      key: "copy",
      label: "Sao chép nội dung",
      icon: "Copy",
      run: async () => {
        await navigator.clipboard.writeText(message.content!);
        toast.success("Đã sao chép nội dung tin nhắn");
      },
    });
  }

  if (canEditMessage(message)) {
    items.push({
      key: "edit",
      label: "Sửa tin nhắn",
      icon: "Pencil",
      run: () => startEditMessage(message),
    });
  }

  if (canDeleteMessage(message)) {
    const own = isOwnMessage(message);

    items.push({
      key: "delete",
      label: own ? "Thu hồi tin nhắn" : "Xoá tin nhắn",
      icon: own ? "Undo2" : "Trash2",
      danger: true,
      run: async () => {
        const agreed = await ask({
          title: own ? "Thu hồi tin nhắn" : "Xoá tin nhắn",
          message: own
            ? "Thu hồi tin nhắn này? Mọi người trong hội thoại sẽ không đọc được nội dung nữa."
            : "Xoá tin nhắn này khỏi nhóm? Thành viên sẽ chỉ thấy dòng báo tin đã bị thu hồi.",
          confirmText: own ? "Thu hồi" : "Xoá",
          danger: true,
        });

        if (agreed) await deleteMessage(message.id);
      },
    });
  }

  return items;
});

const canReact = computed(() =>
  Boolean(actionSheetMessage.value && !actionSheetMessage.value.isDeleted),
);

/** Popover mở lên trên nút vừa bấm; không đủ chỗ thì lật xuống dưới. */
const popoverStyle = computed(() => {
  const anchor = actionSheetAnchor.value;
  if (!anchor) return {};

  const height =
    (canReact.value ? POPOVER_HEADER_HEIGHT : 0) +
    actions.value.length * ACTION_ROW_HEIGHT +
    EDGE_PADDING;

  const left = Math.min(
    Math.max(anchor.x - POPOVER_WIDTH / 2, EDGE_PADDING),
    window.innerWidth - POPOVER_WIDTH - EDGE_PADDING,
  );

  const above = anchor.y - height - 10;
  const top = above < EDGE_PADDING ? anchor.y + 26 : above;

  return { left: `${left}px`, top: `${top}px`, width: `${POPOVER_WIDTH}px` };
});

const reactionBarStyle = computed(() => {
  const anchor = actionSheetAnchor.value;
  if (!anchor) return {};

  const half = REACTION_BAR_WIDTH / 2;
  const maxLeft = window.innerWidth - half - EDGE_PADDING;
  const left = Math.min(Math.max(anchor.x, half + EDGE_PADDING), maxLeft);

  // Đẩy lên trên ngón tay để không bị chính bàn tay che mất.
  return { left: `${left}px`, top: `${Math.max(anchor.y - 64, 72)}px` };
});

const onPickEmoji = (emoji: string) => {
  const message = actionSheetMessage.value;
  if (!message) return;

  closeMessageActions();
  toggleReaction(message, emoji);
};

const onRun = async (action: SheetAction) => {
  closeMessageActions();
  await action.run();
};
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition duration-150 ease-out"
      enter-from-class="opacity-0"
      leave-active-class="transition duration-150 ease-in"
      leave-to-class="opacity-0"
    >
      <div
        v-if="actionSheetMessage"
        class="gdtd-chat-root fixed inset-0 z-[2147483100]"
        role="dialog"
        aria-modal="true"
      >
        <div
          class="absolute inset-0"
          :class="isWide ? 'bg-transparent' : 'bg-gray-900/40'"
          @click="closeMessageActions"
        />

        <!-- Màn hình lớn: một thẻ duy nhất gồm hàng biểu tượng và danh sách thao tác. -->
        <div
          v-if="isWide"
          class="absolute overflow-hidden rounded-xl border border-gray-200 bg-white py-1 shadow-xl"
          :style="popoverStyle"
        >
          <div v-if="canReact" class="flex justify-between border-b border-gray-100 px-1.5 pb-1.5 pt-0.5">
            <button
              v-for="emoji in REACTION_EMOJIS"
              :key="emoji"
              type="button"
              class="inline-flex h-8 w-8 items-center justify-center rounded-full text-base transition-transform hover:scale-115 hover:bg-gray-50"
              :class="myReactionOf(actionSheetMessage) === emoji && 'bg-chat-accent/10'"
              :aria-label="`Thả ${emoji}`"
              @click="onPickEmoji(emoji)"
            >
              {{ emoji }}
            </button>
          </div>

          <ul class="pt-1">
            <li v-for="action in actions" :key="action.key">
              <button
                type="button"
                class="flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors hover:bg-gray-50"
                :class="action.danger ? 'text-red-600' : 'text-gray-800'"
                @click="onRun(action)"
              >
                <WidgetIcon :name="action.icon" :size="15" />
                <span class="text-xs font-medium">{{ action.label }}</span>
              </button>
            </li>
          </ul>
        </div>

        <!-- Cảm ứng: thanh biểu tượng nổi ngay chỗ vừa ấn giữ, thao tác nằm ở bottom sheet. -->
        <template v-else>
          <div
            v-if="canReact"
            class="absolute flex -translate-x-1/2 gap-0.5 rounded-full border border-gray-100 bg-white px-2 py-1.5 shadow-xl"
            :style="reactionBarStyle"
          >
            <button
              v-for="emoji in REACTION_EMOJIS"
              :key="emoji"
              type="button"
              class="inline-flex h-9 w-9 items-center justify-center rounded-full text-lg transition-transform active:scale-90"
              :class="myReactionOf(actionSheetMessage) === emoji && 'bg-chat-accent/10'"
              :aria-label="`Thả ${emoji}`"
              @click="onPickEmoji(emoji)"
            >
              {{ emoji }}
            </button>
          </div>

          <div
            class="absolute inset-x-0 bottom-0 rounded-t-2xl bg-white pb-[env(safe-area-inset-bottom)] shadow-2xl"
          >
            <div class="flex justify-center py-2">
              <span class="h-1 w-10 rounded-full bg-gray-200" />
            </div>

            <ul class="pb-2">
              <li v-for="action in actions" :key="action.key">
                <button
                  type="button"
                  class="flex w-full items-center gap-3 px-5 py-3.5 text-left transition-colors active:bg-gray-50"
                  :class="action.danger ? 'text-red-600' : 'text-gray-800'"
                  @click="onRun(action)"
                >
                  <WidgetIcon :name="action.icon" :size="18" />
                  <span class="text-sm font-medium">{{ action.label }}</span>
                </button>
              </li>
            </ul>

            <div class="border-t border-gray-100 p-3">
              <button
                type="button"
                class="w-full rounded-xl bg-gray-100 py-3 text-sm font-semibold text-gray-700 transition-colors active:bg-gray-200"
                @click="closeMessageActions"
              >
                Huỷ
              </button>
            </div>
          </div>
        </template>
      </div>
    </Transition>
  </Teleport>
</template>
