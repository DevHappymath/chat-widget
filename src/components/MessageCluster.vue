<script setup lang="ts">
import { computed } from "vue";
import { useChatStore } from "../core/store/useChatStore";
import type { ChatMessage } from "../types/chat";
import type { MessageCluster } from "../utils/chat";
import { splitMentions } from "../utils/chat";
import { formatBytes, formatDateISO, formatDateTime, formatTime } from "../utils/format";
import WidgetAvatar from "./WidgetAvatar.vue";
import WidgetIcon from "./WidgetIcon.vue";

const props = defineProps<{
  cluster: MessageCluster;
  /** Nhóm mới cần in tên người gửi, hội thoại 1-1 thì thừa. */
  showSenderName: boolean;
  /** Cụm cuối của mình mới hiện trạng thái gửi, tránh lặp nhãn ở mọi bong bóng. */
  showStatus: boolean;
}>();

const {
  activeConversation,
  pendingClientIds,
  failedClientIds,
  editingMessageId,
  editingContent,
  membersOf,
  cancelEditMessage,
  saveEditMessage,
  jumpToMessage,
  highlightedMessageId,
  toggleReaction,
  myReactionOf,
  openMessageActions,
} = useChatStore();

/** Đủ lâu để phân biệt với chạm thường, đủ ngắn để không thấy máy bị đơ. */
const LONG_PRESS_MS = 450;
/** Nhích quá chừng này coi như đang vuốt để cuộn, không phải ấn giữ. */
const MOVE_TOLERANCE_PX = 10;

let pressTimer: ReturnType<typeof setTimeout> | null = null;
let pressStart: { x: number; y: number } | null = null;
let didLongPress = false;

const cancelPress = () => {
  if (pressTimer) clearTimeout(pressTimer);
  pressTimer = null;
  pressStart = null;
};

const onTouchStart = (event: TouchEvent, message: ChatMessage) => {
  const touch = event.touches[0];
  if (!touch) return;

  pressStart = { x: touch.clientX, y: touch.clientY };
  didLongPress = false;

  pressTimer = setTimeout(() => {
    didLongPress = true;
    openMessageActions(message, pressStart ?? { x: touch.clientX, y: touch.clientY });
  }, LONG_PRESS_MS);
};

const onTouchMove = (event: TouchEvent) => {
  const touch = event.touches[0];
  if (!pressStart || !touch) return;

  if (
    Math.abs(touch.clientX - pressStart.x) > MOVE_TOLERANCE_PX ||
    Math.abs(touch.clientY - pressStart.y) > MOVE_TOLERANCE_PX
  ) {
    cancelPress();
  }
};

// Nhả tay sau khi ấn giữ vẫn sinh click, chặn lại để không mở nhầm tệp hay khối trích dẫn.
const onClickCapture = (event: MouseEvent) => {
  if (!didLongPress) return;

  event.preventDefault();
  event.stopPropagation();
  didLongPress = false;
};

const openActionsFromButton = (event: MouseEvent, message: ChatMessage) => {
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
  openMessageActions(message, { x: rect.left + rect.width / 2, y: rect.top });
};

const lastMessage = computed(() => props.cluster.messages.at(-1)!);

/**
 * Backend không theo dõi đã nhận hay đã xem ở mức tin nhắn, chỉ biết tin đã lưu hay chưa,
 * nên chỉ có ba trạng thái.
 */
const status = computed(() => {
  const clientId = lastMessage.value.clientMessageId;

  if (failedClientIds.value.includes(clientId)) {
    return { icon: "TriangleAlert", label: "Gửi lỗi", class: "text-red-600" };
  }
  if (pendingClientIds.value.includes(clientId)) {
    return { icon: "Clock", label: "Đang gửi", class: "text-gray-500" };
  }
  return { icon: "Check", label: "Đã gửi", class: "text-chat-accent-strong" };
});

const participants = computed(() =>
  activeConversation.value ? membersOf(activeConversation.value) : [],
);

const nameOfUser = (userId: string) => {
  const participant = participants.value.find(
    (p) => p.userId.toLowerCase() === userId.toLowerCase(),
  );
  return participant?.fullName || participant?.email || "Người dùng";
};

/** Backend chỉ lưu userId của người được nhắc, tên phải tra ngược từ danh sách thành viên. */
const contentSegments = (message: ChatMessage) =>
  splitMentions(message.content ?? "", message.mentionedUserIds.map(nameOfUser));

const reactionTooltip = (userIds: string[]) => userIds.map(nameOfUser).join(", ");

/** Sửa trong ngày thì chỉ cần giờ; sửa sang ngày khác phải kèm ngày mới hiểu đúng. */
const editedAtLabel = (message: ChatMessage) => {
  const editedAt = message.editedAtUtc;
  if (!editedAt) return "";

  return formatDateISO(editedAt) === formatDateISO(message.createdAtUtc)
    ? formatTime(editedAt)
    : formatDateTime(editedAt);
};

const canOpenActions = (message: ChatMessage) =>
  !message.isDeleted &&
  !pendingClientIds.value.includes(message.clientMessageId) &&
  !failedClientIds.value.includes(message.clientMessageId);

const onEditKeydown = (event: KeyboardEvent) => {
  if (event.key === "Escape") {
    cancelEditMessage();
    return;
  }
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    saveEditMessage();
  }
};
</script>

<template>
  <div v-if="cluster.isSystem" class="py-1.5 text-center">
    <span class="text-[11px] text-gray-500">{{ lastMessage.content }}</span>
  </div>

  <div v-else class="flex gap-2">
    <!-- Avatar bám mép trên của cụm; tin của mình không cần vì đã lệch hẳn sang phải. -->
    <WidgetAvatar
      v-if="!cluster.isOwn"
      :name="cluster.senderName"
      size="xs"
      class="mt-0.5"
    />

    <div
      class="flex min-w-0 flex-1 flex-col gap-1"
      :class="cluster.isOwn ? 'items-end' : 'items-start'"
    >
      <p
        v-if="showSenderName && !cluster.isOwn"
        class="px-1 text-[11px] font-semibold text-gray-600"
      >
        {{ cluster.senderName }}
      </p>

      <div
        v-for="message in cluster.messages"
        :key="message.id"
        :data-gdtd-message-id="message.id"
        class="-mx-1 flex max-w-[88%] flex-col rounded-2xl px-1 py-0.5 transition-colors duration-500"
        :class="[
          cluster.isOwn && 'items-end',
          highlightedMessageId === message.id && 'bg-amber-100/70',
        ]"
      >
        <div
          class="group/msg relative flex max-w-full items-center gap-1"
          :class="cluster.isOwn && 'flex-row-reverse'"
        >
          <!-- Khung sửa thay chỗ bong bóng, giữ nguyên vị trí để không nhảy layout. -->
          <div
            v-if="editingMessageId === message.id"
            class="w-full rounded-2xl border border-chat-accent/40 bg-white p-2 ring-4 ring-chat-accent/10"
          >
            <textarea
              v-model="editingContent"
              rows="2"
              autofocus
              class="w-full resize-none border-0 bg-transparent px-2 py-1 text-sm text-gray-900 outline-none"
              @keydown="onEditKeydown"
            />
            <div class="mt-1 flex items-center justify-end gap-2">
              <button
                type="button"
                class="rounded-lg px-3 py-1.5 text-xs font-semibold text-gray-600 transition-colors hover:bg-gray-100"
                @click="cancelEditMessage"
              >
                Huỷ
              </button>
              <button
                type="button"
                class="rounded-lg bg-chat-accent-strong px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:brightness-110 disabled:opacity-50"
                :disabled="!editingContent.trim()"
                @click="saveEditMessage"
              >
                Lưu
              </button>
            </div>
          </div>

          <template v-else>
            <div
              class="w-fit max-w-full rounded-2xl px-3 py-2 text-sm leading-relaxed wrap-break-word chat-touch:select-none"
              :class="
                message.isDeleted
                  ? 'border border-dashed border-gray-200 bg-white italic text-gray-600'
                  : cluster.isOwn
                    ? 'border border-gray-200 bg-white text-gray-900'
                    : 'bg-chat-accent/10 text-gray-900'
              "
              @touchstart.passive="onTouchStart($event, message)"
              @touchmove.passive="onTouchMove"
              @touchend="cancelPress"
              @touchcancel="cancelPress"
              @click.capture="onClickCapture"
              @contextmenu.prevent
            >
              <p v-if="message.isDeleted" :title="`Thu hồi lúc ${formatDateTime(message.deletedAtUtc || '')}`">
                Tin nhắn đã bị thu hồi
              </p>

              <template v-else>
                <button
                  v-if="message.replyTo"
                  type="button"
                  class="mb-1.5 flex w-full items-stretch gap-2 rounded-xl bg-gray-900/5 p-2 text-left transition-colors hover:bg-gray-900/10"
                  @click="jumpToMessage(message.replyTo.id)"
                >
                  <span class="w-0.5 shrink-0 rounded-full bg-chat-accent" />
                  <span class="min-w-0 flex-1">
                    <span
                      class="flex items-center gap-1 text-[11px] font-semibold text-chat-accent-strong"
                    >
                      <WidgetIcon name="CornerUpLeft" :size="11" />
                      {{ message.replyTo.senderName }}
                    </span>
                    <span class="mt-0.5 block truncate text-[11px] text-gray-600">
                      {{
                        message.replyTo.isDeleted
                          ? "Tin nhắn đã bị thu hồi"
                          : message.replyTo.content
                      }}
                    </span>
                  </span>
                </button>

                <p v-if="message.content">
                  <span
                    v-for="(segment, index) in contentSegments(message)"
                    :key="index"
                    :class="
                      segment.isMention &&
                      'bg-chat-accent/15 px-1 font-semibold text-chat-accent-strong'
                    "
                    >{{ segment.text }}</span
                  >
                </p>

                <template v-for="file in message.attachments" :key="file.id">
                  <a
                    v-if="file.contentType.startsWith('image/')"
                    :href="file.fileUrl"
                    target="_blank"
                    rel="noopener"
                    class="mt-1.5 block overflow-hidden rounded-xl"
                  >
                    <img
                      :src="file.fileUrl"
                      :alt="file.fileName"
                      loading="lazy"
                      class="max-h-52 w-auto rounded-xl object-cover"
                    />
                  </a>

                  <a
                    v-else
                    :href="file.fileUrl"
                    target="_blank"
                    rel="noopener"
                    class="mt-1.5 flex items-center gap-2.5 rounded-xl bg-white px-2.5 py-2 ring-1 ring-gray-200 transition-colors hover:bg-gray-50"
                  >
                    <WidgetIcon
                      name="FileText"
                      :size="18"
                      class="text-chat-accent-strong"
                    />
                    <span class="min-w-0">
                      <span class="block truncate text-xs font-semibold text-gray-800">
                        {{ file.fileName }}
                      </span>
                      <span class="block text-[11px] text-gray-600">
                        {{ formatBytes(file.sizeBytes, 0) }}
                      </span>
                    </span>
                  </a>
                </template>
              </template>
            </div>

            <!-- Panel hẹp nên mọi thao tác gom vào một bảng, dùng chung với ấn giữ ở cảm ứng. -->
            <button
              v-if="canOpenActions(message)"
              type="button"
              class="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-gray-500 opacity-0 transition-opacity hover:bg-gray-100 hover:text-gray-800 focus-visible:opacity-100 group-hover/msg:opacity-100"
              aria-label="Thao tác với tin nhắn"
              @click="openActionsFromButton($event, message)"
            >
              <WidgetIcon name="MoreHorizontal" :size="15" />
            </button>
          </template>
        </div>

        <ul
          v-if="message.reactions.length"
          class="mt-1 flex flex-wrap gap-1"
          :class="cluster.isOwn && 'justify-end'"
        >
          <li v-for="reaction in message.reactions" :key="reaction.emoji">
            <button
              type="button"
              class="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] transition-colors"
              :class="
                myReactionOf(message) === reaction.emoji
                  ? 'border-chat-accent/40 bg-chat-accent/10 text-chat-accent-strong'
                  : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
              "
              :title="reactionTooltip(reaction.userIds)"
              @click="toggleReaction(message, reaction.emoji)"
            >
              <span>{{ reaction.emoji }}</span>
              <span class="tabular-nums">{{ reaction.count }}</span>
            </button>
          </li>
        </ul>

        <p
          v-if="message.editedAtUtc && !message.isDeleted"
          class="mt-0.5 flex items-center gap-1 px-1 text-[11px] text-gray-500"
          :title="formatDateTime(message.editedAtUtc)"
        >
          <WidgetIcon name="Pencil" :size="10" />
          Đã chỉnh sửa {{ editedAtLabel(message) }}
        </p>
      </div>

      <!-- Cả cụm chỉ hiện một mốc giờ, lấy theo tin cuối cùng trong cụm. -->
      <p
        class="flex items-center gap-1 px-1 text-[11px] text-gray-500"
        :title="formatDateTime(lastMessage.createdAtUtc)"
      >
        {{ formatTime(lastMessage.createdAtUtc) }}
        <WidgetIcon
          v-if="showStatus"
          :name="status.icon"
          :size="12"
          :class="status.class"
          :aria-label="status.label"
        />
      </p>
    </div>
  </div>
</template>
