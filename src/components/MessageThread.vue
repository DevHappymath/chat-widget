<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import { MAX_ATTACHMENTS_PER_MESSAGE } from "../constants/attachment";
import { useChatStore } from "../core/store/useChatStore";
import { PresenceStatus } from "../types/chat";
import { hasDraggedFiles } from "../utils/attachment";
import { groupChatMessages, presenceLabel } from "../utils/chat";
import { formatBytes } from "../utils/format";
import MessageCluster from "./MessageCluster.vue";
import MessageComposer from "./MessageComposer.vue";
import PresenceDot from "./PresenceDot.vue";
import PinnedBar from "./PinnedBar.vue";
import WidgetAvatar from "./WidgetAvatar.vue";
import WidgetIcon from "./WidgetIcon.vue";

const {
  view,
  currentUserId,
  activeConversation,
  activeConversationId,
  activeMessages,
  activeTypingNames,
  hasMoreMessages,
  isLoadingMessages,
  draft,
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
  notifyTyping,
  toggleMute,
  attachmentRule,
} = useChatStore();

const scroller = ref<HTMLElement | null>(null);
const composer = ref<InstanceType<typeof MessageComposer> | null>(null);

const partner = computed(() =>
  activeConversation.value ? partnerOf(activeConversation.value) : undefined,
);

const group = computed(() =>
  activeConversation.value ? isGroup(activeConversation.value) : false,
);

/** Header dùng chung cho hội thoại thật và bản nháp, khác nhau ở nguồn tên và avatar. */
const headerTitle = computed(() =>
  activeConversation.value
    ? titleOf(activeConversation.value)
    : (draft.value?.fullName ?? ""),
);

const headerPartnerId = computed(() => partner.value?.userId ?? draft.value?.userId);

const subtitle = computed(() => {
  const conversation = activeConversation.value;

  if (!conversation) return draft.value ? "Hội thoại mới, chưa gửi tin nào" : "";

  if (group.value) {
    const members = membersOf(conversation);
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

const dayGroups = computed(() =>
  groupChatMessages(activeMessages.value, currentUserId.value),
);

const lastOwnClusterKey = computed(() => {
  const clusters = dayGroups.value.flatMap((day) => day.clusters);
  return clusters.filter((c) => c.isOwn && !c.isSystem).at(-1)?.key ?? null;
});

const typingLabel = computed(() => {
  const names = activeTypingNames.value;
  if (!names.length) return "";
  if (names.length === 1) return `${names[0]} đang soạn tin...`;
  return `${names.length} người đang soạn tin...`;
});

const scrollToBottom = () => {
  const el = scroller.value;
  if (el) el.scrollTop = el.scrollHeight;
};

// Chờ render xong bong bóng mới rồi mới cuộn, nếu không scrollHeight vẫn là giá trị cũ.
watch(
  [() => activeConversationId.value, () => activeMessages.value.length],
  () => nextTick(scrollToBottom),
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

  await loadOlderMessages();

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
        :src="activeConversation?.avatarUrl ?? draft?.avatarUrl"
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

      <template v-if="activeConversation">
        <button
          type="button"
          class="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-chat-accent/10 hover:text-chat-accent-strong"
          aria-label="Tìm trong hội thoại"
          title="Tìm trong hội thoại"
          @click="view = 'search'"
        >
          <WidgetIcon name="Search" :size="17" />
        </button>

        <button
          type="button"
          class="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-chat-accent/10"
          :class="
            activeConversation.isMuted
              ? 'text-chat-accent-strong'
              : 'text-gray-500 hover:text-chat-accent-strong'
          "
          :aria-label="activeConversation.isMuted ? 'Bật thông báo' : 'Tắt thông báo'"
          :title="activeConversation.isMuted ? 'Bật thông báo' : 'Tắt thông báo'"
          @click="toggleMute(activeConversation.id)"
        >
          <WidgetIcon :name="activeConversation.isMuted ? 'BellOff' : 'Bell'" :size="17" />
        </button>

        <button
          type="button"
          class="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-chat-accent/10 hover:text-chat-accent-strong"
          :aria-label="group ? 'Thông tin nhóm' : 'Thông tin hội thoại'"
          :title="group ? 'Thông tin nhóm' : 'Thông tin hội thoại'"
          @click="view = 'info'"
        >
          <WidgetIcon name="Info" :size="17" />
        </button>
      </template>
    </header>

    <PinnedBar />

    <div ref="scroller" class="gdtd-chat-scroll min-h-0 flex-1 overflow-y-auto px-3 py-3">
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
          :src="activeConversation?.avatarUrl ?? draft?.avatarUrl"
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

        <MessageCluster
          v-for="cluster in day.clusters"
          :key="cluster.key"
          :cluster="cluster"
          :show-sender-name="group"
          :show-status="cluster.key === lastOwnClusterKey"
        />
      </div>
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
      :key="activeConversationId ?? draft?.userId"
      :autofocus="Boolean(draft)"
      :placeholder="`Nhắn tin cho ${headerTitle}`"
      @send="sendMessage"
      @send-sticker="sendSticker"
      @typing="notifyTyping"
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
