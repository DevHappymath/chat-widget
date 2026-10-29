<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import { MAX_ATTACHMENTS_PER_MESSAGE } from "../constants/attachment";
import { useChatStore } from "../core/store/useChatStore";
import { PresenceStatus, type Sticker, type UploadedFile } from "../types/chat";
import { hasDraggedFiles } from "../utils/attachment";
import { groupChatMessages, presenceLabel } from "../utils/chat";
import { formatBytes } from "../utils/format";
import MessageCluster from "./MessageCluster.vue";
import MessageComposer from "./MessageComposer.vue";
import PresenceDot from "./PresenceDot.vue";
import PinnedBar from "./PinnedBar.vue";
import WidgetAvatar from "./WidgetAvatar.vue";
import WidgetIcon from "./WidgetIcon.vue";

const props = defineProps<{
  /** null là bản nháp với người vừa chọn ở danh bạ, chỉ có ở khung chính. */
  conversationId: string | null;
  /** Khung thứ hai không có màn tìm kiếm hay thông tin riêng, bấm vào thì đổi chỗ sang khung chính. */
  secondary?: boolean;
}>();

const {
  view,
  currentUserId,
  conversations,
  messagesOf,
  typingNamesOf,
  hasMoreOf,
  isLoadingMessagesOf,
  unreadMarkerOf,
  isAtBottom,
  setThreadAtBottom,
  takeRevealUnread,
  draft: storeDraft,
  isGroup,
  isOnline,
  statusOf,
  statusMessageOf,
  partnerOf,
  titleOf,
  membersOf,
  sendMessage,
  sendSticker,
  loadOlderMessages,
  markRead,
  isOwnMessage,
  notifyTyping,
  toggleMute,
  selectConversation,
  attachmentRule,
} = useChatStore();

const scroller = ref<HTMLElement | null>(null);
const composer = ref<InstanceType<typeof MessageComposer> | null>(null);

const conversationId = computed(() => props.conversationId);

const conversation = computed(() =>
  props.conversationId
    ? (conversations.value.find((c) => c.id === props.conversationId) ?? null)
    : null,
);

const draft = computed(() => (props.conversationId ? null : storeDraft.value));

const messages = computed(() => messagesOf(props.conversationId));
const hasMoreMessages = computed(() => hasMoreOf(props.conversationId));
const isLoadingMessages = computed(() => isLoadingMessagesOf(props.conversationId));
const isThreadAtBottom = computed(() => isAtBottom(props.conversationId));

const openScreen = async (screen: "search" | "info") => {
  if (props.secondary && props.conversationId) await selectConversation(props.conversationId);
  view.value = screen;
};

const send = (...args: [string, UploadedFile[], string[], boolean]) =>
  sendMessage(props.conversationId, ...args);

const onSendSticker = (sticker: Sticker) => sendSticker(props.conversationId, sticker);

const partner = computed(() =>
  conversation.value ? partnerOf(conversation.value) : undefined,
);

const group = computed(() =>
  conversation.value ? isGroup(conversation.value) : false,
);

/** Header dùng chung cho hội thoại thật và bản nháp, khác nhau ở nguồn tên và avatar. */
const headerTitle = computed(() =>
  conversation.value
    ? titleOf(conversation.value)
    : (draft.value?.fullName ?? ""),
);

const headerPartnerId = computed(() => partner.value?.userId ?? draft.value?.userId);

const subtitle = computed(() => {
  const current = conversation.value;

  if (!current) return draft.value ? "Hội thoại mới, chưa gửi tin nào" : "";

  if (group.value) {
    const members = membersOf(current);
    const online = members.filter((m) => isOnline(m.userId)).length;
    return `${members.length} thành viên · ${online} đang hoạt động`;
  }

  const label = presenceLabel(statusOf(partner.value?.userId));
  const message = statusMessageOf(partner.value?.userId);
  return message ? `${label} · ${message}` : label;
});

// Người nhắn cần biết trước là tin sẽ không bật lên bên kia, để tự cân nhắc có gọi điện không.
const partnerIsDoNotDisturb = computed(
  () => !group.value && statusOf(headerPartnerId.value) === PresenceStatus.DoNotDisturb,
);

/**
 * Tin của người khác đầu tiên nằm sau mốc đã đọc. Cả hội thoại chỉ có loạt tin đó thì bỏ vạch,
 * vì không còn phần đã đọc nào để tách.
 */
const firstUnreadSequence = computed(() => {
  const afterSequence = unreadMarkerOf(conversationId.value);
  if (afterSequence === null) return null;

  const list = messages.value;
  const index = list.findIndex((m) => m.sequence > afterSequence && !isOwnMessage(m));
  if (index < 0 || (index === 0 && !hasMoreMessages.value)) return null;

  return list[index].sequence;
});

const dayGroups = computed(() =>
  groupChatMessages(messages.value, currentUserId.value, firstUnreadSequence.value),
);

const lastOwnClusterKey = computed(() => {
  const clusters = dayGroups.value.flatMap((day) => day.clusters);
  return clusters.filter((c) => c.isOwn && !c.isSystem).at(-1)?.key ?? null;
});

const typingLabel = computed(() => {
  const names = typingNamesOf(conversation.value);
  if (!names.length) return "";
  if (names.length === 1) return `${names[0]} đang soạn tin...`;
  return `${names.length} người đang soạn tin...`;
});

/** Cách đáy trong khoảng này vẫn tính là đang xem tin mới nhất, tin đến sẽ tự cuộn theo. */
const AT_BOTTOM_THRESHOLD_PX = 64;

/** Chừa một khoảng phía trên vạch tin chưa đọc để còn thấy tin cũ liền trước làm ngữ cảnh. */
const UNREAD_DIVIDER_OFFSET_PX = 40;

/** Tin mới đến trong lúc đang cuộn lên; cuộn xuống đáy là đã đọc nên số này về 0. */
const newMessageCount = computed(() =>
  isThreadAtBottom.value ? 0 : (conversation.value?.unreadCount ?? 0),
);

const scrollToBottom = (behavior: ScrollBehavior = "auto") => {
  const el = scroller.value;
  if (el) el.scrollTo({ top: el.scrollHeight, behavior });
};

const isNearBottom = (el: HTMLElement) =>
  el.scrollHeight - el.scrollTop - el.clientHeight <= AT_BOTTOM_THRESHOLD_PX;

/** Xuống tới tin cuối là đã đọc hết, kể cả loạt tin về trong lúc đang cuộn lên. */
const setAtBottom = (atBottom: boolean) => {
  if (conversationId.value) setThreadAtBottom(conversationId.value, atBottom);
  if (atBottom && conversationId.value && document.visibilityState === "visible") {
    markRead(conversationId.value);
  }
};

const onScroll = () => {
  const el = scroller.value;
  if (!el) return;

  const atBottom = isNearBottom(el);
  if (atBottom !== isThreadAtBottom.value) setAtBottom(atBottom);
};

/** Loạt tin chưa đọc dài hơn một màn thì dừng ở vạch để đọc từ tin đầu, ngắn thì xuống đáy luôn. */
const scrollToFirstUnread = () => {
  const el = scroller.value;
  if (!el) return;

  const divider = el.querySelector<HTMLElement>("[data-unread-divider]");
  if (!divider) {
    scrollToBottom();
    return;
  }

  const dividerTop =
    divider.getBoundingClientRect().top - el.getBoundingClientRect().top + el.scrollTop;
  el.scrollTop = Math.min(
    el.scrollHeight - el.clientHeight,
    dividerTop - UNREAD_DIVIDER_OFFSET_PX,
  );
};

/** Hội thoại đã đặt vị trí đọc ban đầu, để phân biệt mở hội thoại với có tin mới về. */
let positionedConversationId: string | null = null;

// Chỉ theo tin cuối: tải thêm tin cũ ở phía trên không được kéo người đọc xuống đáy.
// Chờ render xong bong bóng mới rồi mới cuộn, nếu không scrollHeight vẫn là giá trị cũ.
watch(
  [() => conversationId.value, () => messages.value.at(-1)?.id],
  async ([conversationId]) => {
    if (!conversationId) {
      positionedConversationId = null;
      return;
    }

    const last = messages.value.at(-1);
    if (!last) return;

    if (positionedConversationId !== conversationId) {
      positionedConversationId = conversationId;
      const revealUnread = takeRevealUnread(conversationId);

      await nextTick();
      if (revealUnread) scrollToFirstUnread();
      else scrollToBottom();

      // Khung chat dựng lại sau khi rời màn khác, trạng thái cũ không còn đúng; nội dung ngắn
      // không cuộn được thì cũng không có sự kiện scroll để tự đồng bộ.
      if (scroller.value) setAtBottom(isNearBottom(scroller.value));
      return;
    }

    // Đang cuộn lên đọc tin cũ thì giữ nguyên chỗ, tin mới chỉ hiện ở nút đếm.
    if (isThreadAtBottom.value || isOwnMessage(last)) {
      await nextTick();
      scrollToBottom();
    }
  },
  { immediate: true },
);

// ─── Kéo thả tệp ──────────────────────────────────────────────────────────────

/**
 * Đi qua mỗi phần tử con là một cặp dragenter/dragleave, nên đếm tầng thay vì bật tắt theo từng
 * sự kiện, không thì lớp phủ nhấp nháy khi rê chuột qua các bong bóng tin.
 */
const dragDepth = ref(0);
const isDraggingFiles = computed(() => dragDepth.value > 0);

const onDragEnter = (event: DragEvent) => {
  if (!hasDraggedFiles(event)) return;
  event.preventDefault();
  dragDepth.value += 1;
};

const onDragOver = (event: DragEvent) => {
  if (!hasDraggedFiles(event)) return;
  // Không chặn mặc định ở đây thì trình duyệt mở luôn tệp, rời khỏi trang của site chủ.
  event.preventDefault();
  if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
};

const onDragLeave = (event: DragEvent) => {
  if (!hasDraggedFiles(event)) return;
  dragDepth.value = Math.max(0, dragDepth.value - 1);
};

const onDrop = (event: DragEvent) => {
  if (!hasDraggedFiles(event)) return;
  event.preventDefault();
  dragDepth.value = 0;
  composer.value?.addFiles(Array.from(event.dataTransfer?.files ?? []));
};

/** Giữ nguyên vị trí đang đọc sau khi chèn thêm tin cũ ở phía trên. */
const onLoadOlder = async () => {
  const el = scroller.value;
  const previousHeight = el?.scrollHeight ?? 0;

  if (conversationId.value) await loadOlderMessages(conversationId.value);

  await nextTick();
  if (el) el.scrollTop = el.scrollHeight - previousHeight;
};
</script>

<template>
  <div
    class="relative flex min-h-0 flex-1 flex-col"
    @dragenter="onDragEnter"
    @dragover="onDragOver"
    @dragleave="onDragLeave"
    @drop="onDrop"
  >
    <header class="flex shrink-0 items-center gap-2.5 border-b border-gray-100 px-3 py-2.5">
      <WidgetAvatar
        :name="headerTitle"
        :variant="group ? 'group' : 'user'"
        :src="conversation?.avatarUrl ?? draft?.avatarUrl"
        :status="statusOf(headerPartnerId)"
        :show-presence="!group"
        size="sm"
      />

      <div class="min-w-0 flex-1">
        <p class="truncate text-sm font-semibold text-gray-900">{{ headerTitle }}</p>
        <p
          class="truncate text-[11px]"
          :class="typingLabel ? 'text-chat-accent-strong' : 'text-gray-600'"
        >
          {{ typingLabel || subtitle }}
        </p>
      </div>

      <template v-if="conversation">
        <button
          type="button"
          class="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-chat-accent/10 hover:text-chat-accent-strong"
          aria-label="Tìm trong hội thoại"
          title="Tìm trong hội thoại"
          @click="openScreen('search')"
        >
          <WidgetIcon name="Search" :size="17" />
        </button>

        <button
          type="button"
          class="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-chat-accent/10"
          :class="
            conversation.isMuted
              ? 'text-chat-accent-strong'
              : 'text-gray-500 hover:text-chat-accent-strong'
          "
          :aria-label="conversation.isMuted ? 'Bật thông báo' : 'Tắt thông báo'"
          :title="conversation.isMuted ? 'Bật thông báo' : 'Tắt thông báo'"
          @click="toggleMute(conversation.id)"
        >
          <WidgetIcon :name="conversation.isMuted ? 'BellOff' : 'Bell'" :size="17" />
        </button>

        <button
          type="button"
          class="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-chat-accent/10 hover:text-chat-accent-strong"
          :aria-label="group ? 'Thông tin nhóm' : 'Thông tin hội thoại'"
          :title="group ? 'Thông tin nhóm' : 'Thông tin hội thoại'"
          @click="openScreen('info')"
        >
          <WidgetIcon name="Info" :size="17" />
        </button>
      </template>
    </header>

    <PinnedBar v-if="conversation" :key="conversation.id" :conversation="conversation" />

    <div class="relative flex min-h-0 flex-1 flex-col">
      <div
        ref="scroller"
        class="gdtd-chat-scroll min-h-0 flex-1 overflow-y-auto px-3 py-3"
        @scroll.passive="onScroll"
      >
        <div v-if="hasMoreMessages" class="mb-3 flex justify-center">
          <button
            type="button"
            class="rounded-full border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-60"
            :disabled="isLoadingMessages"
            @click="onLoadOlder"
          >
            {{ isLoadingMessages ? "Đang tải..." : "Tải tin nhắn cũ hơn" }}
          </button>
        </div>

        <div
          v-if="!dayGroups.length && !isLoadingMessages"
          class="flex h-full flex-col items-center justify-center gap-2 px-6 text-center"
        >
          <WidgetAvatar
            :name="headerTitle"
            :variant="group ? 'group' : 'user'"
            :src="conversation?.avatarUrl ?? draft?.avatarUrl"
            size="lg"
          />
          <p class="mt-1 text-sm font-semibold text-gray-800">{{ headerTitle }}</p>
          <p class="max-w-56 text-xs text-gray-600">
            Chưa có tin nhắn nào. Gửi lời chào để bắt đầu hội thoại.
          </p>
        </div>

        <div v-for="day in dayGroups" :key="day.key" class="space-y-3">
          <div class="flex items-center gap-3 py-2">
            <span class="h-px flex-1 bg-gray-100" />
            <span class="text-[11px] font-medium text-gray-500">{{ day.label }}</span>
            <span class="h-px flex-1 bg-gray-100" />
          </div>

          <template v-for="cluster in day.clusters" :key="cluster.key">
            <div
              v-if="cluster.messages[0].sequence === firstUnreadSequence"
              data-unread-divider
              role="separator"
              aria-label="Tin chưa đọc"
              class="flex items-center gap-3 py-1"
            >
              <span class="h-px flex-1 bg-chat-accent/40" />
              <span class="text-[11px] font-semibold text-chat-accent-strong">Tin chưa đọc</span>
              <span class="h-px flex-1 bg-chat-accent/40" />
            </div>

            <MessageCluster
              :cluster="cluster"
              :conversation="conversation"
              :messages="messages"
              :show-sender-name="group"
              :show-status="cluster.key === lastOwnClusterKey"
            />
          </template>
        </div>
      </div>

      <Transition
        enter-active-class="transition duration-150 ease-out motion-reduce:transition-none"
        enter-from-class="translate-y-1.5 opacity-0"
        leave-active-class="transition duration-150 ease-in motion-reduce:transition-none"
        leave-to-class="translate-y-1.5 opacity-0"
      >
        <button
          v-if="newMessageCount > 0"
          type="button"
          class="absolute bottom-2.5 left-1/2 z-10 inline-flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-chat-accent px-3 py-1.5 text-xs font-semibold text-white shadow-lg shadow-chat-accent/25 transition-colors hover:bg-chat-accent-strong"
          @click="scrollToBottom('smooth')"
        >
          <WidgetIcon name="ArrowDown" :size="14" />
          {{ newMessageCount > 99 ? "99+" : newMessageCount }} tin mới
        </button>
      </Transition>
    </div>

    <p
      v-if="partnerIsDoNotDisturb"
      class="flex shrink-0 items-center gap-2 border-t border-gray-100 bg-red-50 px-3 py-1.5 text-[11px] text-red-800"
    >
      <PresenceDot :status="PresenceStatus.DoNotDisturb" class="h-2.5 w-2.5 shrink-0" />
      <span class="min-w-0 flex-1">
        {{ headerTitle }} đang bật Không làm phiền nên có thể chưa thấy tin ngay.
      </span>
    </p>

    <MessageComposer
      ref="composer"
      :key="conversationId ?? draft?.userId"
      :conversation="conversation"
      :autofocus="Boolean(draft)"
      :placeholder="`Nhắn tin cho ${headerTitle}`"
      @send="send"
      @send-sticker="onSendSticker"
      @typing="notifyTyping(conversationId)"
    />

    <!-- Không nhận chuột để sự kiện kéo vẫn rơi xuống khung chat bên dưới, bộ đếm tầng mới khớp. -->
    <div
      v-if="isDraggingFiles"
      class="pointer-events-none absolute inset-0 z-40 flex bg-white/90 p-2.5 backdrop-blur-sm"
    >
      <div
        class="flex flex-1 flex-col items-center justify-center rounded-2xl border-2 border-dashed border-chat-accent/60 bg-chat-accent/5 px-5 text-center"
      >
        <span
          class="flex h-12 w-12 items-center justify-center rounded-2xl bg-chat-accent/10 text-chat-accent-strong"
        >
          <WidgetIcon name="Upload" :size="22" />
        </span>
        <p class="mt-3 text-sm font-semibold text-gray-900">Thả tệp vào đây để gửi</p>
        <p class="mt-1 max-w-56 text-xs leading-relaxed text-gray-600">
          Tối đa {{ MAX_ATTACHMENTS_PER_MESSAGE }} tệp mỗi tin, mỗi tệp không quá
          {{ formatBytes(attachmentRule.maxSizeBytes, 0) }}.
        </p>
      </div>
    </div>
  </div>
</template>
